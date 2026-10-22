import "server-only";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { cardPaymentsEnabled, stripeClient } from "./provider";

/** A card saved with the payment provider, as shown in the account. */
export interface SavedCard {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

const userRef = (uid: string) => getFirebaseAdmin().db.collection("users").doc(uid);

/** The shopper's Stripe customer id, created on first use (null without card payments). */
export async function ensureStripeCustomer(uid: string, email: string): Promise<string | null> {
  if (!cardPaymentsEnabled()) return null;
  const existing = (await userRef(uid).get()).get("stripeCustomerId") as string | undefined;
  if (existing) return existing;
  const customer = await stripeClient().customers.create(
    { email, metadata: { uid } },
    // One customer per account even if two checkouts race.
    { idempotencyKey: `customer-${uid}` },
  );
  await userRef(uid).update({ stripeCustomerId: customer.id });
  return customer.id;
}

/**
 * A short-lived secret letting the payment form show saved cards and offer
 * "save this card" for this customer.
 */
export async function customerSessionSecret(customer: string): Promise<string> {
  const session = await stripeClient().customerSessions.create({
    customer,
    components: {
      payment_element: {
        enabled: true,
        features: {
          payment_method_redisplay: "enabled",
          payment_method_save: "enabled",
          payment_method_remove: "enabled",
        },
      },
    },
  });
  return session.client_secret;
}

/** Cards saved to the shopper's customer (empty without card payments or a customer). */
export async function listSavedCards(uid: string): Promise<SavedCard[]> {
  if (!cardPaymentsEnabled()) return [];
  const customer = (await userRef(uid).get()).get("stripeCustomerId") as string | undefined;
  if (!customer) return [];
  const methods = await stripeClient().customers.listPaymentMethods(customer, {
    type: "card",
    limit: 20,
  });
  return methods.data.flatMap((m) =>
    m.card
      ? [
          {
            id: m.id,
            brand: m.card.brand,
            last4: m.card.last4,
            expMonth: m.card.exp_month,
            expYear: m.card.exp_year,
          },
        ]
      : [],
  );
}

/** Removes a saved card, only if it belongs to this shopper's customer. */
export async function removeSavedCard(uid: string, paymentMethodId: string): Promise<boolean> {
  if (!cardPaymentsEnabled()) return false;
  const customer = (await userRef(uid).get()).get("stripeCustomerId") as string | undefined;
  if (!customer) return false;
  const method = await stripeClient().paymentMethods.retrieve(paymentMethodId);
  if (method.customer !== customer) return false;
  await stripeClient().paymentMethods.detach(paymentMethodId);
  return true;
}
