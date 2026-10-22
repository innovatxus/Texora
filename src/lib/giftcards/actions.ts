"use server";

import { z } from "zod";
import { ActionError, runAction } from "@/lib/actions/run-action";
import { getSession } from "@/lib/auth/session";
import { getGiftCardByCode } from "@/lib/data/promotions";
import { addDays, businessDate } from "./codes";
import { giftCardPurchaseFormSchema } from "./schema";
import { createGiftCardPurchase } from "./service";
import { clientIp, enforceRateLimit } from "@/lib/security/rate-limit";

/**
 * Balance check. Reveals only what the card holder needs; unknown and
 * disabled cards get the same message.
 */
export async function checkGiftCardBalance(input: unknown) {
  return runAction(input, {
    schema: z.object({
      code: z
        .string()
        .trim()
        .min(8, "Enter the full gift card number")
        .max(40, "Enter the full gift card number"),
    }),
    access: { public: true },
    handler: async ({ code }) => {
      await enforceRateLimit("giftCardBalance", await clientIp());
      const card = await getGiftCardByCode(code);
      if (!card || card.status === "disabled") {
        throw new ActionError(
          "not_found",
          "We couldn't find that gift card. Check the number and try again.",
        );
      }
      const expired = card.expiresAt ? card.expiresAt.getTime() < Date.now() : false;
      return {
        last4: card.last4,
        balance: expired ? 0 : card.balance,
        status: expired ? ("expired" as const) : card.status,
        expiresAt: card.expiresAt?.toISOString() ?? null,
      };
    },
  });
}

/** Starts an e-gift card purchase and returns the card payment to complete. */
export async function startGiftCardPurchase(input: unknown) {
  return runAction(input, {
    schema: giftCardPurchaseFormSchema.extend({
      idempotencyKey: z.string().min(16).max(128),
    }),
    access: { public: true },
    handler: async (purchase) => {
      await enforceRateLimit("placeOrder", await clientIp());
      const today = businessDate(new Date());
      if (purchase.deliverOn < today || purchase.deliverOn > addDays(today, 365)) {
        throw new ActionError("conflict", "Choose a delivery date within the next year");
      }
      const { message, ...rest } = purchase;
      return createGiftCardPurchase(
        { ...rest, ...(message ? { message } : {}) },
        await getSession(),
      );
    },
  });
}
