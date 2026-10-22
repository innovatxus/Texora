import "server-only";
import { createElement } from "react";
import { ActionError } from "@/lib/actions/run-action";
import { writeAuditLog } from "@/lib/audit/log";
import {
  applyEmailVerification,
  confirmPasswordReset,
  IdentityError,
  oobCodeFromLink,
  signInWithCustomToken,
  signInWithPassword,
  verifyPasswordResetCode,
} from "@/lib/auth/identity";
import { passwordProblem } from "@/lib/auth/password";
import { isRole } from "@/lib/auth/rbac";
import { grantMerchantRole } from "@/lib/auth/roles";
import { brand } from "@/config/brand";
import { sendEmail } from "@/lib/email/send";
import {
  MerchantPasswordResetEmail,
  MerchantVerifyEmail,
} from "@/lib/email/templates/MerchantAccount";
import { clientEnv } from "@/lib/env/client";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { logger } from "@/lib/observability/logger";
import { consumeRateLimit, isRateLimited, resetRateLimit } from "@/lib/security/rate-limit";
import type { Merchant } from "@/lib/validation/merchant";
import {
  claimUsername,
  getMerchant,
  getMerchantByOwner,
  releaseUsername,
  UsernameTakenError,
} from "./repositories/merchants";

const USERNAME_TAKEN = "That username is taken";
const EMAIL_TAKEN = "An account with this email already exists. Sign in to add a shop to it.";

/** What a successful registration or upgrade hands back: who, and a fresh ID token for the session. */
export interface MerchantAccountResult {
  uid: string;
  vendorId: string;
  idToken: string;
}

function siteUrl(path: string): string {
  return new URL(path, clientEnv.NEXT_PUBLIC_SITE_URL).toString();
}

/**
 * Creates the merchant record and username lock for an existing Auth user,
 * then grants the merchant role (D-061). Undoes its own writes if a later step
 * fails, so a retry starts clean.
 */
async function attachMerchant(
  uid: string,
  email: string,
  username: string,
  now: Date,
): Promise<string> {
  const { db } = getFirebaseAdmin();
  const merchantRef = db.collection("merchants").doc();
  const vendorId = merchantRef.id;

  try {
    await db.runTransaction(async (tx) => {
      await claimUsername(tx, username, { uid, vendorId }, now);
      const merchant: Omit<Merchant, "id"> = {
        ownerUid: uid,
        email,
        username,
        displayName: username,
        status: "onboarding",
        emailVerified: false,
        trustLevel: "standard",
        shopIds: [],
        notifications: { newOrders: true, productReviews: true },
        createdAt: now,
        updatedAt: now,
      };
      tx.create(merchantRef, merchant);
    });
  } catch (error) {
    if (error instanceof UsernameTakenError) {
      throw new ActionError("conflict", USERNAME_TAKEN, "username");
    }
    throw error;
  }

  try {
    await grantMerchantRole(uid, vendorId);
    await writeAuditLog({
      actor: { uid, role: "vendor", email },
      action: "merchants.create",
      target: { type: "merchant", id: vendorId },
      after: { username, status: "onboarding" },
    });
  } catch (error) {
    await merchantRef.delete().catch(() => {});
    await releaseUsername(username, uid).catch(() => {});
    throw error;
  }
  return vendorId;
}

/** Sends (or re-sends) the verification link. Failures are logged; the merchant can resend. */
export async function sendMerchantVerification(email: string, username: string): Promise<void> {
  try {
    const link = await getFirebaseAdmin().auth.generateEmailVerificationLink(email, {
      url: siteUrl("/merchant"),
    });
    const ours = siteUrl(
      `/merchant/verify-email?oobCode=${encodeURIComponent(oobCodeFromLink(link))}`,
    );
    await sendEmail({
      to: email,
      subject: `Verify your email to open your ${brand.name} shop`,
      template: createElement(MerchantVerifyEmail, { brandName: brand.name, username, link: ours }),
      kind: "merchant_verify_email",
    });
  } catch (error) {
    logger.error("merchant.verification_email_failed", { error });
  }
}

/**
 * Registers a new merchant: Auth user → username lock + merchant record →
 * merchant role → verification email → fresh ID token. Idempotent: a retry
 * with the same email and password after a success (or for an existing
 * shopper account) signs in instead of failing. Rolls back on failure.
 */
