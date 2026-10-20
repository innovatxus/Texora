import "server-only";
import { parseSnapshot } from "@/lib/data/firestore";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { merchantLocationSchema, type MerchantLocation } from "@/lib/validation/merchant";

const locations = (shopId: string) =>
  getFirebaseAdmin().db.collection("shops").doc(shopId).collection("locations");

/** A shop's locations in display order; archived ones only when asked for. */
export async function listLocations(
  shopId: string,
  { includeArchived = false } = {},
): Promise<MerchantLocation[]> {
  const snapshot = await locations(shopId).get();
  return snapshot.docs
    .map((d) => parseSnapshot(merchantLocationSchema, d))
    .filter((l): l is MerchantLocation => l !== null)
    .filter((l) => includeArchived || l.status === "active")
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/** One location of a shop. */
export async function getLocation(
  shopId: string,
  locationId: string,
): Promise<MerchantLocation | null> {
  return parseSnapshot(merchantLocationSchema, await locations(shopId).doc(locationId).get());
}

/** Active locations orders ship from; their stock sums into the online total (D-065). */
export function shipFromLocations(all: readonly MerchantLocation[]): MerchantLocation[] {
  return all.filter((l) => l.status === "active" && l.types.includes("ship_from"));
}
