import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { StoreLocator } from "@/components/stores/StoreLocator";
import { brand } from "@/config/brand";
import { getStores } from "@/lib/catalog/queries";

/** Title, description and canonical URL for the store locator. */
export const metadata: Metadata = {
  title: "Find a store",
  description: `Opening hours, services and directions for every ${brand.name} store.`,
  alternates: { canonical: "/stores" },
};

/** Store locator listing every store that isn't permanently closed. */
export default async function Page() {
  const stores = (await getStores()).filter((s) => s.status !== "closed");
  return (
    <div className="container-page pt-6 pb-24">
      <Breadcrumbs items={[{ label: "Stores", href: "/stores" }]} />
      <h1 className="mt-8 font-display text-5xl">Find a store</h1>
      <p className="mt-4 max-w-prose text-ink-soft">
        Try on in person, return online orders and book alterations at any of our stores.
      </p>
      <div className="mt-10">
        <StoreLocator stores={stores} />
      </div>
    </div>
  );
}
