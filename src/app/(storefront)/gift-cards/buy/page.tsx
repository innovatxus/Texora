import type { Metadata } from "next";
import { GiftCardPurchaseForm } from "@/components/giftcards/GiftCardPurchaseForm";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { cardPaymentsEnabled } from "@/lib/payments/provider";

/** Title and canonical URL for the e-gift card form. */
export const metadata: Metadata = {
  title: "Send an e-gift card",
  alternates: { canonical: "/gift-cards/buy" },
};

/** E-gift card purchase form. Disabled with an explanation when card payments aren't configured. */
export default function Page() {
  return (
    <div className="container-page pt-6 pb-24">
      <Breadcrumbs
        items={[
          { label: "Gift cards", href: "/gift-cards" },
          { label: "Send an e-gift card", href: "/gift-cards/buy" },
        ]}
      />
      <h1 className="mt-8 font-display text-5xl">Send an e-gift card</h1>
      <p className="mt-4 max-w-prose text-ink-soft">
        We email the card to the recipient on the day you choose, and send you a receipt.
      </p>
      <div className="mt-10">
        <GiftCardPurchaseForm available={cardPaymentsEnabled()} />
      </div>
    </div>
  );
}
