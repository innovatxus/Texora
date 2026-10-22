import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { PLATFORM_RETURN_POLICY } from "@/config/merchant";
import { parseSnapshot } from "@/lib/data/firestore";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import {
  shopSchema,
  type MerchantLocation,
  type ReturnPolicy,
  type Shop,
} from "@/lib/validation/merchant";
import { listLocations } from "./repositories/locations";
import { getShopBySlug } from "./repositories/shops";

/** What shoppers see of a shop: approved shops only, with retail locations and ships-from city. */
export interface PublicShop {
  shop: Shop;
  /** Active retail stores, in the merchant's order, for the shop page. */
  stores: MerchantLocation[];
  /** "Portland, OR" for the PDP's "Ships from" line. */
  shipsFrom: string | null;
}

/** "30-day returns" / "Returns within 14 days" / "Final sale — no returns". */
export function returnSummary(policy: ReturnPolicy): string {
  if (policy.mode === "platform") return `${PLATFORM_RETURN_POLICY.windowDays}-day returns`;
  if (policy.windowDays === 0) return "Final sale — no returns";
  return `Returns within ${policy.windowDays} days${policy.notes ? ` · ${policy.notes}` : ""}`;
}

async function toPublic(shop: Shop | null): Promise<PublicShop | null> {
  if (!shop || shop.status !== "approved") return null;
  const locations = await listLocations(shop.id);
  const shipsFromLocation =
    locations.find((l) => l.id === shop.shipping.shipsFromLocationId) ??
    locations.find((l) => l.types.includes("ship_from"));
  return {
    shop,
    stores: locations.filter((l) => l.types.includes("retail")),
    shipsFrom: shipsFromLocation
      ? `${shipsFromLocation.address.city}, ${shipsFromLocation.address.region}`
      : null,
  };
}

/** An approved shop by address, cached until the shop changes. */
export async function getPublicShopBySlug(slug: string): Promise<PublicShop | null> {
  "use cache";
  cacheTag("shops", `shop:${slug}`);
  cacheLife("hours");
  return toPublic(await getShopBySlug(slug));
}

/** An approved shop by id (the PDP's "Sold by" block), cached until shops change. */
export async function getPublicShopById(shopId: string): Promise<PublicShop | null> {
  "use cache";
  cacheTag("shops", `shop-id:${shopId}`);
  cacheLife("hours");
  const snapshot = await getFirebaseAdmin().db.collection("shops").doc(shopId).get();
  return toPublic(parseSnapshot(shopSchema, snapshot));
}

/** Addresses of every approved shop, for prerendering shop pages. */
export async function listApprovedShopSlugs(): Promise<string[]> {
  "use cache";
  cacheTag("shops");
  cacheLife("hours");
  const snapshot = await getFirebaseAdmin()
    .db.collection("shops")
    .where("status", "==", "approved")
    .select("slug")
    .get();
  return snapshot.docs.map((d) => d.get("slug") as string);
}