export async function registerMerchant(
  input: { email: string; username: string; password: string },
  now: Date = new Date(),
): Promise<MerchantAccountResult> {
  const { auth } = getFirebaseAdmin();

  let uid: string;
  try {
    uid = (await auth.createUser({ email: input.email, password: input.password })).uid;
  } catch (error) {
    if ((error as { code?: string }).code !== "auth/email-already-exists") throw error;
    return registerExistingAccount(input, now);
  }

  try {
    const vendorId = await attachMerchant(uid, input.email, input.username, now);
    // Claims are set, so this token carries role "vendor" and the vendorId.
    const { idToken } = await signInWithPassword(input.email, input.password);
    await sendMerchantVerification(input.email, input.username);
    return { uid, vendorId, idToken };
  } catch (error) {
    await auth.deleteUser(uid).catch(() => {});
    throw error;
  }
}

/** The email already has an account: sign in with the given password, then finish or upgrade. */
async function registerExistingAccount(
  input: { email: string; username: string; password: string },
  now: Date,
): Promise<MerchantAccountResult> {
  let signedIn: { idToken: string; uid: string };
  try {
    signedIn = await signInWithPassword(input.email, input.password);
  } catch {
    throw new ActionError("conflict", EMAIL_TAKEN, "email");
  }
  const existing = await getMerchantByOwner(signedIn.uid);
  if (existing) {
    // A retry of a registration that already succeeded.
    if (existing.username !== input.username)
      throw new ActionError("conflict", EMAIL_TAKEN, "email");
    return { uid: signedIn.uid, vendorId: existing.id, idToken: signedIn.idToken };
  }
  return upgradeToMerchant(signedIn.uid, input.username, now);
}

/**
 * Adds a shop to a signed-in shopper's account. Old sessions are revoked by
 * the role change, so a fresh ID token is minted from a custom token.
 */
export async function upgradeToMerchant(
  uid: string,
  username: string,
  now: Date = new Date(),
): Promise<MerchantAccountResult> {
  const { auth } = getFirebaseAdmin();
  const existing = await getMerchantByOwner(uid);
  if (existing) {
    throw new ActionError("conflict", "This account already has a merchant account.");
  }
  const user = await auth.getUser(uid);
  if (!user.email) throw new ActionError("conflict", "Add an email to your account first.");

  const vendorId = await attachMerchant(uid, user.email.toLowerCase(), username, now);
  const { idToken } = await signInWithCustomToken(await auth.createCustomToken(uid));
  if (!user.emailVerified) await sendMerchantVerification(user.email, username);
  else await markEmailVerified(vendorId);
  return { uid, vendorId, idToken };
}

async function markEmailVerified(vendorId: string): Promise<void> {
  await getFirebaseAdmin()
    .db.collection("merchants")
    .doc(vendorId)
    .update({ emailVerified: true, updatedAt: new Date() });
}

/** Applies a verification link; marks the merchant verified. */
export async function verifyMerchantEmail(
  oobCode: string,
): Promise<{ status: "verified" | "invalid" }> {
  let email: string;
  try {
    ({ email } = await applyEmailVerification(oobCode));
  } catch (error) {
    if (error instanceof IdentityError) return { status: "invalid" };
    throw error;
  }
  const user = await getFirebaseAdmin().auth.getUserByEmail(email);
  const merchant = await getMerchantByOwner(user.uid);
  if (merchant && !merchant.emailVerified) {
    await markEmailVerified(merchant.id);
    await writeAuditLog({
      actor: { uid: user.uid, role: "vendor", email },
      action: "merchants.verify_email",
      target: { type: "merchant", id: merchant.id },
      before: { emailVerified: false },
      after: { emailVerified: true },
    });
  }
  return { status: "verified" };
}

/**
 * Keeps the merchant record in step with Firebase Auth, e.g. after a
 * verification link opened on another device. Returns whether it's verified.
 */
export async function syncEmailVerified(uid: string, vendorId: string): Promise<boolean> {
  const merchant = await getMerchant(vendorId);
  if (!merchant) return false;
  if (merchant.emailVerified) return true;
  const user = await getFirebaseAdmin().auth.getUser(uid);
  if (!user.emailVerified) return false;
  await markEmailVerified(vendorId);
  return true;
}

/** Resends the verification link, once a minute per account. */
export async function resendMerchantVerification(uid: string, vendorId: string): Promise<void> {
  const limit = await consumeRateLimit("verifyResend", uid);
  if (!limit.allowed) {
    throw new ActionError(
      "limit_exceeded",
      `Wait ${limit.retryAfterSeconds} seconds before sending another link.`,
    );
  }
  const merchant = await getMerchant(vendorId);
  if (!merchant) throw new ActionError("not_found", "We couldn't find your merchant account.");
  if (await syncEmailVerified(uid, vendorId)) {
    throw new ActionError("conflict", "Your email is already verified.");
  }
  await sendMerchantVerification(merchant.email, merchant.username);
}

