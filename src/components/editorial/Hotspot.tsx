"use client";

import * as Popover from "@radix-ui/react-popover";
import NextLink from "next/link";
import { PriceDisplay } from "@/components/commerce/PriceDisplay";
import { ProductImage } from "@/components/commerce/ProductImage";
import { PlusIcon } from "@/components/icons";
import type { ListingProduct } from "@/lib/catalog/listing-types";

/** Shoppable point on a lookbook image; opens a mini product card. */
export function Hotspot({ product, x, y }: { product: ListingProduct; x: number; y: number }) {
  const color = product.colors[0];
  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label={`Shop ${product.name}`}
        style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
        className="absolute flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-surface text-ink shadow-overlay transition-transform duration-fast hover:scale-110 data-[state=open]:bg-ink data-[state=open]:text-surface"
      >
        <PlusIcon size={20} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="right"
          align="center"
          sideOffset={10}
          collisionPadding={16}
          className="z-30 flex w-64 gap-3 bg-surface p-3 shadow-overlay data-[state=open]:animate-menu-in"
        >
          {color && (
            <span className="relative aspect-3/4 w-20 shrink-0">
              <ProductImage src={color.image.url} alt={color.image.alt} fill sizes="80px" />
            </span>
          )}
          <span className="flex flex-col gap-1 text-sm">
            <NextLink
              href={`/product/${product.slug}`}
              className="font-medium underline-offset-4 hover:underline"
            >
              {product.name}
            </NextLink>
            <PriceDisplay size="sm" price={product.price} compareAtPrice={product.compareAtPrice} />
            <NextLink
              href={`/product/${product.slug}`}
              className="mt-1 text-label underline underline-offset-4"
            >
              Shop now
            </NextLink>
          </span>
          <Popover.Arrow className="fill-surface" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
