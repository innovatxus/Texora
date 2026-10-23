import "server-only";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { isRole, type Role } from "./rbac";
import { newProfile } from "./profile";

import { SESSION_COOKIE } from "./session-cookie";

export { SESSION_COOKIE };
/** Session cookies last five days. */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 5;
/** A session may only be minted from a sign-in this recent (Firebase guidance). */
const MAX_SIGN_IN_AGE_SECONDS = 5 * 60;

export interface Session {
  uid: string;
  email: string | null;
  role: Role;
  vendorId: string | null;
}

interface DecodedClaims {
  uid: string;
  email?: string;
  role?: unknown;
  vendorId?: unknown;
}

/** Turns verified Firebase token claims into a session (uid, email, role). */
export function sessionFromClaims(claims: DecodedClaims): Session {
  return {
    uid: claims.uid,
    email: claims.email ?? null,
    // No claim means a regular customer; an unrecognised claim gets no access.
    role: claims.role === undefined ? "customer" : isRole(claims.role) ? claims.role : "guest",
    vendorId: typeof claims.vendorId === "string" ? claims.vendorId : null,
  };
}

/**
 * Verifies a session cookie. `checkRevoked` adds a round trip to Firebase Auth
 * and is required before any mutation; page reads may skip it.
 */
export async function verifySessionCookie(
  value: string,
  { checkRevoked }: { checkRevoked: boolean },
): Promise<Session | null> {
  try {
    const claims = await getFirebaseAdmin().auth.verifySessionCookie(value, checkRevoked);
    return sessionFromClaims(claims);
  } catch {
    return null;
  }
}

/** The current session, or null for guests and expired/revoked cookies. */
export async function getSession({ checkRevoked = false } = {}): Promise<Session | null> {
  // A session is per request by definition. Marking it keeps prefetch and
  // prerender passes out of cookie verification, which reads the clock.
  await connection();
  const value = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!value) return null;
  return verifySessionCookie(value, { checkRevoked });
}

/** Why a session couldn't be created: invalid token, stale sign-in or disabled account. */
export class SessionError extends Error {
  constructor(
    public readonly code: "invalid_token" | "stale_sign_in" | "disabled",
    message: string,
  ) {
    super(message);
    this.name = "SessionError";
  }
}

/**
 * Exchanges a fresh Firebase ID token for an HTTP-only session cookie and
 * makes sure the user has a profile document.
 */
export async function createSession(idToken: string): Promise<Session> {
  // Request-time work: token checks read the clock before any cookie is touched.
  await connection();
  const { auth, db } = getFirebaseAdmin();

  let decoded;
  try {
    decoded = await auth.verifyIdToken(idToken, true);
  } catch {
    throw new SessionError("invalid_token", "Sign-in could not be verified");
  }

  if (Date.now() / 1000 - decoded.auth_time > MAX_SIGN_IN_AGE_SECONDS) {
    throw new SessionError("stale_sign_in", "Please sign in again");
  }
  if (decoded.firebase.sign_in_provider === "anonymous") {
    throw new SessionError("invalid_token", "Guest sessions do not use session cookies");
  }

  const record = await auth.getUser(decoded.uid);
  if (record.disabled) throw new SessionError("disabled", "This account is disabled");

  const profileRef = db.collection("users").doc(decoded.uid);
  await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(profileRef);
    if (snapshot.exists) return;
    tx.create(profileRef, newProfile(record, new Date()));
  });

  const cookie = await auth.createSessionCookie(idToken, {
    expiresIn: SESSION_MAX_AGE_SECONDS * 1000,
  });

  (await cookies()).set(SESSION_COOKIE, cookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return sessionFromClaims(decoded);
}

/** Clears the cookie and, by default, revokes refresh tokens on every device. */
export async function destroySession({ everywhere = false } = {}): Promise<void> {
  const store = await cookies();
  const value = store.get(SESSION_COOKIE)?.value;
  store.delete(SESSION_COOKIE);
  if (!value || !everywhere) return;
  const session = await verifySessionCookie(value, { checkRevoked: false });
  if (session) await getFirebaseAdmin().auth.revokeRefreshTokens(session.uid);
}
