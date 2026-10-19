import "server-only";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { productSchema, variantSchema, type Product, type Variant } from "@/lib/validation";
import { paginate, parseSnapshot, type Page, type PageRequest } from "./firestore";

export const PRODUCT_SORTS = {
  featured: [{ field: "salesRank", direction: "asc" }],
  best_sellers: [{ field: "salesRank", direction: "asc" }],
  newest: [{ field: "createdAt", direction: "desc" }],
  price_asc: [{ field: "priceRange.min", direction: "asc" }],
  price_desc: [{ field: "priceRange.min", direction: "desc" }],
  top_rated: [{ field: "ratingAvg", direction: "desc" }],
} as const satisfies Record<string, ReadonlyArray<{ field: string; direction: "asc" | "desc" }>>;

export type ProductSort = keyof typeof PRODUCT_SORTS;

const products = () => getFirebaseAdmin().db.collection("products");
const variants = () => getFirebaseAdmin().db.collection("variants");

export async function getProductById(id: string): Promise<Product | null> {
  return parseSnapshot(productSchema, await products().doc(id).get());
}

/** Live product by slug (the PDP lookup). */
export async function getLiveProductBySlug(slug: string): Promise<Product | null> {
  const snapshot = await products()
    .where("slug", "==", slug)
    .where("status", "==", "live")
    .limit(1)
    .get();
  const doc = snapshot.docs[0];
  return doc ? parseSnapshot(productSchema, doc) : null;
}

export async function getProductsByIds(ids: readonly string[]): Promise<Product[]> {
  if (ids.length === 0) return [];
  const refs = ids.map((id) => products().doc(id));
  const snapshots = await getFirebaseAdmin().db.getAll(...refs);
  return snapshots
    .map((s) => parseSnapshot(productSchema, s))
    .filter((p): p is Product => p !== null);
}

export interface ListProductsOptions extends PageRequest {
  /** Category path prefix, e.g. ["women"] or ["women", "dresses"]. */
  categoryPath: readonly string[];
  sort: ProductSort;
}

/**
 * Live products in a category, server-paginated. Faceted filtering is served
 * by the search index; this is the SSR/SEO path for plain category pages.
 */
export async function listLiveProducts({
  categoryPath,
  sort,
  limit,
  cursor,
}: ListProductsOptions): Promise<Page<Product>> {
  if (categoryPath.length === 0) return { items: [], nextCursor: null };
  const base = products()
    .where("status", "==", "live")
    .where("categoryKeys", "array-contains", categoryPath.join("/"));
  return paginate(base, PRODUCT_SORTS[sort], { limit, cursor }, (s) =>
    parseSnapshot(productSchema, s),
  );
}

export async function getVariantsForProduct(productId: string): Promise<Variant[]> {
  const snapshot = await variants().where("productId", "==", productId).get();
  return snapshot.docs
    .map((s) => parseSnapshot(variantSchema, s, "sku"))
    .filter((v): v is Variant => v !== null);
}

export async function getVariantsBySkus(skus: readonly string[]): Promise<Variant[]> {
  if (skus.length === 0) return [];
  const snapshots = await getFirebaseAdmin().db.getAll(...skus.map((sku) => variants().doc(sku)));
  return snapshots
    .map((s) => parseSnapshot(variantSchema, s, "sku"))
    .filter((v): v is Variant => v !== null);
}

/** Every live product. Used to build the in-process search index (132 docs today). */
export async function listAllLiveProducts(): Promise<Product[]> {
  const snapshot = await products().where("status", "==", "live").get();
  return snapshot.docs
    .map((s) => parseSnapshot(productSchema, s))
    .filter((p): p is Product => p !== null);
}
