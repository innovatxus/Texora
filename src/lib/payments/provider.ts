import "server-only";
import { randomBytes } from "node:crypto";
import { COUNTRY } from "@/config/locale";
import { clientEnv } from "@/lib/env/client";
import { serverEnv } from "@/lib/env/server";
import { logger } from "@/lib/observability/logger";
import { paymentReference, type PaymentSubject } from "./paymob";

export type PaymentMethodKind = "card" | "cod" | "none";

export interface PaymentResult {
  provider: "paymob";
  /** Paymob's intention id; replaced by the transaction id once paid. */
  ref: string;
  /** Paymob's hosted checkout (cards, wallets…) for this payment. */
  checkoutUrl: string;
}

/** Who pays, as Paymob's billing data needs it. */
export interface Payer {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  city?: string | undefined;
  street?: string | undefined;
  region?: string | undefined;
}

/** Online payments behind one interface; Cash on Delivery needs no provider call. */
export interface PaymentProvider {
  createPayment(input: {
    amount: number;
    currency: string;
    payer: Payer;
    /** What the payment is for; the callback routes on it. */
    subject: PaymentSubject;
    /** Where the shopper returns after paying. */
    returnUrl: string;
    /** Shown on Paymob's checkout. */
    description: string;
  }): Promise<PaymentResult>;
  refund(input: { ref: string; amount: number }): Promise<{ ref: string }>;
}

/** Whether online payments are configured (a Paymob secret key is set). */
export const cardPaymentsEnabled = () => Boolean(serverEnv.PAYMOB_SECRET_KEY);

function credentials() {
  const { PAYMOB_SECRET_KEY, PAYMOB_PUBLIC_KEY, PAYMOB_INTEGRATION_IDS } = serverEnv;
  if (!PAYMOB_SECRET_KEY || !PAYMOB_PUBLIC_KEY || !PAYMOB_INTEGRATION_IDS)
    throw new Error("Online payments are not configured");
  return { secret: PAYMOB_SECRET_KEY, publicKey: PAYMOB_PUBLIC_KEY, ids: PAYMOB_INTEGRATION_IDS };
}

async function paymob<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(new URL(path, serverEnv.PAYMOB_API_BASE), {
    method: "POST",
    headers: {
      Authorization: `Token ${credentials().secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    // Paymob's error bodies describe the request, never card data; log the status only.
    logger.error("paymob.request_failed", { path, status: response.status });
    throw new Error("The payment provider didn't accept the request");
  }
  return (await response.json()) as T;
}

/** Paymob implementation: payment intentions with hosted checkout, and refunds. */
export const paymobProvider: PaymentProvider = {
  async createPayment({ amount, currency, payer, subject, returnUrl, description }) {
    const { publicKey, ids } = credentials();
    const intention = await paymob<{ id: string; client_secret: string }>("/v1/intention/", {
      amount,
      currency,
      payment_methods: ids,
      items: [{ name: description.slice(0, 50), amount, quantity: 1 }],
      billing_data: {
        first_name: payer.firstName,
        last_name: payer.lastName,
        email: payer.email,
        phone_number: payer.phone,
        street: payer.street || "NA",
        building: "NA",
        apartment: "NA",
        floor: "NA",
        city: payer.city || "NA",
        state: payer.region || "NA",
        country: COUNTRY,
      },
      special_reference: paymentReference(subject, randomBytes(6).toString("hex")),
      notification_url: new URL("/api/webhooks/paymob", clientEnv.NEXT_PUBLIC_SITE_URL).toString(),
      redirection_url: returnUrl,
    });
    const checkout = new URL("/unifiedcheckout/", serverEnv.PAYMOB_API_BASE);
    checkout.searchParams.set("publicKey", publicKey);
    checkout.searchParams.set("clientSecret", intention.client_secret);
    return { provider: "paymob", ref: String(intention.id), checkoutUrl: checkout.toString() };
  },
  async refund({ ref, amount }) {
    const refund = await paymob<{ id: number | string }>("/api/acceptance/void_refund/refund", {
      transaction_id: ref,
      amount_cents: amount,
    });
    return { ref: String(refund.id) };
  },
};
