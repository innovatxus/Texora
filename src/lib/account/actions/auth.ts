"use server";

import { z } from "zod";
import { ActionError, runAction } from "@/lib/actions/run-action";
import { safeNextPath } from "@/lib/auth/access";
import { isStaffRole, type Role } from "@/lib/auth/rbac";
import { createSession } from "@/lib/auth/session";
import { clientIp } from "@/lib/security/rate-limit";
import {
  customerForgotPasswordSchema,
  customerRegisterSchema,
  customerResetPasswordSchema,
  customerSignInSchema,
} from "@/lib/validation/account";
import {
  joinRewards,
  registerCustomer,
  requestCustomerPasswordReset,
  resetCustomerPassword,
  signInCustomer,
} from "../auth-service";

/** Staff land in the back office, merchants in their portal, shoppers in their account. */
function landingFor(role: Role, next: string | undefined): string {
  const fallback = isStaffRole(role) ? "/admin" : role === "vendor" ? "/merchant" : "/account";
  return safeNextPath(next, fallback);
}

/** Creates a customer account and signs it in on this device. */
export async function registerCustomerAction(input: unknown) {
  return runAction(input, {
    schema: customerRegisterSchema,
    access: { public: true },
    handler: async ({ next, ...details }) => {
      const { idToken } = await registerCustomer(details, await clientIp());
      const session = await createSession(idToken);
      return { redirectTo: landingFor(session.role, next) };
    },
  });
}

/** Email and password sign-in for every account type, checked on the server. */
export async function signInCustomerAction(input: unknown) {
  return runAction(input, {
    schema: customerSignInSchema,
    access: { public: true },
    handler: async ({ email, password, next }) => {
      const { idToken } = await signInCustomer(email, password, await clientIp());
      const session = await createSession(idToken);
      return { role: session.role, redirectTo: landingFor(session.role, next) };
    },
  });
}

/** Always answers the same way, so it never reveals whether an account exists. */
export async function requestPasswordResetAction(input: unknown) {
  return runAction(input, {
    schema: customerForgotPasswordSchema,
    access: { public: true },
    handler: async ({ email }) => {
      await requestCustomerPasswordReset(email, await clientIp());
      return { email };
    },
  });
}

export async function resetPasswordAction(input: unknown) {
  return runAction(input, {
    schema: customerResetPasswordSchema,
    access: { public: true },
    handler: async ({ oobCode, password }) => {
      await resetCustomerPassword(oobCode, password);
      return { redirectTo: "/auth/signin?reset=1" };
    },
  });
}

/** Joins rewards from the account; this session picks up the new role. */
export async function joinRewardsAction(input: unknown) {
  return runAction(input, {
    schema: z.object({}),
    access: { permission: "account.manage" },
    handler: async (_input, { session }) => {
      if (!session) throw new ActionError("unauthenticated", "Sign in to join rewards.");
      await createSession(await joinRewards(session.uid));
      return { joined: true };
    },
  });
}
