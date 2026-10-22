import { redirect } from "next/navigation";
import { getMerchantContext } from "@/lib/merchant/context";

/** Resumes setup where the merchant left off, on any device. */
export default async function Page() {
  const { shop } = await getMerchantContext();
  redirect(`/merchant/onboarding/${shop?.onboardingStep ?? "basics"}`);
}
