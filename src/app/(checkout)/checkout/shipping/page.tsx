import type { Metadata } from "next";
import { CheckoutFrame } from "@/components/checkout/CheckoutFrame";
import { ShippingStep } from "@/components/checkout/Steps";

export const metadata: Metadata = { title: "Shipping address" };

export default function Page() {
  return (
    <CheckoutFrame step="shipping" title="Shipping address">
      <ShippingStep />
    </CheckoutFrame>
  );
}
