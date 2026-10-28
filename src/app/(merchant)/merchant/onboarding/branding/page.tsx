import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BrandingForm } from "@/components/merchant/onboarding/BrandingForm";
import { getMerchantContext } from "@/lib/merchant/context";

export const metadata: Metadata = { title: "Branding" };

/** Step 2: the logo. */
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
          Your shop page opens with a Texora-green banner showing your logo and shop name. You can
          continue without a logo, but you&apos;ll need one to submit.
        </p>
      </div>
      <BrandingForm mode="onboarding" shopId={shop.id} shopName={shop.name} logo={shop.logo} />
    </section>
  );
}
