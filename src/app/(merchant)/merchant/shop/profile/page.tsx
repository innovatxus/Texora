import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BasicsForm } from "@/components/merchant/onboarding/BasicsForm";
import { ShopOpenToggle } from "@/components/merchant/shop/ShopOpenToggle";
import { MERCHANT_LIMITS } from "@/config/merchant";
import { formatDate } from "@/lib/format/date";
import { shopCategoryOptions } from "@/lib/merchant/categories";
import { getMerchantContext } from "@/lib/merchant/context";

export const metadata: Metadata = { title: "Shop profile" };

/** Shop › Profile: basics, plus close / reopen. */
export default async function Page() {
  // The session read (inside the context) marks this request-time, so it goes first.
  const { shop } = await getMerchantContext();
  const categories = await shopCategoryOptions();
  if (!shop) redirect("/merchant/onboarding/basics");
  const reopenUntil = shop.closedAt
    ? formatDate(
        new Date(shop.closedAt.getTime() + MERCHANT_LIMITS.shop.reopenWithinDays * 86_400_000),
      )
    : null;
  return (
    <div className="flex flex-col gap-10">
      {shop.status === "approved" && (
        <p className="text-sm text-ink-soft">
          Changing your shop address breaks links you&apos;ve shared to the old one.
        </p>
      )}
      <BasicsForm
        mode="settings"
        shopId={shop.id}
        categories={categories}
        defaults={{
          name: shop.name,
          slug: shop.slug,
          description: shop.description,
          shopType: shop.shopType,
          departments: shop.departments,
          categoryKeys: shop.categoryKeys,
        }}
      />
      {shop.status !== "suspended" && (
        <ShopOpenToggle
          shopId={shop.id}
          closed={shop.status === "closed"}
          reopenUntil={reopenUntil}
        />
      )}
    </div>
  );
}
