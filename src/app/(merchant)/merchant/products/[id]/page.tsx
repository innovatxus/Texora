import type { Metadata } from "next";
import NextLink from "next/link";
import { notFound } from "next/navigation";
import { EditorLoader } from "@/components/merchant/products/EditorLoader";
import { ALL_CATEGORY_CONFIGS } from "@/config/product-attributes";
import { ActionError } from "@/lib/actions/run-action";
import { PRODUCT_STATUS_LABELS } from "@/lib/catalog/product-status";
import { productPreviewPath } from "@/lib/orders/token";
import { getMerchantContext } from "@/lib/merchant/context";
import { getOwnedDraftRecord } from "@/lib/merchant/product-service";
import { listLocations } from "@/lib/merchant/repositories/locations";

export const metadata: Metadata = { title: "Edit product" };

/** The product editor for one of the merchant's products. */
export default async function Page({ params }: PageProps<"/merchant/products/[id]">) {
  const { id } = await params;
  const { session, shop, merchant } = await getMerchantContext();
  if (!shop) notFound();
  const actor = { session, vendorId: session.vendorId };
  let draft;
  try {
    draft = await getOwnedDraftRecord(actor, id);
  } catch (error) {
    if (error instanceof ActionError) notFound();
    throw error;
  }
  if (draft.shopId !== shop.id) notFound();
  const locations = await listLocations(shop.id);
  // Categories the shop sells first, then the rest.
  const categories = [...ALL_CATEGORY_CONFIGS].sort(
    (a, b) =>
      Number(shop.categoryKeys.includes(b.categoryKey)) -
      Number(shop.categoryKeys.includes(a.categoryKey)),
  );
  const counters = shop.counters;

  return (
    <div className="flex max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <NextLink
          href="/merchant/products"
          className="self-start text-sm underline underline-offset-4"
        >
          Products
        </NextLink>
        <h1 className="font-display text-4xl">{draft.summary?.name ?? "New product"}</h1>
        <p className="text-sm text-ink-soft">{PRODUCT_STATUS_LABELS[draft.status]}</p>
      </div>
      <EditorLoader
        initialData={draft.parsed}
        context={{
          productId: draft.id,
          version: draft.version,
          status: draft.status,
          shop: { id: shop.id, name: shop.name, slug: shop.slug },
          locations: locations.map((l) => ({
            id: l.id,
            name: l.name,
            shipFrom: l.types.includes("ship_from"),
          })),
          categories,
          productCount:
            counters.live + counters.draft + counters.inReview + counters.changesRequested,
          reviewNotes: draft.reviewNotes,
          previewHref: productPreviewPath(draft.id),
          trusted: merchant.trustLevel === "trusted",
        }}
      />
    </div>
  );
}
