import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { listLiveCategories } from "@/lib/data/catalog-structure";
import { listAllLiveProducts } from "@/lib/data/products";
import type { SearchDocument } from "./match";

/** Search documents for every live product. Cached; retagged when catalog saves land. */
export async function getSearchDocuments(): Promise<SearchDocument[]> {
  "use cache";
  cacheTag("products", "categories");
  cacheLife("hours");

  const [products, women, men] = await Promise.all([
    listAllLiveProducts(),
    listLiveCategories("women"),
    listLiveCategories("men"),
  ]);
  const categoryNames = new Map([...women, ...men].map((c) => [c.path.join("/"), c.name]));

  return products.map((p) => {
    const categoryKey = p.categoryPath.join("/");
    const category = p.categoryPath.at(-1) ?? p.department;
    const departmentLabel = p.department === "women" ? "Women's" : "Men's";
    const firstImage = p.colors[0]?.images[0];
    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      department: p.department,
      category,
      categoryLabel: `${departmentLabel} ${(categoryNames.get(categoryKey) ?? category).toLowerCase()}`,
      // Shop names stay private to merchants and staff: never searchable by shoppers.
      keywords: p.searchKeywords,
      image: firstImage?.url ?? "",
      imageAlt: firstImage?.alt ?? p.name,
      price: p.priceRange.min,
      maxPrice: p.priceRange.max,
      ...(p.priceRange.compareAtMin ? { compareAtPrice: p.priceRange.compareAtMin } : {}),
      salesRank: p.salesRank,
    };
  });
}
