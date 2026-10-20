"use client";

import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/primitives";
import { clientEnv } from "@/lib/env/client";
import { formatMoney } from "@/lib/format/money";

let stripePromise: Promise<Stripe | null> | null = null;
const getStripe = () => {
  const key = clientEnv.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!key) return null;
  stripePromise ??= loadStripe(key);
  return stripePromise;
};

/** sessionStorage key holding a payment's client secret for this tab only. */
export const CLIENT_SECRET_KEY = (orderId: string) => `texora-pay-${orderId}`;

function PayForm({ amount, returnUrl }: { amount: number; returnUrl: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true);
    setError(null);
    const result = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
    });
    // On success the browser is redirected; we only get here on an error.
    setBusy(false);
    setError(result.error.message ?? "Payment could not be completed. Please try another card.");
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <PaymentElement />
      {error && (
        <p role="alert" className="text-sm text-sale">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" loading={busy} disabled={!stripe}>
        Pay {formatMoney(amount)}
      </Button>
    </form>
  );
}

/** Provider-hosted card fields; card data never touches our servers. */
export function CardPayment({
  clientSecret,
  amount,
  returnUrl,
}: {
  clientSecret: string;
  amount: number;
  returnUrl: string;
}) {
  const stripe = getStripe();
  if (!stripe)
    return <p className="text-sm text-sale">Card payments are not available right now.</p>;
  return (
    <Elements
      stripe={stripe}
      options={{
        clientSecret,
        appearance: {
          theme: "flat",
          variables: {
            colorPrimary: "#1a1a1a",
            colorBackground: "#ffffff",
            colorText: "#1a1a1a",
            borderRadius: "0px",
            fontFamily: "Inter, system-ui, sans-serif",
          },
        },
      }}
    >
      <PayForm amount={amount} returnUrl={returnUrl} />
    </Elements>
  );
}
