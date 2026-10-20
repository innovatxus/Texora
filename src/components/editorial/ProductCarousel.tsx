import type { z } from "zod";
import { ProductCard } from "@/components/commerce/ProductCard";
import { Link } from "@/components/primitives";
import { sortProducts } from "@/lib/catalog/listing";
import type { ListingProduct } from "@/lib/catalog/listing-types";
import { getListingIndex, getProductsForIds } from "@/lib/catalog/queries";
import type { productCarouselSchema } from "@/lib/cms/modules";
import { CarouselTrack } from "./CarouselTrack";

type CarouselSource = z.infer<typeof productCarouselSchema>["source"];

/** Resolves a manual or rule-based carousel source against the live catalogue. */
export async function resolveCarouselProducts(source: CarouselSource): Promise<ListingProduct[]> {
  if (source.type === "manual") return getProductsForIds(source.productIds);
  const index = await getListingIndex();
  const inScope = index.filter((p) => {
    const key = p.categoryPath.join("/");
    const scoped =
      !source.categoryKey || key === source.categoryKey || key.startsWith(`${source.categoryKey}/`);
    const sale = !source.onlySale || (p.compareAtPrice !== undefined && p.compareAtPrice > p.price);
    return scoped && sale;
  });
  return sortProducts(inScope, source.sort).slice(0, source.limit);
}

/** Scrollable row of products chosen by a CMS rule (collection, category or IDs). */
export async function ProductCarousel({
  heading,
  cta,
  source,
}: z.infer<typeof productCarouselSchema>) {
  const products = await resolveCarouselProducts(source);
  if (products.length === 0) return null;
  return <ProductRail heading={heading} cta={cta} products={products} />;
}

/** Presentational rail, also used by PDP recommendations. */
export function ProductRail({
  heading,
  cta,
  products,
}: {
  heading: string;
  cta?: { label: string; href: string } | undefined;
  products: readonly ListingProduct[];
}) {
  return (
    <section className="container-page section-y">
      <div className="flex items-end justify-between gap-4">
        <h2 className="font-display text-3xl">{heading}</h2>
        {cta && (
          <Link href={cta.href} className="shrink-0 text-label">
            {cta.label}
          </Link>
        )}
      </div>
      <div className="mt-8">
        <CarouselTrack label={heading}>
          {products.map((p) => (
            <li
              key={p.id}
              className="w-[44vw] shrink-0 snap-start sm:w-[30vw] lg:w-[calc((100%-3rem)/4)]"
            >
              <ProductCard product={p} quickAdd={false} sizes="(min-width: 1024px) 25vw, 44vw" />
            </li>
          ))}
        </CarouselTrack>
      </div>
    </section>
  );
}
