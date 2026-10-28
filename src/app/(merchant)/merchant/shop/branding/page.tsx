import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BrandingForm } from "@/components/merchant/onboarding/BrandingForm";
import { getMerchantContext } from "@/lib/merchant/context";

export const metadata: Metadata = { title: "Shop branding" };

/** Shop › Branding. */
export default async function Page() {
  const { shop } = await getMerchantContext();
  if (!shop) redirect("/merchant/onboarding/basics");
  return <BrandingForm mode="settings" shopId={shop.id} shopName={shop.name} logo={shop.logo} />;
}
