import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { DetailsAccordion } from "@/components/pdp/DetailsAccordion";
import { ButtonLink, Link } from "@/components/primitives";
import { brand } from "@/config/brand";
import { MERCHANT_FEES, MERCHANT_LANDING } from "@/config/merchant";

const { hero, steps, benefits, requirements, faq, finalCta } = MERCHANT_LANDING;

/** Title, description and canonical URL for the merchant landing page. */
export const metadata: Metadata = {
  title: `Sell on ${brand.name}`,
  description: hero.body,
  alternates: { canonical: "/merchants" },
};

const formatFee = (cents: number) => (cents === 0 ? "None" : `$${(cents / 100).toFixed(2)}`);

/**
 * Public, statically rendered landing page for prospective merchants. All copy
 * comes from `src/config/merchant.ts`. One primary CTA per viewport: the hero
 * and the closing section; everything between uses text links.
 */
export default function Page() {
  return (
    <div className="pb-24">
      <div className="container-page pt-6">
        <Breadcrumbs items={[{ label: hero.title, href: "/merchants" }]} />
      </div>

      <section aria-labelledby="merchants-hero" className="container-page pt-10 pb-16 lg:pt-16">
        <p className="text-label text-ink-soft">{hero.eyebrow}</p>
        <h1 id="merchants-hero" className="mt-4 max-w-3xl font-display text-5xl lg:text-7xl">
          {hero.title}
        </h1>
        <p className="mt-6 max-w-xl text-lg text-ink-soft">{hero.body}</p>
        <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
          <ButtonLink href="/merchant/register" size="lg">
            {hero.cta}
          </ButtonLink>
          <Link href="/merchant/sign-in">{hero.secondary}</Link>
        </div>
      </section>

      <section aria-labelledby="how-it-works" className="border-y border-line bg-surface">
        <div className="container-page section-y">
          <h2 id="how-it-works" className="font-display text-3xl lg:text-4xl">
            How it works
          </h2>
          <ol className="mt-10 grid gap-10 md:grid-cols-3">
            {steps.map((step, i) => (
              <li key={step.title} className="flex flex-col gap-3">
                <span aria-hidden="true" className="font-display text-4xl text-ink-subtle">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="text-label">{step.title}</h3>
                <p className="text-ink-soft">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="what-you-get" className="container-page section-y">
        <h2 id="what-you-get" className="font-display text-3xl lg:text-4xl">
          What you get
        </h2>
        <ul className="mt-10 grid gap-8 md:grid-cols-3">
          {benefits.map((benefit) => (
            <li key={benefit.title} className="border-t border-line-strong pt-6">
              <h3 className="text-lg font-medium">{benefit.title}</h3>
              <p className="mt-2 text-ink-soft">{benefit.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="fees" className="bg-surface-muted">
        <div className="container-page grid gap-12 section-y lg:grid-cols-2">
          <div>
            <h2 id="fees" className="font-display text-3xl lg:text-4xl">
              Fees
            </h2>
            <dl className="mt-8 grid grid-cols-3 gap-6 border-t border-line pt-6">
              <div>
                <dt className="text-label text-ink-soft">Commission</dt>
                <dd className="mt-2 font-display text-3xl">{MERCHANT_FEES.commissionPercent}%</dd>
              </div>
              <div>
                <dt className="text-label text-ink-soft">Monthly fee</dt>
                <dd className="mt-2 font-display text-3xl">
                  {formatFee(MERCHANT_FEES.monthlyFee)}
                </dd>
              </div>
              <div>
                <dt className="text-label text-ink-soft">Listing fee</dt>
                <dd className="mt-2 font-display text-3xl">
                  {formatFee(MERCHANT_FEES.listingFee)}
                </dd>
              </div>
            </dl>
            <p className="mt-6 max-w-prose text-sm text-ink-soft">
              Commission is charged on the item price of each sale. Read the{" "}
              <Link href="/help/merchants/terms">merchant terms</Link>.
            </p>
          </div>
          <div>
            <h2 className="font-display text-3xl lg:text-4xl">Requirements</h2>
            <ul className="mt-8 flex list-disc flex-col gap-3 border-t border-line pt-6 pl-5 text-ink-soft">
              {requirements.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section aria-labelledby="merchant-faq" className="container-page section-y">
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <h2 id="merchant-faq" className="font-display text-3xl lg:text-4xl">
              Questions
            </h2>
            <p className="mt-4 text-ink-soft">
              More in <Link href="/help/merchants">merchant help</Link>.
            </p>
          </div>
          <div className="lg:col-span-8">
            <DetailsAccordion
              defaultOpen={[]}
              sections={faq.map((entry, i) => ({
                id: `faq-${i}`,
                title: entry.question,
                content: <p className="max-w-prose">{entry.answer}</p>,
              }))}
            />
          </div>
        </div>
      </section>

      <section aria-labelledby="merchant-cta" className="bg-ink text-canvas">
        <div className="container-page flex flex-col items-start gap-8 section-y md:flex-row md:items-center md:justify-between">
          <h2 id="merchant-cta" className="font-display text-4xl">
            {finalCta.title}
          </h2>
          <ButtonLink href="/merchant/register" size="lg" variant="inverse">
            {finalCta.cta}
          </ButtonLink>
        </div>
      </section>
    </div>
  );
}
