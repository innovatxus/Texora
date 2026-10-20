import type { z } from "zod";
import { ProductCard } from "@/components/commerce/ProductCard";
import { ProductImage } from "@/components/commerce/ProductImage";
import { getProductsForIds } from "@/lib/catalog/queries";
import type { lookbookGridSchema, shopTheLookSchema } from "@/lib/cms/modules";
import { Hotspot } from "./Hotspot";

/** Grid of looks with hotspots linking to the products worn. */
export async function LookbookGrid({ heading, looks }: z.infer<typeof lookbookGridSchema>) {
  const products = await getProductsForIds(
    looks.flatMap((l) => l.hotspots.map((h) => h.productId)),
  );
  const byId = new Map(products.map((p) => [p.id, p]));
  return (
    <section className="container-page section-y">
      <h2 className="font-display text-3xl">{heading}</h2>
      <ul className="mt-8 grid gap-4 md:grid-cols-3">
        {looks.map((look) => (
          <li key={look.image.url}>
            <figure>
              <div className="relative aspect-3/4">
                <ProductImage
                  src={look.image.url}
                  alt={look.image.alt}
                  fill
                  sizes="(min-width: 768px) 33vw, 100vw"
                />
                {look.hotspots.map((spot, i) => {
                  const product = byId.get(spot.productId);
                  return product ? (
                    <Hotspot key={spot.productId + i} product={product} x={spot.x} y={spot.y} />
                  ) : null;
                })}
              </div>
              <figcaption className="mt-3 text-label">{look.title}</figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** One large look with hotspots and the featured products alongside. */
export async function ShopTheLook({
  heading,
  body,
  image,
  productIds,
}: z.infer<typeof shopTheLookSchema>) {
  const products = await getProductsForIds(productIds);
  return (
    <section className="container-page section-y">
      <div className="grid gap-8 lg:grid-cols-12">
        <div className="relative aspect-3/4 lg:col-span-5">
          <ProductImage
            src={image.url}
            alt={image.alt}
            fill
            sizes="(min-width: 1024px) 40vw, 100vw"
          />
        </div>
        <div className="lg:col-span-7">
          <h2 className="font-display text-3xl">{heading}</h2>
          {body && <p className="mt-3 text-ink-soft">{body}</p>}
          <ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3">
            {products.map((p) => (
              <li key={p.id}>
                <ProductCard product={p} sizes="(min-width: 768px) 20vw, 45vw" />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
