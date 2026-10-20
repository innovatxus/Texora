import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import {
  getLiveCategoryByPath,
  getLiveCollectionBySlug,
  listLiveCategories,
  listStores,
} from "@/lib/data/catalog-structure";
import { listAllLiveProducts, listVariantStockRows } from "@/lib/data/products";
import type { Category, Collection, Department, Store } from "@/lib/validation";
import { buildListingProducts } from "./build-index";
import type { ListingProduct } from "./listing-types";

/**
 * Cached catalog reads for pages. Tags match what back-office saves will
 * revalidate: "products", "inventory", "categories", "collections", "stores".
 */

/** Compact data for every live product, cached and used by all listings. */
export async function getListingIndex(): Promise<ListingProduct[]> {
  "use cache";
  cacheTag("products", "inventory");
  cacheLife("hours");
  const [products, stock] = await Promise.all([listAllLiveProducts(), listVariantStockRows()]);
  return buildListingProducts(products, stock);
}

/** Live categories in a department, cached. */
export async function getDepartmentCategories(department: Department): Promise<Category[]> {
  "use cache";
  cacheTag("categories");
  cacheLife("hours");
  return listLiveCategories(department);
}

/** A live category by its path, cached. */
export async function getCategory(path: readonly string[]): Promise<Category | null> {
  "use cache";
  cacheTag("categories");
  cacheLife("hours");
  return getLiveCategoryByPath(path);
}

/** A live collection by slug, cached. */
export async function getCollection(slug: string): Promise<Collection | null> {
  "use cache";
  cacheTag("collections", `collection:${slug}`);
  cacheLife("hours");
  return getLiveCollectionBySlug(slug);
}

/** Every store, cached. */
export async function getStores(): Promise<Store[]> {
  "use cache";
  cacheTag("stores");
  cacheLife("days");
  return listStores();
}

/** Listing data for the given product IDs, in the same order, skipping missing ones. */
export async function getProductsForIds(ids: readonly string[]): Promise<ListingProduct[]> {
  const index = await getListingIndex();
  const byId = new Map(index.map((p) => [p.id, p]));
  return ids.map((id) => byId.get(id)).filter((p): p is ListingProduct => p !== undefined);
}
