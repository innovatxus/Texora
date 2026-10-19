"use client";

import NextLink from "next/link";
import { PriceDisplay } from "@/components/commerce/PriceDisplay";
import { ProductImage } from "@/components/commerce/ProductImage";
import { Drawer } from "@/components/feedback/Drawer";
import { CheckIcon } from "@/components/icons";
import { Button, ButtonLink } from "@/components/primitives";
import { selectBagCount, useBagStore } from "@/stores/bag";
import { useUiStore } from "@/stores/ui";

/**
 * Slides in when something is added: confirms the item and offers the next
 * step. Line items, subtotal and free-shipping progress arrive with the bag
 * pages (Phase 6).
 */
export function BagDrawer() {
  const isOpen = useUiStore((s) => s.panel === "bag");
  const setOpen = useUiStore((s) => s.setOpen);
  const close = useUiStore((s) => s.close);
  const item = useUiStore((s) => s.lastAdded);
  const count = useBagStore(selectBagCount);

  return (
    <Drawer open={isOpen} onOpenChange={(open) => setOpen("bag", open)} title={`Bag (${count})`}>
      <div className="flex flex-1 flex-col overflow-y-auto p-4 md:p-6">
        {item ? (
          <>
            <p role="status" className="flex items-center gap-2 text-sm text-success">
              <CheckIcon /> Added to your bag
            </p>
            <div className="mt-5 flex gap-4">
              <NextLink
                href={`/product/${item.slug}`}
                onClick={close}
                className="relative aspect-3/4 w-24 shrink-0"
              >
                <ProductImage src={item.image} alt={item.name} fill sizes="96px" />
              </NextLink>
              <div className="flex flex-col gap-1 text-sm">
                <NextLink
                  href={`/product/${item.slug}`}
                  onClick={close}
                  className="font-medium hover:underline"
                >
                  {item.name}
                </NextLink>
                <span className="text-ink-soft">
                  {item.colorName} · Size {item.size.replace("x", " × ")}
                </span>
                <PriceDisplay
                  size="sm"
                  price={item.price}
                  compareAtPrice={item.compareAtPrice}
                  showPercent={false}
                />
              </div>
            </div>
          </>
        ) : (
          <p className="text-ink-soft">Your bag is ready when you are.</p>
        )}
      </div>
      <div className="flex flex-col gap-3 border-t border-line p-4 md:p-6">
        <ButtonLink href="/checkout" onClick={close} fullWidth>
          Checkout
        </ButtonLink>
        <ButtonLink href="/bag" onClick={close} variant="secondary" fullWidth>
          View bag ({count})
        </ButtonLink>
        <Button variant="tertiary" onClick={close} className="self-center">
          Continue shopping
        </Button>
      </div>
    </Drawer>
  );
}
