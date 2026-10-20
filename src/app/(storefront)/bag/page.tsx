import type { Metadata } from "next";
import { BagPage } from "@/components/bag/BagPage";
import { ProductRail } from "@/components/editorial/ProductCarousel";
import { sortProducts } from "@/lib/catalog/listing";
import { getListingIndex } from "@/lib/catalog/queries";

/** The bag is personal: never indexed. */
export const metadata: Metadata = {
  title: "Your bag",
  robots: { index: false, follow: false },
};

async function Recommendations() {
  const picks = sortProducts(await getListingIndex(), "best_sellers").slice(0, 8);
  return <ProductRail heading="You may also like" products={picks} />;
}

/** Full bag page with recommendations below. */
export default function Page() {
  return (
    <>
      <BagPage />
      <Recommendations />
    </>
  );
}
