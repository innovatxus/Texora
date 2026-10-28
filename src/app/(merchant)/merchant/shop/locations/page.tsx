import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LocationsManager } from "@/components/merchant/locations/LocationsManager";
import { getMerchantContext } from "@/lib/merchant/context";
import { listLocations } from "@/lib/merchant/repositories/locations";

export const metadata: Metadata = { title: "Shop locations" };

/** Shop › Locations. */
export default async function Page() {
  const { shop } = await getMerchantContext();
  if (!shop) redirect("/merchant/onboarding/basics");
  return (
    <LocationsManager mode="settings" shopId={shop.id} locations={await listLocations(shop.id)} />
  );
}
