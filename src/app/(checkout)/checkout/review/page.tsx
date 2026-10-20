import type { Metadata } from "next";
import { CheckoutFrame } from "@/components/checkout/CheckoutFrame";
import { ReviewStep } from "@/components/checkout/Steps";

/** Page title for the review step. */
export const metadata: Metadata = { title: "Review your order" };

/** Checkout step 5: review everything and place the order. */
export default function Page() {
  return (
    <CheckoutFrame step="review" title="Review your order">
      <ReviewStep />
    </CheckoutFrame>
  );
}
