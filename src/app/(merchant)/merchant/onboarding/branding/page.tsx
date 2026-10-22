import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BrandingForm } from "@/components/merchant/onboarding/BrandingForm";
import { getMerchantContext } from "@/lib/merchant/context";

export const metadata: Metadata = { title: "Branding" };

/** Step 2: logo, banner and accent colour. */
export default async function Page() {
  const { shop } = await getMerchantContext();
  if (!shop) redirect("/merchant/onboarding/basics");
  return (
    <section aria-labelledby="step-title" className="flex flex-col gap-6">
      <div>
        <h2 id="step-title" className="font-display text-3xl">
          Branding
        </h2>
        <p className="mt-2 text-ink-soft">
          Your logo and banner are optional to continue, but you&apos;ll need both to submit.
        </p>
      </div>
      <BrandingForm
        mode="onboarding"
        shopId={shop.id}
        shopName={shop.name}
        logo={shop.logo}
        banner={shop.banner}
        accent={shop.accent}
      />
    </section>
  );
}
