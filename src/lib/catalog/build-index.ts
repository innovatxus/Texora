import type { Product } from "@/lib/validation";
import type { VariantStockRow } from "@/lib/data/products";
import type { ListingProduct } from "./listing-types";
import { compareSizes } from "./sizes";

const ONLINE = "online";

/** Joins products with variant stock into listing documents. Pure, so it is unit tested. */
export function buildListingProducts(
  products: readonly Product[],
  stock: readonly VariantStockRow[],
): ListingProduct[] {
  const byProduct = new Map<string, VariantStockRow[]>();
  for (const row of stock) {
    const rows = byProduct.get(row.productId);
    if (rows) rows.push(row);
    else byProduct.set(row.productId, [row]);
  }

  return products.map((p) => {
    const rows = byProduct.get(p.id) ?? [];
    const defaultFit = p.fitFamilies[0] ?? "regular";
    const online = (r: VariantStockRow) => (r.stockByLocation[ONLINE] ?? 0) > 0;
    const sizesInStock = [...new Set(rows.filter(online).map((r) => r.size))];
    const storesInStock = [
      ...new Set(
        rows.flatMap((r) =>
          Object.entries(r.stockByLocation)
            .filter(([location, qty]) => location !== ONLINE && qty > 0)
            .map(([location]) => location),
        ),
      ),
    ].sort();

    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      department: p.department,
      categoryPath: p.categoryPath,
      attributes: Object.fromEntries(
        Object.entries(p.attributes).map(([k, v]) => [k, Array.isArray(v) ? v : [v]]),
      ),
      fitFamilies: p.fitFamilies,
      defaultFit,
      sizeType: p.sizeType,
      colors: p.colors.map((c) => {
        const [first, second] = c.images;
        return {
          code: c.code,
          name: c.name,
          family: c.family,
          swatch: c.swatch,
          image: { url: first?.url ?? "", alt: first?.alt ?? p.name },
          ...(second ? { altImage: { url: second.url, alt: second.alt } } : {}),
          sizes: rows
            .filter((r) => r.color === c.code && r.fitFamily === defaultFit)
            .map((r) => ({ size: r.size, sku: r.sku, inStock: online(r) }))
            .sort((x, y) => compareSizes(x.size, y.size)),
        };
      }),
      price: p.priceRange.min,
      maxPrice: p.priceRange.max,
      ...(p.priceRange.compareAtMin !== undefined
        ? { compareAtPrice: p.priceRange.compareAtMin }
        : {}),
      badges: p.badges,
      ratingAvg: p.ratingAvg,
      ratingCount: p.ratingCount,
      salesRank: p.salesRank,
      createdAt: p.createdAt.getTime(),
      sizesInStock,
      inStockOnline: sizesInStock.length > 0,
      storesInStock,
      ...(p.shop ? { shop: { id: p.shop.id, slug: p.shop.slug, name: p.shop.name } } : {}),
    };
  });
}
