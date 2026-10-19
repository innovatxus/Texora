"use server";

import { runAction } from "@/lib/actions/run-action";
import { getSession } from "@/lib/auth/session";
import { getStoreSettings } from "@/lib/data/admin-records";
import { cardPaymentsEnabled } from "@/lib/payments/provider";
import { z } from "zod";
import { placeOrderSchema } from "./checkout-schema";
import { placeOrder } from "./place-order";

/** Places the order. Guests and signed-in customers; the session only adds rewards and history. */
export async function submitOrder(input: unknown) {
  return runAction(input, {
    schema: placeOrderSchema,
    access: { public: true },
    handler: async (order) => placeOrder(order, await getSession({ checkRevoked: true })),
  });
}

/** What checkout can offer: payment methods and shipping rates. */
export async function getCheckoutOptions(input: unknown) {
  return runAction(input, {
    schema: z.object({}).default({}),
    access: { public: true },
    handler: async () => {
      const [settings, session] = await Promise.all([getStoreSettings(), getSession()]);
      return {
        cardPayments: cardPaymentsEnabled(),
        cashOnDelivery: settings.features.cashOnDelivery,
        rates: settings.shippingRates,
        freeShippingThreshold: settings.freeShippingThreshold,
        signedIn: Boolean(session && session.role !== "guest"),
        email: session?.email ?? null,
      };
    },
  });
}
