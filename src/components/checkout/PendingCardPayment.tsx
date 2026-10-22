"use client";

import { useStorageItem } from "@/lib/browser/hooks";
import { CardPayment, CLIENT_SECRET_KEY, CUSTOMER_SESSION_KEY } from "./CardPayment";

/** Completes a card order: the client secret was handed over by the review step for this tab only. */
export function PendingCardPayment({
  orderId,
  amount,
  returnUrl,
}: {
  orderId: string;
  amount: number;
  returnUrl: string;
}) {
  const clientSecret = useStorageItem("session", CLIENT_SECRET_KEY(orderId));
  const customerSession = useStorageItem("session", CUSTOMER_SESSION_KEY(orderId));
  if (clientSecret === undefined) return null;
  if (!clientSecret) {
    return (
      <p className="text-sm text-ink-soft">
        We&apos;re confirming your payment. This page updates when it&apos;s complete; refresh in a
        moment.
      </p>
    );
  }
  return (
    <CardPayment
      clientSecret={clientSecret}
      customerSessionClientSecret={customerSession ?? null}
      amount={amount}
      returnUrl={returnUrl}
    />
  );
}
