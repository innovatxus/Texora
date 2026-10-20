import "server-only";
import Stripe from "stripe";
import { serverEnv } from "@/lib/env/server";

export type PaymentMethodKind = "card" | "cod" | "none";

export interface PaymentIntentResult {
  provider: "stripe";
  ref: string;
  clientSecret: string;
}

/** Card payments behind one interface; Cash on Delivery needs no provider call. */
export interface PaymentProvider {
  createPayment(input: {
    amount: number;
    currency: string;
    email: string;
    /** What the payment is for; the webhook routes on these keys (orderId, giftCardPurchaseId). */
    metadata: Record<string, string>;
    /** Retries with the same key return the same intent. */
    idempotencyKey: string;
  }): Promise<PaymentIntentResult>;
  refund(input: { ref: string; amount: number }): Promise<{ ref: string }>;
}

let stripe: Stripe | null = null;

function stripeClient(): Stripe {
  if (!serverEnv.STRIPE_SECRET_KEY) throw new Error("Card payments are not configured");
  stripe ??= new Stripe(serverEnv.STRIPE_SECRET_KEY);
  return stripe;
}

/** Whether card payments are configured (a Stripe secret key is set). */
export const cardPaymentsEnabled = () => Boolean(serverEnv.STRIPE_SECRET_KEY);

/** Stripe implementation of the payment provider: payment intents and refunds. */
export const stripeProvider: PaymentProvider = {
  async createPayment({ amount, currency, email, metadata, idempotencyKey }) {
    const intent = await stripeClient().paymentIntents.create(
      {
        amount,
        currency: currency.toLowerCase(),
        receipt_email: email,
        automatic_payment_methods: { enabled: true },
        metadata,
      },
      { idempotencyKey },
    );
    if (!intent.client_secret) throw new Error("Payment provider returned no client secret");
    return { provider: "stripe", ref: intent.id, clientSecret: intent.client_secret };
  },
  async refund({ ref, amount }) {
    const refund = await stripeClient().refunds.create({ payment_intent: ref, amount });
    return { ref: refund.id };
  },
};

/** Verifies a webhook signature and returns the event, or throws. */
export function verifyStripeWebhook(rawBody: string, signature: string): Stripe.Event {
  if (!serverEnv.STRIPE_WEBHOOK_SECRET) throw new Error("Stripe webhook secret is not configured");
  return stripeClient().webhooks.constructEvent(
    rawBody,
    signature,
    serverEnv.STRIPE_WEBHOOK_SECRET,
  );
}
