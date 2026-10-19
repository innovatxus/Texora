"use client";

import NextLink from "next/link";
import { PriceDisplay } from "@/components/commerce/PriceDisplay";
import { ProductImage } from "@/components/commerce/ProductImage";
import { CarouselTrack } from "@/components/editorial/CarouselTrack";
import { useRecentlyViewedStore } from "@/stores/recentlyViewed";

/** "Recently viewed" from this browser, excluding the product on screen. */
export function RecentlyViewed({ excludeId }: { excludeId: string }) {
  const items = useRecentlyViewedStore((s) => s.items).filter((i) => i.productId !== excludeId);
  if (items.length === 0) return null;
  return (
    <section className="container-page section-y">
      <h2 className="font-display text-3xl">Recently viewed</h2>
      <div className="mt-8">
        <CarouselTrack label="Recently viewed">
          {items.map((item) => (
            <li
              key={item.productId}
              className="w-[40vw] shrink-0 snap-start sm:w-[24vw] lg:w-[calc((100%-5rem)/6)]"
            >
              <NextLink href={`/product/${item.slug}`} className="group block">
                <span className="relative block aspect-3/4">
                  <ProductImage
                    src={item.image}
                    alt={item.name}
                    fill
                    sizes="(min-width: 1024px) 16vw, 40vw"
                  />
                </span>
                <span className="mt-2 block truncate text-sm group-hover:underline">
                  {item.name}
                </span>
                <PriceDisplay
                  size="sm"
                  price={item.price}
                  compareAtPrice={item.compareAtPrice}
                  showPercent={false}
                />
              </NextLink>
            </li>
          ))}
        </CarouselTrack>
      </div>
    </section>
  );
}
