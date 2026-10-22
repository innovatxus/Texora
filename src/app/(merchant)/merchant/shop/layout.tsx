import NextLink from "next/link";
import { redirect } from "next/navigation";
import { getMerchantContext } from "@/lib/merchant/context";
import { SHOP_STATUS_LABELS } from "@/lib/merchant/status";

const TABS = [
  { href: "/merchant/shop/profile", label: "Profile" },
  { href: "/merchant/shop/branding", label: "Branding" },
  { href: "/merchant/shop/locations", label: "Locations" },
  { href: "/merchant/shop/policies", label: "Policies" },
] as const;

/** Shop settings after onboarding (journey §11): the same forms, saved in place. */
export default async function ShopLayout({ children }: LayoutProps<"/merchant/shop">) {
  const { shop } = await getMerchantContext();
  if (!shop) redirect("/merchant/onboarding/basics");
  return (
    <div className="flex max-w-4xl flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-4xl">{shop.name}</h1>
        <p className="text-ink-soft">
          {SHOP_STATUS_LABELS[shop.status]}
          {shop.status === "approved" && " · Changes appear on your shop page within a minute."}
        </p>
      </div>
      <nav aria-label="Shop settings" className="overflow-x-auto border-b border-line">
        <ul className="flex gap-6 text-sm">
          {TABS.map((tab) => (
            <li key={tab.href}>
              <NextLink
                href={tab.href}
                className="flex min-h-11 items-center underline-offset-4 hover:underline"
              >
                {tab.label}
              </NextLink>
            </li>
          ))}
        </ul>
      </nav>
      {children}
    </div>
  );
}
