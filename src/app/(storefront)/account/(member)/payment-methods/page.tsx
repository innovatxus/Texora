import type { Metadata } from "next";
import { PaymentMarks } from "@/components/commerce/PaymentMarks";
import { cardPaymentsEnabled } from "@/lib/payments/provider";

export const metadata: Metadata = { title: "Payment methods" };

/**
 * How shoppers can pay. Card and wallet details are entered on Paymob's
 * secure checkout and never reach us, so there is nothing stored to manage.
 */
export default function Page() {
  const online = cardPaymentsEnabled();
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-4xl">Payment methods</h1>
      <p className="max-w-prose bg-surface p-6">
        {online
          ? "Pay by Visa, Mastercard or Meeza card, with a mobile wallet such as Vodafone Cash, or in cash when your order arrives."
          : "We're taking cash on delivery for now. Card and mobile wallet payments are coming soon."}
      </p>
      <PaymentMarks />
      <p className="max-w-prose text-sm text-ink-soft">
        Card and wallet payments are processed securely by Paymob. We never see or store your card
        number.
      </p>
    </div>
  );
}
