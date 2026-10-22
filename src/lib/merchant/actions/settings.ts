"use server";

import { z } from "zod";
import { ActionError, runAction } from "@/lib/actions/run-action";
import { createSession, destroySession, type Session } from "@/lib/auth/session";
import {
  merchantAccountSettingsSchema,
  merchantChangePasswordSchema,
  merchantNotificationSettingsSchema,
} from "@/lib/validation/merchant";
import {
  changeEmail,
  changePassword,
  changeUsername,
  updateDisplayName,
  updateNotifications,
} from "../settings-service";
import type { MerchantActor } from "../shop-service";

function actorOf(session: Session | null): MerchantActor {
  if (!session?.vendorId) throw new ActionError("forbidden", "You don't have a merchant account");
  return { session, vendorId: session.vendorId };
}

/** Account details: display name, email (re-verified) and username (30-day limit). */
export async function updateAccountAction(input: unknown) {
  return runAction(input, {
    schema: merchantAccountSettingsSchema,
    access: { permission: "vendor.catalog.write" },
    handler: async ({ displayName, email, username }, { session }) => {
      const actor = actorOf(session);
      await updateDisplayName(actor, displayName);
      await changeUsername(actor, username);
      await changeEmail(actor, email);
      return { saved: true };
    },
  });
}

/** Changes the password; other devices are signed out, this one stays signed in. */
export async function changePasswordAction(input: unknown) {
  return runAction(input, {
    schema: merchantChangePasswordSchema,
    access: { permission: "vendor.catalog.write" },
    handler: async ({ currentPassword, newPassword }, { session }) => {
      const idToken = await changePassword(actorOf(session), currentPassword, newPassword);
      await createSession(idToken);
      return { changed: true };
    },
  });
}

/** Signs out of every device, including this one. */
export async function signOutEverywhereAction(input: unknown) {
  return runAction(input, {
    schema: z.object({}),
    access: { permission: "vendor.catalog.write" },
    handler: async () => {
      await destroySession({ everywhere: true });
      return { redirectTo: "/merchant/sign-in" };
    },
  });
}

/** Optional email preferences. */
export async function updateNotificationsAction(input: unknown) {
  return runAction(input, {
    schema: merchantNotificationSettingsSchema,
    access: { permission: "vendor.catalog.write" },
    handler: async (prefs, { session }) => {
      await updateNotifications(actorOf(session), prefs);
      return { saved: true };
    },
  });
}
