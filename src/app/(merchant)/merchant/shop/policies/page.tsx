import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ContactForm } from "@/components/merchant/onboarding/ContactForm";
import { getMerchantContext } from "@/lib/merchant/context";
import { listLocations, shipFromLocations } from "@/lib/merchant/repositories/locations";

export const metadata: Metadata = { title: "Shop policies" };

/** Shop › Policies: contact, returns and shipping. */
export default async function Page() {
  const { shop } = await getMerchantContext();
  if (!shop) redirect("/merchant/onboarding/basics");
  const shipFrom = shipFromLocations(await listLocations(shop.id));
  return (
    <ContactForm
      mode="settings"
      shop={shop}
      shipFromOptions={shipFrom.map((l) => ({ value: l.id, label: l.name }))}
    />
  );
}
