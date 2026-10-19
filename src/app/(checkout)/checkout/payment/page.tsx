import type { Metadata } from "next";
import { CheckoutFrame } from "@/components/checkout/CheckoutFrame";
import { PaymentStep } from "@/components/checkout/Steps";

export const metadata: Metadata = { title: "Payment" };

export default function Page() {
  return (
    <CheckoutFrame step="payment" title="Payment">
      <PaymentStep />
    </CheckoutFrame>
  );
}
