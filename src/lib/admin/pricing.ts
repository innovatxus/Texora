import type { PriceRange, Variant } from "@/lib/validation";

/**
 * A product's price range from its variants. Compare-at prices only count
 * when they're above the selling price (a real markdown).
 */
export function priceRangeFor(
  variants: ReadonlyArray<Pick<Variant, "price" | "compareAtPrice">>,
): PriceRange {
  if (variants.length === 0) return { min: 0, max: 0 };
  const prices = variants.map((v) => v.price);
  const compare = variants
    .filter((v) => v.compareAtPrice !== undefined && v.compareAtPrice > v.price)
    .map((v) => v.compareAtPrice as number);
  return {
    min: Math.min(...prices),
    max: Math.max(...prices),
    ...(compare.length > 0
      ? { compareAtMin: Math.min(...compare), compareAtMax: Math.max(...compare) }
      : {}),
  };
}

/** Percentage off for a markdown, rounded down (50% means half price or better). */
export function percentOff(price: number, compareAtPrice: number): number {
  if (compareAtPrice <= price || compareAtPrice <= 0) return 0;
  return Math.floor(((compareAtPrice - price) / compareAtPrice) * 100);
}
