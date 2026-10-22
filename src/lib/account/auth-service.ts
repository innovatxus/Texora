import "server-only";
import { createElement } from "react";
import { brand } from "@/config/brand";
import { ActionError } from "@/lib/actions/run-action";
import { writeAuditLog } from "@/lib/audit/log";
import {
  confirmPasswordReset,
  IdentityError,
  oobCodeFromLink,
  signInWithCustomToken,
  signInWithPassword,
  verifyPasswordResetCode,
} from "@/lib/auth/identity";
import { passwordProblem } from "@/lib/auth/password";
import { canSystemGrant, isRole, type Role } from "@/lib/auth/rbac";
import { sendEmail } from "@/lib/email/send";
import {
  CustomerPasswordResetEmail,
  CustomerWelcomeEmail,
} from "@/lib/email/templates/CustomerAccount";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { logger } from "@/lib/observability/logger";
import { consumeRateLimit, isRateLimited, resetRateLimit } from "@/lib/security/rate-limit";
import { siteUrl } from "@/lib/site-url";
import { userSchema } from "@/lib/validation/customer";

export const SIGN_IN_FAILED = "That email and password don't match. Check them and try again.";
export const LOCKED_OUT = "Too many attempts. Wait 15 minutes or reset your password.";
const EMAIL_TAKEN =
  "An account with this email already exists. Sign in, or reset your password if you've forgotten it.";

/** A new rewards member: Core tier, no points yet. */
const newLoyalty = (now: Date) => ({ tier: "core", points: 0, periodSpend: 0, memberSince: now });

/**
 * Creates a customer account (optionally a rewards member) and returns an ID
 * token for the session. The profile is written complete, so it always
 * parses. Rolls the Auth user back if anything after creating it fails.
 */
export async function registerCustomer(
  input: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    marketingEmail: boolean;
    joinRewards: boolean;
  },
  ip: string,
  now: Date = new Date(),
): Promise<{ uid: string; idToken: string; role: Role }> {
  if (!(await consumeRateLimit("register", ip)).allowed) {
    throw new ActionError("limit_exceeded", "Too many sign-ups from here. Try again later.");
  }
  const { auth, db } = getFirebaseAdmin();
  const role: Role = input.joinRewards ? "loyalty_member" : "customer";

  let uid: string;
  try {
    uid = (
      await auth.createUser({
        email: input.email,
        password: input.password,
        displayName: `${input.firstName} ${input.lastName}`,
      })
    ).uid;
  } catch (error) {
    if ((error as { code?: string }).code === "auth/email-already-exists") {
      throw new ActionError("conflict", EMAIL_TAKEN, "email");
    }
    throw error;
  }

  try {
    await auth.setCustomUserClaims(uid, { role });
    const profile = userSchema.parse({
      uid,
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      role,
      ...(input.joinRewards ? { loyalty: newLoyalty(now) } : {}),
      preferences: { marketingEmail: input.marketingEmail, marketingSms: false },
      savedSizes: {},
      disabled: false,
      createdAt: now,
      updatedAt: now,
    });
    const { uid: _uid, ...data } = profile;
    await db.collection("users").doc(uid).create(data);
    const { idToken } = await signInWithPassword(input.email, input.password);
    await writeAuditLog({
      actor: { uid, role, email: input.email },
      action: "account.register",
      target: { type: "user", id: uid },
      after: { role },
    });
    try {
      await sendEmail({
        to: input.email,
        subject: `Welcome to ${brand.name}`,
        template: createElement(CustomerWelcomeEmail, {
          brandName: brand.name,
          firstName: input.firstName,
          rewards: input.joinRewards,
          link: siteUrl("/account"),
        }),
        kind: "customer_welcome",
        ref: uid,
      });
    } catch (error) {
      logger.error("account.welcome_email_failed", { error });
    }
    return { uid, idToken, role };
  } catch (error) {
    await auth.deleteUser(uid).catch(() => {});
    await db
      .collection("users")
      .doc(uid)
      .delete()
      .catch(() => {});
    throw error;
  }
}

