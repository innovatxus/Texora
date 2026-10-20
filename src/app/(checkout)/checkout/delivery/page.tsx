import type { Metadata } from "next";
import { CheckoutFrame } from "@/components/checkout/CheckoutFrame";
import { DeliveryStep } from "@/components/checkout/Steps";

/** Page title for the delivery step. */
export const metadata: Metadata = { title: "Delivery" };

/** Checkout step 3: choose standard or express delivery. */
export default function Page() {
  return (
    <CheckoutFrame step="delivery" title="Delivery">
      <DeliveryStep />
    </CheckoutFrame>
  );
}
