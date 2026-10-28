"use client";

import NextLink from "next/link";
import { useEffect, useState } from "react";
import { PriceDisplay } from "@/components/commerce/PriceDisplay";
import { ProductImage } from "@/components/commerce/ProductImage";
import { ErrorState } from "@/components/feedback/ErrorState";
import { Button, ButtonLink, Link, Skeleton } from "@/components/primitives";
import { getPricedBag } from "@/lib/bag/actions";
import { isAvailableLine, type BagLineView } from "@/lib/bag/types";
import { useBagHydrated, useBagStore } from "@/stores/bag";
import {
  BagLineItem,
  FreeShippingProgress,
  OrderSummary,
  PromoCodeField,
  Redemptions,
} from "./BagParts";
import { useBagPricing } from "./useBagPricing";

/** Saved-for-later items, priced on their own so they never affect totals. */
function SavedForLater() {
  const saved = useBagStore((s) => s.savedForLater);
  const moveToBag = useBagStore((s) => s.moveToBag);
  const removeSaved = useBagStore((s) => s.removeSaved);
  const [views, setViews] = useState<BagLineView[]>([]);
  const key = saved.map((l) => l.sku).join(",");

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    void getPricedBag({ lines: key.split(",").map((sku) => ({ sku, quantity: 1 })) }).then(
      (result) => {
        if (!cancelled && result.ok) setViews(result.data.lines.filter(isAvailableLine));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [key]);

  if (saved.length === 0) return null;
  return (
    <section aria-labelledby="saved-title" className="mt-14">
      <h2 id="saved-title" className="text-label">
        Saved for later ({saved.length})
      </h2>
      <ul className="mt-6 grid gap-6 sm:grid-cols-2">
        {saved.map((line) => {
          const view = views.find((v) => v.sku === line.sku);
          return (
            <li key={line.sku} className="flex gap-4">
              {view ? (
                <>
                  <NextLink
                    href={`/product/${view.slug}?color=${view.colorCode}`}
                    className="relative aspect-3/4 w-24 shrink-0"
                  >
                    <ProductImage src={view.image} alt={view.name} fill sizes="96px" />
                  </NextLink>
                  <div className="flex flex-col gap-1 text-sm">
                    <p className="font-medium">{view.name}</p>
                    <p className="text-ink-soft">
                      {view.colorName} · Size {view.size.replace("x", " × ")}
                    </p>
                    <PriceDisplay
                      size="sm"
                      price={view.unitPrice}
                      compareAtPrice={view.compareAtPrice}
                    />
                    <div className="mt-2 flex gap-4 text-xs">
                      <button
                        type="button"
                        onClick={() => moveToBag(line.sku)}
                        className="underline underline-offset-4"
                      >
                        Move to bag
                      </button>
                      <button
                        type="button"
                        onClick={() => removeSaved(line.sku)}
                        className="underline underline-offset-4"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <Skeleton shape="product" className="w-24" />
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Full bag: server-priced lines with inline edits, saved for later, promo codes, redemptions and summary. */
export function BagPage() {
  const { bag, pending, empty, error } = useBagPricing();
  const remove = useBagStore((s) => s.remove);
  const hydrated = useBagHydrated();

  if (!hydrated) {
    return (
      <div className="container-page pt-10 pb-24" aria-busy="true">
        <Skeleton shape="text" className="h-12 w-64" />
        <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_24rem]">
          <Skeleton className="h-64" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  if (empty) {
    return (
      <>
        <ErrorState
          layout="page"
          title="Your bag is empty"
          description="Find something you'll wear for years."
          actions={
            <>
              <ButtonLink href="/women">Shop women</ButtonLink>
              <ButtonLink href="/men" variant="secondary">
                Shop men
              </ButtonLink>
            </>
          }
        />
        <div className="container-page">
          <SavedForLater />
        </div>
      </>
    );
  }

  const lines = bag?.lines ?? [];
  const unavailable = lines.filter((l) => !isAvailableLine(l));
  const hasBlocking =
    lines.some((l) => isAvailableLine(l) && l.issue === "out_of_stock") || unavailable.length > 0;

  return (
    <div className="container-page pt-10 pb-24">
      <h1 className="font-display text-5xl">Your bag</h1>
      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_24rem] lg:gap-16">
        <div aria-busy={pending}>
          {error && (
            <p role="alert" className="mb-6 text-sale">
              {error}
            </p>
          )}
          {bag && (
            <FreeShippingProgress
              remaining={bag.freeShippingRemaining}
              threshold={bag.freeShippingThreshold}
            />
          )}
          {!bag ? (
            <div className="mt-8 flex flex-col gap-8">
              {[0, 1].map((i) => (
                <div key={i} className="flex gap-4">
                  <Skeleton shape="product" className="w-28" />
                  <div className="flex flex-1 flex-col gap-2">
                    <Skeleton shape="text" className="w-2/3" />
                    <Skeleton shape="text" className="w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <ul className="mt-8 flex flex-col divide-y divide-line border-y border-line">
              {lines.map((line) =>
                isAvailableLine(line) ? (
                  <li key={line.sku} className="py-6">
                    <BagLineItem line={line} />
                  </li>
                ) : (
                  <li key={line.sku} className="flex items-center justify-between py-6 text-sm">
                    <span className="text-sale">An item in your bag is no longer available.</span>
                    <Button variant="tertiary" onClick={() => remove(line.sku)}>
                      Remove
                    </Button>
                  </li>
                ),
              )}
            </ul>
          )}
          <SavedForLater />
        </div>

        <aside className="flex flex-col gap-6 lg:sticky lg:top-24 lg:self-start">
          {bag && (
            <OrderSummary bag={bag} shippingLabel="Estimated shipping">
              {hasBlocking && (
                <p role="alert" className="text-sm text-sale">
                  Update the items marked above to continue.
                </p>
              )}
              {hasBlocking ? (
                <Button size="lg" fullWidth disabled>
                  Checkout
                </Button>
              ) : (
                <ButtonLink href="/checkout" size="lg" fullWidth>
                  Checkout
                </ButtonLink>
              )}
              {!bag.signedIn && (
                <p className="text-center text-xs text-ink-soft">
                  <Link href="/auth/signin?next=/bag">Sign in</Link> to save your bag and use
                  rewards.
                </p>
              )}
            </OrderSummary>
          )}
          <div className="flex flex-col gap-6 bg-surface p-5 md:p-6">
            <PromoCodeField bag={bag} />
            <Redemptions bag={bag} />
          </div>
          <p className="text-center text-xs text-ink-subtle">
            Free returns within 14 days. Secure checkout.
          </p>
        </aside>
      </div>
    </div>
  );
}
