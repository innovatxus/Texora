import Image from "next/image";
import NextLink from "next/link";
import { accentColor } from "@/config/merchant";
import type { PublicShop } from "@/lib/merchant/storefront";
import { returnSummary } from "@/lib/merchant/storefront";

/** PDP "Sold by": the shop's logo and name, where it ships from, its return policy and a link to it. */
export function SoldByBlock({ shop }: { shop: PublicShop }) {
  const { shop: s, shipsFrom } = shop;
  return (
    <section aria-labelledby="sold-by" className="flex items-start gap-4 border-y border-line py-5">
      <div className="relative size-12 shrink-0 overflow-hidden rounded-full bg-surface-muted">
        {s.logo ? (
          <Image src={s.logo.url} alt="" fill sizes="48px" className="object-cover" />
        ) : (
          <span
            aria-hidden="true"
            className="flex size-full items-center justify-center font-display text-xl text-surface"
            style={{ background: accentColor(s.accent) }}
          >
            {s.name.slice(0, 1)}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1 text-sm">
        <h2 id="sold-by" className="text-label text-ink-soft">
          Sold by
        </h2>
        <p className="font-medium text-ink">{s.name}</p>
        {shipsFrom && <p className="text-ink-soft">Ships from {shipsFrom}</p>}
        <p className="text-ink-soft">{returnSummary(s.returnPolicy)}</p>
        <NextLink
          href={`/shops/${s.slug}`}
          className="mt-1 self-start underline underline-offset-4"
        >
          Visit shop<span className="sr-only"> {s.name}</span>
        </NextLink>
      </div>
    </section>
  );
}