// ---------------------------------------------------------------- sign-in & recovery

export const SIGN_IN_FAILED = "Email/username or password is incorrect.";
export const LOCKED_OUT = "Too many attempts. Wait 15 minutes or reset your password.";

/**
 * Checks merchant credentials on the server: a username resolves to its
 * email, failures count towards a 15-minute lockout per account, and the IP
 * is rate-limited. Returns a fresh ID token for the session.
 */
export async function verifyMerchantCredentials(
  identifier: string,
  password: string,
  ip: string,
  resolveUsername: (username: string) => Promise<string | null>,
): Promise<{ idToken: string; email: string }> {
  if (!(await consumeRateLimit("signInIp", ip)).allowed) {
    throw new ActionError("limit_exceeded", "Too many attempts. Wait a few minutes and try again.");
  }
  const trimmed = identifier.trim().toLowerCase();
  const email = trimmed.includes("@") ? trimmed : await resolveUsername(trimmed);
  // Unknown usernames count against the identifier, so they lock out like real ones.
  const accountKey = email ?? `username:${trimmed}`;
  if (await isRateLimited("signInAccount", accountKey)) {
    throw new ActionError("limit_exceeded", LOCKED_OUT);
  }
  if (!email) {
    await consumeRateLimit("signInAccount", accountKey);
    throw new ActionError("unauthenticated", SIGN_IN_FAILED);
  }

  try {
    const { idToken } = await signInWithPassword(email, password);
    await resetRateLimit("signInAccount", accountKey);
    return { idToken, email };
  } catch (error) {
    if (error instanceof IdentityError) {
      if (error.code === "USER_DISABLED") {
        throw new ActionError(
          "forbidden",
          "This account has been disabled. Contact merchant support.",
        );
      }
      if (error.code === "TOO_MANY_ATTEMPTS_TRY_LATER") {
        throw new ActionError("limit_exceeded", LOCKED_OUT);
      }
      await consumeRateLimit("signInAccount", accountKey);
      throw new ActionError("unauthenticated", SIGN_IN_FAILED);
    }
    throw error;
  }
}

/** Sends a reset link if the account exists. Callers always show the same message. */
export async function requestMerchantPasswordReset(email: string, ip: string): Promise<void> {
  if (!(await consumeRateLimit("passwordReset", ip)).allowed) {
    throw new ActionError("limit_exceeded", "Too many requests. Wait a while and try again.");
  }
  const { auth } = getFirebaseAdmin();
  try {
    await auth.getUserByEmail(email);
  } catch {
    return;
  }
  const link = await auth.generatePasswordResetLink(email, { url: siteUrl("/merchant/sign-in") });
  const ours = siteUrl(
    `/merchant/reset-password?oobCode=${encodeURIComponent(oobCodeFromLink(link))}`,
  );
  await sendEmail({
    to: email,
    subject: `Reset your ${brand.name} merchant password`,
    template: createElement(MerchantPasswordResetEmail, { brandName: brand.name, link: ours }),
    kind: "merchant_password_reset",
  });
}

/** Whether a reset link is still usable (for the page's first render). */
export async function checkPasswordResetCode(oobCode: string): Promise<boolean> {
  try {
    await verifyPasswordResetCode(oobCode);
    return true;
  } catch (error) {
    if (error instanceof IdentityError) return false;
    throw error;
  }
}

/** Sets a new password with a reset code, signs out every device and clears any lockout. */
export async function resetMerchantPassword(oobCode: string, password: string): Promise<void> {
  let email: string;
  try {
    ({ email } = await verifyPasswordResetCode(oobCode));
  } catch (error) {
    if (error instanceof IdentityError) {
      throw new ActionError("not_found", "That reset link has expired. Request a new one.");
    }
    throw error;
  }
  const problem = passwordProblem(password, [email]);
  if (problem) throw new ActionError("conflict", problem, "password");

  await confirmPasswordReset(oobCode, password);
  const { auth } = getFirebaseAdmin();
  const user = await auth.getUserByEmail(email);
  await auth.revokeRefreshTokens(user.uid);
  await resetRateLimit("signInAccount", email);
  const role = user.customClaims?.role;
  await writeAuditLog({
    actor: { uid: user.uid, role: isRole(role) ? role : "customer", email },
    action: "merchants.reset_password",
    target: { type: "user", id: user.uid },
  });
}
