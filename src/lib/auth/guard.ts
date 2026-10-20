import "server-only";
import { forbidden, unauthorized } from "next/navigation";
import { connection } from "next/server";
import { hasPermission, type Permission } from "./rbac";
import { getSession, type Session } from "./session";

/** Thrown by guards: no session (unauthenticated) or missing permission (forbidden). */
export class AuthorizationError extends Error {
  constructor(
    public readonly code: "unauthenticated" | "forbidden",
    public readonly permission?: Permission,
  ) {
    super(code === "unauthenticated" ? "Sign in required" : `Missing permission: ${permission}`);
    this.name = "AuthorizationError";
  }
}

/**
 * For Server Actions and Route Handlers. Re-reads and re-verifies the session
 * (including revocation) so every mutation authorises itself.
 */
export async function requireSession(): Promise<Session> {
  const session = await getSession({ checkRevoked: true });
  if (!session || session.role === "guest") throw new AuthorizationError("unauthenticated");
  return session;
}

/** Returns the session if its role has the permission; throws otherwise. */
export async function requirePermission(permission: Permission): Promise<Session> {
  const session = await requireSession();
  if (!hasPermission(session.role, permission)) {
    throw new AuthorizationError("forbidden", permission);
  }
  return session;
}

/**
 * For Server Components: renders the 401/403 page instead of throwing a
 * catchable error. Call it inside a Suspense boundary (it reads cookies).
 */
export async function requirePagePermission(permission: Permission): Promise<Session> {
  // Always request-time: token verification reads the clock, which must not run while prerendering.
  await connection();
  const session = await getSession();
  if (!session || session.role === "guest") unauthorized();
  if (!hasPermission(session.role, permission)) forbidden();
  return session;
}
