import type { Metadata } from "next";
import { CheckoutFrame } from "@/components/checkout/CheckoutFrame";
import { ReviewStep } from "@/components/checkout/Steps";

export const metadata: Metadata = { title: "Review your order" };

export default function Page() {
  return (
    <CheckoutFrame step="review" title="Review your order">
      <ReviewStep />
    </CheckoutFrame>
  );
}
