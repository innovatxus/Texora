"use server";

import { z } from "zod";
import { ActionError, runAction } from "@/lib/actions/run-action";
import { verifyToken } from "@/lib/orders/token";
import { cancelAlerts } from "./process";

/** Stops pending alerts for the email in a signed unsubscribe link. */
export async function unsubscribeAlerts(input: unknown) {
  return runAction(input, {
    schema: z.object({ email: z.email().max(254), token: z.string().min(1).max(128) }),
    access: { public: true },
    handler: async ({ email, token }) => {
      if (!verifyToken("unsubscribe", email, token)) {
        throw new ActionError("forbidden", "This link isn't valid. Use the link in your email.");
      }
      return { cancelled: await cancelAlerts(email) };
    },
  });
}
