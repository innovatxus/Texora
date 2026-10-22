import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { NewProductStarter } from "@/components/merchant/products/NewProductStarter";
import { getMerchantContext } from "@/lib/merchant/context";

export const metadata: Metadata = { title: "Add a product" };

/** Starts a new product, then opens its editor. Needs a shop first. */
export default async function Page() {
  const { shop } = await getMerchantContext();
  if (!shop) redirect("/merchant/onboarding/basics");
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="font-display text-4xl">Add a product</h1>
      <NewProductStarter />
    </div>
  );
}
