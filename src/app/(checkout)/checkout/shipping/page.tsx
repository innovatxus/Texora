import type { Metadata } from "next";
import { CheckoutFrame } from "@/components/checkout/CheckoutFrame";
import { ShippingStep } from "@/components/checkout/Steps";

/** Page title for the shipping step. */
export const metadata: Metadata = { title: "Shipping address" };

/** Checkout step 2: shipping address. */
export default function Page() {
  return (
    <CheckoutFrame step="shipping" title="Shipping address">
      <ShippingStep />
    </CheckoutFrame>
  );
}
