"use client";

import NextLink from "next/link";
import { useEffect, useState } from "react";
import { ProductCard } from "@/components/commerce/ProductCard";
import { FormMessage } from "@/components/merchant/forms/ErrorSummary";
import { Button, ButtonLink, Skeleton } from "@/components/primitives";
import { getWishlistProducts } from "@/lib/account/actions/wishlist";
import type { ListingProduct } from "@/lib/catalog/listing-types";
import { formatMoney } from "@/lib/format/money";
import { useWishlistHydrated, useWishlistStore } from "@/stores/wishlist";

function useProducts(ids: readonly string[], ready: boolean) {
  const key = ids.join(",");
  const [state, setState] = useState<{ key: string; products: ListingProduct[] } | null>(null);
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    void getWishlistProducts({ ids: key ? key.split(",") : [] }).then((result) => {
      if (!cancelled) setState({ key, products: result.ok ? result.data.products : [] });
    });
    return () => {
      cancelled = true;
    };
  }, [key, ready]);
  return state?.key === key ? state.products : null;
}

/** Saved items with price-drop notes, quick add to bag, remove and share. */
export function WishlistView({ signedIn }: { signedIn: boolean }) {
  const hydrated = useWishlistHydrated();
  const items = useWishlistStore((s) => s.items);
  const remove = useWishlistStore((s) => s.remove);
  const products = useProducts(
    items.map((i) => i.productId),
    hydrated,
  );
  const [copied, setCopied] = useState<string | null>(null);

  if (!hydrated || products === null) {
    return (
      <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="aspect-3/4" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-start gap-4 bg-surface p-6">
        <p>Your wishlist is empty. Tap the heart on any product to save it here.</p>
        <ButtonLink href="/" variant="secondary">
          Start shopping
        </ButtonLink>
      </div>
    );
  }

  const gone = items.filter((i) => !products.some((p) => p.id === i.productId));
  const share = async () => {
    const url = new URL("/account/wishlist", window.location.origin);
    url.searchParams.set("items", items.map((i) => i.productId).join(","));
    // Not every browser has a share sheet; copy the link where there isn't one.
    const nav = navigator as Navigator & { share?: Navigator["share"] };
    try {
      if (nav.share) {
        await nav.share({ title: "My wishlist", url: url.toString() });
      } else {
        await navigator.clipboard.writeText(url.toString());
        setCopied("Link copied. Anyone with it can see this list.");
      }
    } catch {
      // The share sheet was dismissed.
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-ink-soft" aria-live="polite">
          {items.length} saved item{items.length === 1 ? "" : "s"}
          {signedIn ? " · synced to your account" : ""}
        </p>
        <Button type="button" variant="secondary" onClick={share}>
          Share wishlist
        </Button>
      </div>
      {copied && <FormMessage tone="success">{copied}</FormMessage>}
      {!signedIn && (
        <p className="bg-surface p-4 text-sm">
          Saved on this device only.{" "}
          <NextLink
            href="/auth/signin?next=/account/wishlist"
            className="underline underline-offset-4"
          >
            Sign in
          </NextLink>{" "}
          to keep your wishlist on every device.
        </p>
      )}
      <ul className="grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4">
        {products.map((product) => {
          const saved = items.find((i) => i.productId === product.id);
          const dropped = saved && product.price < saved.priceAtAdd;
          return (
            <li key={product.id} className="flex flex-col gap-2">
              <ProductCard product={product} />
              {dropped && (
                <p className="text-sm text-sale">
                  Price dropped from {formatMoney(saved.priceAtAdd)}
                </p>
              )}
              {!product.inStockOnline && (
                <p className="text-sm text-ink-soft">Out of stock online</p>
              )}
              <button
                type="button"
                onClick={() => remove(product.id)}
                className="min-h-11 self-start text-sm underline underline-offset-4"
              >
                Remove<span className="sr-only"> {product.name}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {gone.length > 0 && (
        <p className="text-sm text-ink-soft">
          {gone.length} saved item{gone.length === 1 ? " is" : "s are"} no longer available.{" "}
          <button
            type="button"
            onClick={() => gone.forEach((g) => remove(g.productId))}
            className="underline underline-offset-4"
          >
            Clear {gone.length === 1 ? "it" : "them"}
          </button>
        </p>
      )}
    </div>
  );
}

/** Someone else's shared list: read-only cards, each with its own heart to save. */
export function SharedWishlist({ ids }: { ids: string[] }) {
  const products = useProducts(ids, true);
  if (products === null) return <Skeleton className="h-96" />;
  if (products.length === 0) {
    return <p className="bg-surface p-6">None of these items are available any more.</p>;
  }
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4">
      {products.map((p) => (
        <li key={p.id}>
          <ProductCard product={p} />
        </li>
      ))}
    </ul>
  );
}
