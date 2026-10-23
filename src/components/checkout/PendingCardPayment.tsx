"use client";

import { useState } from "react";
import { Button } from "@/components/primitives";
import { PaymentMarks } from "@/components/commerce/PaymentMarks";
import { useStorageItem } from "@/lib/browser/hooks";
import { formatMoney } from "@/lib/format/money";

/** sessionStorage key holding a payment's Paymob checkout link, for this tab only. */
export const CHECKOUT_URL_KEY = (id: string) => `texora-pay-${id}`;

/** Only Paymob's own checkout is ever opened from the stored link. */
const isPaymobCheckout = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && /(^|\.)paymob\.com$/.test(url.hostname);
  } catch {
    return false;
  }
};

/**
 * Completes an online payment: the review step handed this tab a link to
 * Paymob's hosted checkout (cards, Meeza, mobile wallets). Paymob returns
 * the shopper here; the page updates once Paymob confirms the payment.
 */
export function PendingCardPayment({ orderId, amount }: { orderId: string; amount: number }) {
  const checkoutUrl = useStorageItem("session", CHECKOUT_URL_KEY(orderId));
  const [leaving, setLeaving] = useState(false);
  if (checkoutUrl === undefined) return null;
  if (!checkoutUrl || !isPaymobCheckout(checkoutUrl)) {
    return (
      <p className="text-sm text-ink-soft">
        We&apos;re confirming your payment. This page updates when it&apos;s complete; refresh in a
        moment.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-5">
      <Button
        size="lg"
        loading={leaving}
        className="self-start"
        onClick={() => {
          setLeaving(true);
          window.location.assign(checkoutUrl);
        }}
      >
        Pay {formatMoney(amount)}
      </Button>
      <PaymentMarks />
      <p className="text-sm text-ink-soft">
        You&apos;ll pay on Paymob&apos;s secure page by card or mobile wallet, then come back here.
      </p>
    </div>
  );
}
