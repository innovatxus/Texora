import type { Metadata } from "next";
import { CheckoutFrame } from "@/components/checkout/CheckoutFrame";
import { PaymentStep } from "@/components/checkout/Steps";

/** Page title for the payment step. */
export const metadata: Metadata = { title: "Payment" };

/** Checkout step 4: payment method, gift card, rewards and billing address. */
export default function Page() {
  return (
    <CheckoutFrame step="payment" title="Payment">
      <PaymentStep />
    </CheckoutFrame>
  );
}
