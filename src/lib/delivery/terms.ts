import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { getStoreSettings } from "@/lib/data/admin-records";
import type { StoreSettings } from "@/lib/validation";

/** What product pages say about delivery: prices per zone and the free-delivery threshold. */
export interface DeliveryTerms {
  freeFrom: number;
  rates: StoreSettings["shippingRates"];
}

/** Delivery terms from store settings, cached; saving settings revalidates "settings". */
export async function getDeliveryTerms(): Promise<DeliveryTerms | null> {
  "use cache";
  cacheTag("settings");
  cacheLife("hours");
  try {
    const settings = await getStoreSettings();
    return { freeFrom: settings.freeShippingThreshold, rates: settings.shippingRates };
  } catch {
    return null;
  }
}
