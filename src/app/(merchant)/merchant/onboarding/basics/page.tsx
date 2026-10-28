import type { Metadata } from "next";
import { BasicsForm } from "@/components/merchant/onboarding/BasicsForm";
import { shopCategoryOptions } from "@/lib/merchant/categories";
import { getMerchantContext } from "@/lib/merchant/context";

export const metadata: Metadata = { title: "Shop basics" };

/** Step 1: name, address, story, departments, categories and type. */
export default async function Page() {
  // The session read (inside the context) marks this request-time, so it goes first.
  const { shop } = await getMerchantContext();
  const categories = await shopCategoryOptions();
  return (
    <section aria-labelledby="step-title" className="flex flex-col gap-6">
      <div>
        <h2 id="step-title" className="font-display text-3xl">
          Shop basics
        </h2>
        <p className="mt-2 text-ink-soft">Tell shoppers who you are and what you sell.</p>
      </div>
      <BasicsForm
        mode="onboarding"
        categories={categories}
        {...(shop
          ? {
              shopId: shop.id,
              defaults: {
                name: shop.name,
                slug: shop.slug,
                description: shop.description,
                shopType: shop.shopType,
                departments: shop.departments,
                categoryKeys: shop.categoryKeys,
              },
            }
          : {})}
      />
    </section>
  );
}
