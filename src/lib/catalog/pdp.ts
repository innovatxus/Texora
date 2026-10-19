import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import {
  getLiveProductBySlug,
  getVariantsForProduct,
  listAllLiveProducts,
} from "@/lib/data/products";
import { listApprovedReviews } from "@/lib/data/reviews";
import { ONLINE_LOCATION, type Product } from "@/lib/validation";
import { getCategory } from "./queries";
import { summariseReviews, type PdpVariant, type ReviewSummary } from "./variant-selection";

export interface ReviewView {
  id: string;
  displayName: string;
  rating: number;
  title: string;
  body: string;
  fit?: number;
  fitFamily?: string;
  sizePurchased?: string;
  verifiedPurchase: boolean;
  helpfulCount: number;
  createdAt: string;
}

export interface PdpData {
  product: Product;
  categoryName: string;
  variants: PdpVariant[];
  reviews: ReviewView[];
  summary: ReviewSummary;
}

/** Everything the product page needs, cached per product and retagged on catalog saves. */
export async function getPdpData(slug: string): Promise<PdpData | null> {
  "use cache";
  cacheTag("products", "inventory", "reviews", `product:${slug}`);
  cacheLife("hours");

  const product = await getLiveProductBySlug(slug);
  if (!product) return null;

  const [variants, reviewPage, category] = await Promise.all([
    getVariantsForProduct(product.id),
    listApprovedReviews(product.id, { sort: "newest", limit: 200 }),
    getCategory(product.categoryPath),
  ]);

  const reviews: ReviewView[] = reviewPage.items.map((r) => ({
    id: r.id,
    displayName: r.displayName,
    rating: r.rating,
    title: r.title,
    body: r.body,
    ...(r.fit !== undefined ? { fit: r.fit } : {}),
    ...(r.fitFamily ? { fitFamily: r.fitFamily } : {}),
    ...(r.sizePurchased ? { sizePurchased: r.sizePurchased } : {}),
    verifiedPurchase: r.verifiedPurchase,
    helpfulCount: r.helpfulCount,
    createdAt: r.createdAt.toISOString(),
  }));

  return {
    product,
    categoryName: category?.name ?? product.categoryPath.at(-1) ?? "",
    variants: variants.map((v) => {
      const { [ONLINE_LOCATION]: online = 0, ...storeStock } = v.stockByLocation;
      return {
        sku: v.sku,
        color: v.color,
        fitFamily: v.fitFamily,
        size: v.size,
        price: v.price,
        ...(v.compareAtPrice !== undefined ? { compareAtPrice: v.compareAtPrice } : {}),
        online,
        stores: storeStock,
        lowStockThreshold: v.lowStockThreshold,
      };
    }),
    reviews,
    summary: summariseReviews(reviews),
  };
}

export async function listLiveProductSlugs(): Promise<string[]> {
  "use cache";
  cacheTag("products");
  cacheLife("hours");
  return (await listAllLiveProducts()).map((p) => p.slug);
}
