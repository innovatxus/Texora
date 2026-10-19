import type { Metadata } from "next";
import { CheckoutFrame } from "@/components/checkout/CheckoutFrame";
import { DeliveryStep } from "@/components/checkout/Steps";

export const metadata: Metadata = { title: "Delivery" };

export default function Page() {
  return (
    <CheckoutFrame step="delivery" title="Delivery">
      <DeliveryStep />
    </CheckoutFrame>
  );
}
