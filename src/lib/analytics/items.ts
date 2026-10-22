import type { ListingProduct } from "@/lib/catalog/listing-types";
import { dollars, type AnalyticsItem } from "./events";

/** A listing product as an analytics item (price in dollars). */
export function listingItem(
  product: Pick<ListingProduct, "id" | "name" | "price" | "categoryPath" | "shop">,
  extra: { variant?: string; quantity?: number } = {},
): AnalyticsItem {
  return {
    item_id: product.id,
    item_name: product.name,
    price: dollars(product.price),
    item_category: product.categoryPath.join("/"),
    ...(product.shop ? { item_brand: product.shop.name } : {}),
    ...(extra.variant ? { item_variant: extra.variant } : {}),
    ...(extra.quantity ? { quantity: extra.quantity } : {}),
  };
}
