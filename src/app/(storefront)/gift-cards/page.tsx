import type { Metadata } from "next";
import { GiftCardBalanceForm } from "@/components/giftcards/GiftCardBalanceForm";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { ButtonLink, Link } from "@/components/primitives";
import { brand } from "@/config/brand";

/** Title, description and canonical URL for the gift cards page. */
export const metadata: Metadata = {
  title: "Gift cards",
  description: `Send a ${brand.name} e-gift card by email, or check the balance of a card.`,
  alternates: { canonical: "/gift-cards" },
};

/** Gift cards landing: send an e-gift card, or check a card's balance. */
export default function Page() {
  return (
    <div className="container-page pt-6 pb-24">
      <Breadcrumbs items={[{ label: "Gift cards", href: "/gift-cards" }]} />
      <div className="mt-8 grid gap-12 lg:grid-cols-2">
        <section aria-labelledby="send-title">
          <h1 className="font-display text-5xl">Gift cards</h1>
          <p className="mt-4 max-w-prose text-ink-soft">
            The easy way to get the fit right. Send an e-gift card from EGP 250 to EGP 25,000 with
            your own message, today or on the day that matters.
          </p>
          <div className="mt-8 flex aspect-[1.586] max-w-md flex-col justify-between bg-ink p-8 text-canvas">
            <span className="font-display text-2xl tracking-[0.28em] text-brand uppercase">
              {brand.name}
            </span>
            <span className="font-display text-5xl">E-gift card</span>
          </div>
          <h2 id="send-title" className="sr-only">
            Send an e-gift card
          </h2>
          <ButtonLink href="/gift-cards/buy" size="lg" className="mt-8">
            Send an e-gift card
          </ButtonLink>
        </section>

        <div className="flex flex-col gap-10">
          <section id="balance" aria-labelledby="balance-title" className="scroll-mt-24">
            <h2 id="balance-title" className="font-display text-3xl">
              Check your balance
            </h2>
            <p className="mt-3 text-sm text-ink-soft">
              Enter the number from your gift card email.
            </p>
            <div className="mt-6">
              <GiftCardBalanceForm />
            </div>
          </section>

          <section aria-labelledby="gc-faq" className="bg-surface p-6 text-sm">
            <h2 id="gc-faq" className="text-label">
              Good to know
            </h2>
            <ul className="mt-4 flex list-disc flex-col gap-2 pl-5 text-ink-soft">
              <li>Use your gift card at checkout, across as many orders as you like.</li>
              <li>Gift cards are valid for five years and can&apos;t be exchanged for cash.</li>
              <li>
                Lost your gift card email? <Link href="/help/contact">Contact us</Link> with the
                buyer&apos;s email and we&apos;ll help.
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
