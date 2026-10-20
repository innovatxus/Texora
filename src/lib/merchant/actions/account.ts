"use server";

import { z } from "zod";
import { ActionError, runAction } from "@/lib/actions/run-action";
import { safeNextPath } from "@/lib/auth/access";
import { isStaffRole } from "@/lib/auth/rbac";
import { createSession, getSession } from "@/lib/auth/session";
import { getStoreSettings } from "@/lib/data/admin-records";
import { clientIp, consumeRateLimit, RATE_LIMITED_MESSAGE } from "@/lib/security/rate-limit";
import {
  merchantForgotPasswordSchema,
  merchantRegisterSchema,
  merchantResetPasswordSchema,
  merchantSignInSchema,
  merchantUpgradeSchema,
  usernameSchema,
} from "@/lib/validation/merchant";
import {
  registerMerchant,
  requestMerchantPasswordReset,
  resendMerchantVerification,
  resetMerchantPassword,
  upgradeToMerchant,
  verifyMerchantCredentials,
  verifyMerchantEmail,
} from "../account-service";
import { emailForUsername, isUsernameAvailable } from "../repositories/merchants";

/** Where a new merchant goes first: the portal, which leads into shop setup. */
const AFTER_REGISTRATION = "/merchant";

async function requireMarketplaceOpen(): Promise<void> {
  const settings = await getStoreSettings();
  if (!settings.features.vendorMarketplace) {
    throw new ActionError(
      "forbidden",
      "Merchant registration is paused. Check back soon or contact merchant support.",
    );
  }
}

/** Live username check for the registration form (debounced client-side, rate-limited here). */
export async function checkUsernameAvailability(input: unknown) {
  return runAction(input, {
    schema: z.object({ username: z.string().max(64) }),
    access: { public: true },
    handler: async ({ username }) => {
      if (!(await consumeRateLimit("availability", await clientIp())).allowed) {
        throw new ActionError("limit_exceeded", RATE_LIMITED_MESSAGE);
      }
      const parsed = usernameSchema.safeParse(username);
      if (!parsed.success) {
        return {
          username: username.trim().toLowerCase(),
          available: false,
          message: parsed.error.issues[0]?.message ?? "Choose another username",
        };
      }
      const session = await getSession();
      const available = await isUsernameAvailable(parsed.data, session?.uid);
      return {
        username: parsed.data,
        available,
        message: available ? `${parsed.data} is available` : "That username is taken",
      };
    },
  });
}

/**
 * Registers a new merchant account in one idempotent step (create account,
 * reserve username, merchant record, role, verification email) and signs in.
 */
export async function registerMerchantAction(input: unknown) {
  return runAction(input, {
    schema: merchantRegisterSchema,
    access: { public: true },
    handler: async ({ email, username, password }) => {
      await requireMarketplaceOpen();
      if (!(await consumeRateLimit("register", await clientIp())).allowed) {
        throw new ActionError("limit_exceeded", RATE_LIMITED_MESSAGE);
      }
      const result = await registerMerchant({ email, username, password });
      await createSession(result.idToken);
      return { redirectTo: AFTER_REGISTRATION, email };
    },
  });
}

/** Adds a shop to the signed-in shopper's account; the session is re-minted with the new role. */
export async function upgradeToMerchantAction(input: unknown) {
  return runAction(input, {
    schema: merchantUpgradeSchema,
    access: { authenticated: true },
    handler: async ({ username }, { session }) => {
      if (!session) throw new ActionError("unauthenticated", "Please sign in to continue");
      if (session.role === "vendor") return { redirectTo: "/merchant" };
      if (session.role !== "customer" && session.role !== "loyalty_member") {
        throw new ActionError(
          "forbidden",
          "Staff accounts can't open a shop. Sign out and register with a different email.",
        );
      }
      await requireMarketplaceOpen();
      const result = await upgradeToMerchant(session.uid, username);
      await createSession(result.idToken);
      return { redirectTo: AFTER_REGISTRATION };
    },
  });
}

/**
 * Merchant sign-in by email or username. Credentials are checked on the
 * server so failures count towards a lockout. Shoppers without a shop are
 * signed in and sent to add one; staff go to the back office.
 */
export async function merchantSignInAction(input: unknown) {
  return runAction(input, {
    schema: merchantSignInSchema,
    access: { public: true },
    handler: async ({ identifier, password, next }) => {
      const { idToken } = await verifyMerchantCredentials(
        identifier,
        password,
        await clientIp(),
        emailForUsername,
      );
      const session = await createSession(idToken);
      if (session.role === "vendor") {
        const target = safeNextPath(next, "/merchant");
        const inPortal = target === "/merchant" || target.startsWith("/merchant/");
        return { redirectTo: inPortal ? target : "/merchant", role: session.role };
      }
      return {
        redirectTo: isStaffRole(session.role) ? "/admin" : "/merchant/register",
        role: session.role,
      };
    },
  });
}

/** Sends a reset link when the account exists; the reply never says whether it does. */
export async function requestMerchantPasswordResetAction(input: unknown) {
  return runAction(input, {
    schema: merchantForgotPasswordSchema,
    access: { public: true },
    handler: async ({ email }) => {
      await requestMerchantPasswordReset(email, await clientIp());
      return { email };
    },
  });
}

/** Sets a new password from a reset link and signs out every device. */
export async function resetMerchantPasswordAction(input: unknown) {
  return runAction(input, {
    schema: merchantResetPasswordSchema,
    access: { public: true },
    handler: async ({ oobCode, password }) => {
      await resetMerchantPassword(oobCode, password);
      return { redirectTo: "/merchant/sign-in?reset=1" };
    },
  });
}

/** Applies the verification link (called from the page after it loads, never by a prefetch). */
export async function verifyMerchantEmailAction(input: unknown) {
  return runAction(input, {
    schema: z.object({ oobCode: z.string().min(1).max(2000) }),
    access: { public: true },
    handler: async ({ oobCode }) => verifyMerchantEmail(oobCode),
  });
}

/** Sends another verification link, at most once a minute. */
export async function resendMerchantVerificationAction(input: unknown) {
  return runAction(input, {
    schema: z.object({}),
    access: { permission: "vendor.catalog.write" },
    handler: async (_input, { session }) => {
      if (!session?.vendorId)
        throw new ActionError("forbidden", "You don't have a merchant account");
      await resendMerchantVerification(session.uid, session.vendorId);
      return { sent: true };
    },
  });
}