/**
 * Checks a customer's password on the server: failures count towards a
 * 15-minute lockout per account, and the IP is rate-limited. Returns a fresh
 * ID token for the session.
 */
export async function signInCustomer(
  email: string,
  password: string,
  ip: string,
): Promise<{ idToken: string }> {
  if (!(await consumeRateLimit("signInIp", ip)).allowed) {
    throw new ActionError("limit_exceeded", "Too many attempts. Wait a few minutes and try again.");
  }
  if (await isRateLimited("signInAccount", email)) {
    throw new ActionError("limit_exceeded", LOCKED_OUT);
  }
  try {
    const { idToken } = await signInWithPassword(email, password);
    await resetRateLimit("signInAccount", email);
    return { idToken };
  } catch (error) {
    if (error instanceof IdentityError) {
      if (error.code === "USER_DISABLED") {
        throw new ActionError("forbidden", "This account has been disabled. Contact us for help.");
      }
      if (error.code === "TOO_MANY_ATTEMPTS_TRY_LATER") {
        throw new ActionError("limit_exceeded", LOCKED_OUT);
      }
      await consumeRateLimit("signInAccount", email);
      throw new ActionError("unauthenticated", SIGN_IN_FAILED);
    }
    throw error;
  }
}

/** Sends a reset link if the account exists. Callers always show the same message. */
export async function requestCustomerPasswordReset(email: string, ip: string): Promise<void> {
  if (!(await consumeRateLimit("passwordReset", ip)).allowed) {
    throw new ActionError("limit_exceeded", "Too many requests. Wait a while and try again.");
  }
  const { auth } = getFirebaseAdmin();
  try {
    await auth.getUserByEmail(email);
  } catch {
    return;
  }
  const link = await auth.generatePasswordResetLink(email, { url: siteUrl("/auth/signin") });
  await sendEmail({
    to: email,
    subject: `Reset your ${brand.name} password`,
    template: createElement(CustomerPasswordResetEmail, {
      brandName: brand.name,
      link: siteUrl(`/auth/reset-password?oobCode=${encodeURIComponent(oobCodeFromLink(link))}`),
    }),
    kind: "customer_password_reset",
  });
}

/** Whether a reset link is still usable (for the page's first render). */
export async function checkResetCode(oobCode: string): Promise<boolean> {
  try {
    await verifyPasswordResetCode(oobCode);
    return true;
  } catch (error) {
    if (error instanceof IdentityError) return false;
    throw error;
  }
}

/** Sets a new password with a reset code, signs out every device and clears any lockout. */
export async function resetCustomerPassword(oobCode: string, password: string): Promise<void> {
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
    action: "account.reset_password",
    target: { type: "user", id: user.uid },
  });
}

/**
 * Enrols a customer in rewards from their own account (D-091): the role
 * becomes `loyalty_member`, the profile gets a Core membership and a fresh
 * ID token is returned so this session carries the new role.
 */
export async function joinRewards(uid: string, now: Date = new Date()): Promise<string> {
  const { auth, db } = getFirebaseAdmin();
  const user = await auth.getUser(uid);
  const claim = user.customClaims?.role;
  const current: Role = isRole(claim) ? claim : "customer";
  if (current === "loyalty_member") throw new ActionError("conflict", "You're already a member.");
  if (!canSystemGrant(current, "loyalty_member")) {
    throw new ActionError("forbidden", "This account can't join rewards.");
  }
  await auth.setCustomUserClaims(uid, { ...user.customClaims, role: "loyalty_member" });
  const ref = db.collection("users").doc(uid);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    tx.update(ref, {
      role: "loyalty_member",
      ...(snap.get("loyalty") ? {} : { loyalty: newLoyalty(now) }),
      updatedAt: now,
    });
  });
  await writeAuditLog({
    actor: { uid, role: current, email: user.email ?? null },
    action: "loyalty.join",
    target: { type: "user", id: uid },
    before: { role: current },
    after: { role: "loyalty_member" },
  });
  const token = await auth.createCustomToken(uid);
  return (await signInWithCustomToken(token)).idToken;
}
