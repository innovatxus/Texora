import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LocationsManager } from "@/components/merchant/locations/LocationsManager";
import { getMerchantContext } from "@/lib/merchant/context";
import { listLocations } from "@/lib/merchant/repositories/locations";
import { requestTime } from "@/lib/time";

export const metadata: Metadata = { title: "Locations" };

/** Step 4: where orders ship from, and any stores shoppers can visit. */
export default async function Page() {
  const { shop } = await getMerchantContext();
  if (!shop) redirect("/merchant/onboarding/basics");
  const locations = await listLocations(shop.id);
  return (
    <section aria-labelledby="step-title" className="flex flex-col gap-6">
      <div>
        <h2 id="step-title" className="font-display text-3xl">
          Locations
        </h2>
        <p className="mt-2 text-ink-soft">
          At least one location must ship orders. Retail stores appear on your shop page with their
          hours.
        </p>
      </div>
      <LocationsManager
        mode="onboarding"
        shopId={shop.id}
        locations={locations}
        now={requestTime()}
      />
    </section>
  );
}
