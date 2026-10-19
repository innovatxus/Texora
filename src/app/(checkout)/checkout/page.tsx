import type { Metadata } from "next";
import { CheckoutFrame } from "@/components/checkout/CheckoutFrame";
import { ContactStep } from "@/components/checkout/Steps";

export const metadata: Metadata = { title: "Checkout" };

export default function Page() {
  return (
    <CheckoutFrame step="contact" title="Checkout">
      <ContactStep />
    </CheckoutFrame>
  );
}
