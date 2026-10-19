"use client";

import NextLink from "next/link";
import { useRef, useState } from "react";
import { Badge } from "@/components/primitives";
import type { ListingProduct } from "@/lib/catalog/listing-types";
import { cn } from "@/lib/utils/cn";
import { useBagStore } from "@/stores/bag";
import { useUiStore } from "@/stores/ui";
import { primaryBadge } from "./badges";
import { PriceDisplay } from "./PriceDisplay";
import { ProductImage } from "./ProductImage";
import { Rating } from "./Rating";
import { WishlistButton } from "./WishlistButton";

const MAX_SWATCHES = 5;

export interface ProductCardProps {
  product: ListingProduct;
  /** Eager-load the first row's images (LCP). */
  priority?: boolean;
  sizes?: string;
  /** Hide quick add (e.g. in narrow carousels). */
  quickAdd?: boolean;
  /** Active colour-family filters: the card opens on the first matching colour. */
  preferColorFamilies?: readonly string[];
  className?: string;
}

export function ProductCard({
  product,
  priority = false,
  sizes = "(min-width: 1024px) 25vw, 50vw",
  quickAdd = true,
  preferColorFamilies = [],
  className,
}: ProductCardProps) {
  const [colorIndex, setColorIndex] = useState(() =>
    Math.max(
      0,
      product.colors.findIndex((c) => preferColorFamilies.includes(c.family)),
    ),
  );
  const [slide, setSlide] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const addToBag = useBagStore((s) => s.add);
  const showAdded = useUiStore((s) => s.showAdded);

  const color = product.colors[colorIndex] ?? product.colors[0];
  if (!color) return null;

  const href = `/product/${product.slug}?color=${color.code}`;
  const badge = primaryBadge(product.badges, product.price, product.compareAtPrice);
  const slides = [color.image, ...(color.altImage ? [color.altImage] : [])];
  const extraColors = product.colors.length - MAX_SWATCHES;

  const onQuickAdd = (size: string, sku: string) => {
    addToBag({ sku, productId: product.id });
    showAdded({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      colorName: color.name,
      size,
      image: color.image.url,
      price: product.price,
      ...(product.compareAtPrice ? { compareAtPrice: product.compareAtPrice } : {}),
    });
  };

  return (
    <article className={cn("group/card relative flex flex-col", className)}>
      <div className="relative">
        {/* Touch: swipe between views. Hover devices: crossfade on hover. */}
        <div
          ref={trackRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            setSlide(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
          }}
          className={cn(
            "relative flex aspect-3/4 snap-x snap-mandatory [scrollbar-width:none] overflow-x-auto overflow-y-hidden bg-surface-muted [&::-webkit-scrollbar]:hidden",
            "[@media(hover:hover)]:overflow-hidden",
          )}
        >
          {slides.map((img, i) => (
            <NextLink
              key={img.url}
              href={href}
              tabIndex={i === 0 ? 0 : -1}
              aria-hidden={i === 0 ? undefined : true}
              aria-label={i === 0 ? product.name : undefined}
              className={cn(
                "relative block h-full w-full shrink-0 snap-start",
                i === 1 &&
                  "[@media(hover:hover)]:absolute [@media(hover:hover)]:inset-0 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:transition-opacity [@media(hover:hover)]:duration-base [@media(hover:hover)]:ease-atelier [@media(hover:hover)]:group-hover/card:opacity-100",
              )}
            >
              <ProductImage
                src={img.url}
                alt={i === 0 ? img.alt : ""}
                fill
                sizes={sizes}
                priority={priority && i === 0}
              />
            </NextLink>
          ))}
        </div>

        {slides.length > 1 && (
          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-x-0 bottom-2 flex justify-center gap-1.5",
              "[@media(hover:hover)]:hidden",
            )}
          >
            {slides.map((img, i) => (
              <span
                key={img.url}
                className={cn("size-1.5 rounded-full", i === slide ? "bg-ink" : "bg-ink/30")}
              />
            ))}
          </div>
        )}

        {badge && (
          <Badge tone={badge.tone} className="pointer-events-none absolute top-2 left-2">
            {badge.label}
          </Badge>
        )}

        <WishlistButton
          productId={product.id}
          productName={product.name}
          color={color.code}
          price={product.price}
          className="absolute top-2 right-2 z-10"
        />

        {quickAdd && color.sizes.length > 0 && (
          <div
            className={cn(
              // Capped so it never covers the wishlist button on narrow cards.
              "absolute inset-x-2 bottom-2 hidden max-h-[calc(100%-4rem)] overflow-y-auto bg-surface/95 p-3",
              "[@media(hover:hover)]:group-focus-within/card:block [@media(hover:hover)]:group-hover/card:block",
            )}
          >
            <p className="text-label text-ink-soft">Quick add · {color.name}</p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {color.sizes.map((s) => (
                <li key={s.sku}>
                  <button
                    type="button"
                    disabled={!s.inStock}
                    onClick={() => onQuickAdd(s.size, s.sku)}
                    aria-label={`Add ${product.name}, ${color.name}, size ${s.size} to bag${s.inStock ? "" : " (out of stock)"}`}
                    className={cn(
                      "h-8 min-w-10 border px-2 text-xs tabular-nums transition-colors duration-fast",
                      s.inStock
                        ? "border-ink-subtle hover:border-ink hover:bg-ink hover:text-surface"
                        : "cursor-not-allowed border-line text-ink-subtle line-through",
                    )}
                  >
                    {s.size.replace("x", "×")}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {product.colors.length > 1 && (
        <ul aria-label={`Colours for ${product.name}`} className="mt-3 flex items-center gap-1.5">
          {product.colors.slice(0, MAX_SWATCHES).map((c, i) => (
            <li key={c.code}>
              <button
                type="button"
                aria-label={c.name}
                aria-pressed={i === colorIndex}
                onClick={() => setColorIndex(i)}
                onMouseEnter={() => setColorIndex(i)}
                onFocus={() => setColorIndex(i)}
                className={cn(
                  "flex size-6 items-center justify-center rounded-full border",
                  i === colorIndex
                    ? "border-line-strong"
                    : "border-transparent hover:border-ink-subtle",
                )}
              >
                <span
                  className="size-4 rounded-full border border-ink/15"
                  style={{ background: c.swatch }}
                />
              </button>
            </li>
          ))}
          {extraColors > 0 && (
            <li>
              <NextLink
                href={href}
                className="text-xs text-ink-subtle hover:text-ink"
                aria-label={`${extraColors} more colours`}
              >
                +{extraColors}
              </NextLink>
            </li>
          )}
        </ul>
      )}

      <h3 className="mt-2 text-sm">
        <NextLink href={href} className="underline-offset-4 hover:underline">
          {product.name}
        </NextLink>
      </h3>
      <PriceDisplay
        size="sm"
        price={product.price}
        max={product.maxPrice}
        compareAtPrice={product.compareAtPrice}
        className="mt-1"
      />
      {product.ratingCount > 0 && (
        <Rating value={product.ratingAvg} count={product.ratingCount} className="mt-1.5" />
      )}
    </article>
  );
}
