import type { MetadataRoute } from "next";
import { HELP_TOPICS } from "@/config/help";
import {
  getCollection,
  getDepartmentCategories,
  getListingIndex,
  getStores,
} from "@/lib/catalog/queries";
import { listApprovedShopSlugs } from "@/lib/merchant/storefront";
import { siteUrl } from "@/lib/site-url";
import { DEPARTMENTS } from "@/lib/validation/common";

/** Collections linked from the menu (the same list the collection pages prerender). */
const COLLECTION_SLUGS = ["new-arrivals", "the-linen-edit", "knitwear"];

/**
 * XML sitemap (spec 10, SEO): home, departments, categories, collections,
 * live products, approved merchant shops, stores and help. Built from the
 * same cached reads the pages use, so it follows publishing.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories, collections, shops, stores] = await Promise.all([
    getListingIndex(),
    Promise.all(DEPARTMENTS.map((d) => getDepartmentCategories(d))),
    Promise.all(COLLECTION_SLUGS.map((slug) => getCollection(slug))),
    listApprovedShopSlugs(),
    getStores(),
  ]);
  const entry = (
    path: string,
    priority: number,
    changeFrequency: "daily" | "weekly" | "monthly",
    lastModified?: Date,
  ): MetadataRoute.Sitemap[number] => ({
    url: siteUrl(path),
    priority,
    changeFrequency,
    ...(lastModified ? { lastModified } : {}),
  });

  return [
    entry("/", 1, "daily"),
    ...DEPARTMENTS.map((d) => entry(`/${d}`, 0.9, "daily")),
    entry("/sale", 0.8, "daily"),
    ...categories
      .flat()
      .filter((c) => c.path.length > 1)
      .map((c) => entry(`/${c.path.join("/")}`, 0.8, "daily")),
    ...collections.flatMap((c) => (c ? [entry(`/collections/${c.slug}`, 0.7, "weekly")] : [])),
    ...products.map((p) => entry(`/product/${p.slug}`, 0.7, "weekly", new Date(p.createdAt))),
    entry("/merchants", 0.5, "monthly"),
    ...shops.map((slug) => entry(`/shops/${slug}`, 0.6, "weekly")),
    entry("/stores", 0.5, "monthly"),
    ...stores
      .filter((s) => s.status !== "closed")
      .map((s) => entry(`/stores/${s.slug}`, 0.4, "monthly")),
    entry("/help", 0.4, "monthly"),
    ...HELP_TOPICS.map((t) => entry(`/help/${t.slug}`, 0.3, "monthly")),
    entry("/gift-cards", 0.4, "monthly"),
  ];
}
