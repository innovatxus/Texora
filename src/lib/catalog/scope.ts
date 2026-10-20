import "server-only";
import { z } from "zod";
import { buildIndex, search } from "@/lib/search/match";
import { getSearchDocuments } from "@/lib/search/index-data";
import { ATTRIBUTE_LABELS, type FacetContext } from "./listing";
import type { ListingProduct } from "./listing-types";
import { getCollection, getDepartmentCategories, getListingIndex, getStores } from "./queries";

/** What a listing shows. Serialisable, so client filter drawers can ask for counts. */
export const listingScopeSchema = z.object({
  department: z.enum(["women", "men"]).optional(),
  /** Category key, e.g. "women/dresses". */
  categoryKey: z.string().max(80).optional(),
  collection: z.string().max(80).optional(),
  sale: z.boolean().optional(),
  query: z.string().max(80).optional(),
});
export type ListingScope = z.infer<typeof listingScopeSchema>;

export interface ResolvedScope {
  products: ListingProduct[];
  /** Relevance order for search, pin order for collections. */
  pinned: string[];
  context: FacetContext;
}

/** The products and facets for a listing scope (department, category, collection, sale or search). */
export async function resolveScope(scope: ListingScope): Promise<ResolvedScope> {
  const [index, stores] = await Promise.all([getListingIndex(), getStores()]);
  let products = index;
  let pinned: string[] = [];

  if (scope.department) products = products.filter((p) => p.department === scope.department);
  if (scope.categoryKey) {
    const key = scope.categoryKey;
    products = products.filter((p) => {
      const own = p.categoryPath.join("/");
      return own === key || own.startsWith(`${key}/`);
    });
  }
  if (scope.sale)
    products = products.filter((p) => p.compareAtPrice !== undefined && p.compareAtPrice > p.price);
  if (scope.collection) {
    const collection = await getCollection(scope.collection);
    const ids = new Set(collection?.productIds ?? []);
    products = products.filter((p) => ids.has(p.id));
    pinned = collection?.productIds ?? [];
  }
  if (scope.query) {
    const result = search(buildIndex(await getSearchDocuments()), scope.query, 500);
    const order = result.products.map((d) => d.id);
    const ids = new Set(order);
    products = products.filter((p) => ids.has(p.id));
    pinned = order;
  }

  // Category facet for scopes wider than one category.
  let categories: FacetContext["categories"];
  if (!scope.categoryKey || scope.categoryKey.split("/").length < 2) {
    const departments = scope.department ? [scope.department] : (["women", "men"] as const);
    const lists = await Promise.all(departments.map((d) => getDepartmentCategories(d)));
    const seen = new Map<string, string>();
    for (const c of lists.flat())
      if (c.parentId !== null && !seen.has(c.slug)) seen.set(c.slug, c.name);
    categories = [...seen].map(([slug, name]) => ({ slug, name }));
  }

  const present = new Set(products.flatMap((p) => Object.keys(p.attributes)));
  const attributeKeys = Object.keys(ATTRIBUTE_LABELS).filter((k) => present.has(k));

  return {
    products,
    pinned,
    context: {
      ...(categories ? { categories } : {}),
      attributeKeys,
      stores: stores.map((s) => ({ id: s.id, name: s.name })),
      ...(scope.sale ? { saleScope: true } : {}),
    },
  };
}
