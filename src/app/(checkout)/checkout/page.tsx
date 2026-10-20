import type { Metadata } from "next";
import { CheckoutFrame } from "@/components/checkout/CheckoutFrame";
import { ContactStep } from "@/components/checkout/Steps";

/** Page title for the first checkout step. */
export const metadata: Metadata = { title: "Checkout" };

/** Checkout step 1: contact email, as a guest or signed in. */
export default function Page() {
  return (
    <CheckoutFrame step="contact" title="Checkout">
      <ContactStep />
    </CheckoutFrame>
  );
}
