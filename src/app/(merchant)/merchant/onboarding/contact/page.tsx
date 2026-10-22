import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ContactForm } from "@/components/merchant/onboarding/ContactForm";
import { getMerchantContext } from "@/lib/merchant/context";
import { listLocations, shipFromLocations } from "@/lib/merchant/repositories/locations";

export const metadata: Metadata = { title: "Contact & policies" };

/** Step 3: public contact details, social handles, returns and shipping. */
export default async function Page() {
  const { shop } = await getMerchantContext();
  if (!shop) redirect("/merchant/onboarding/basics");
  const shipFrom = shipFromLocations(await listLocations(shop.id));
  return (
    <section aria-labelledby="step-title" className="flex flex-col gap-6">
      <div>
        <h2 id="step-title" className="font-display text-3xl">
          Contact & policies
        </h2>
        <p className="mt-2 text-ink-soft">
          How shoppers reach you, and what to expect after they buy.
        </p>
      </div>
      <ContactForm
        mode="onboarding"
        shop={shop}
        shipFromOptions={shipFrom.map((l) => ({ value: l.id, label: l.name }))}
      />
    </section>
  );
}
