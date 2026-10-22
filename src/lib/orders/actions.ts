"use server";

import { runAction } from "@/lib/actions/run-action";
import { getSession } from "@/lib/auth/session";
import { getStoreSettings } from "@/lib/data/admin-records";
import { cardPaymentsEnabled } from "@/lib/payments/provider";
import { z } from "zod";
import { placeOrderSchema } from "./checkout-schema";
import { placeOrder } from "./place-order";
import { listAddresses } from "@/lib/account/account-service";
import { clientIp, enforceRateLimit } from "@/lib/security/rate-limit";

/** Places the order. Guests and signed-in customers; the session only adds rewards and history. */
export async function submitOrder(input: unknown) {
  return runAction(input, {
    schema: placeOrderSchema,
    access: { public: true },
    handler: async (order) => {
      await enforceRateLimit("placeOrder", await clientIp());
      return placeOrder(order, await getSession({ checkRevoked: true }));
    },
  });
}

/** What checkout can offer: payment methods and shipping rates. */
export async function getCheckoutOptions(input: unknown) {
  return runAction(input, {
    schema: z.object({}).default({}),
    access: { public: true },
    handler: async () => {
      const [settings, session] = await Promise.all([getStoreSettings(), getSession()]);
      const signedIn = Boolean(session && session.role !== "guest");
      // Saved addresses, default shipping first, for one-tap selection at checkout.
      const addresses = signedIn && session ? await listAddresses(session.uid) : [];
      return {
        cardPayments: cardPaymentsEnabled(),
        cashOnDelivery: settings.features.cashOnDelivery,
        rates: settings.shippingRates,
        freeShippingThreshold: settings.freeShippingThreshold,
        signedIn,
        email: session?.email ?? null,
        addresses: addresses.map(
          ({ id, label, isDefaultShipping, isDefaultBilling: _billing, ...address }) => ({
            id,
            label: label ?? null,
            isDefaultShipping,
            address: { ...address, country: "US" as const },
          }),
        ),
      };
    },
  });
}
