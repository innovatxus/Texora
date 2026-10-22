import type { Metadata } from "next";
import NextLink from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { DetailsAccordion } from "@/components/pdp/DetailsAccordion";
import { ProductDetail, type PdpProductView } from "@/components/pdp/ProductDetail";
import { productConfigFor, formatComposition } from "@/config/product-attributes";
import { sizeGuideFor } from "@/config/size-guides";
import { ActionError } from "@/lib/actions/run-action";
import type { PdpVariant } from "@/lib/catalog/variant-selection";
import { getMerchantContext } from "@/lib/merchant/context";
import { getOwnedDraftRecord } from "@/lib/merchant/product-service";
import { listLocations, shipFromLocations } from "@/lib/merchant/repositories/locations";
import { onlineStock } from "@/lib/merchant/variants/matrix";
import { verifyProductPreview } from "@/lib/orders/token";
import { FIT_LABELS } from "@/lib/validation/common";

export const metadata: Metadata = { title: "Preview", robots: { index: false, follow: false } };

/**
 * Renders the real storefront PDP components with the draft's data, for the
 * merchant only: the URL carries a signed, time-limited token and the page
 * also checks the signed-in merchant owns the product.
 */
export default async function Page({
  params,
  searchParams,
}: PageProps<"/merchant/products/[id]/preview">) {
  const [{ id }, { e, t }, { session }] = await Promise.all([
    params,
    searchParams,
    getMerchantContext(),
  ]);
  // Ownership first: someone else's product is "not found", whatever the link says.
  let draft;
  try {
    draft = await getOwnedDraftRecord({ session, vendorId: session.vendorId }, id);
  } catch (error) {
    if (error instanceof ActionError) notFound();
    throw error;
  }
  if (
    !verifyProductPreview(
      id,
      typeof e === "string" ? e : undefined,
      typeof t === "string" ? t : undefined,
    )
  ) {
    return (
      <div className="flex max-w-xl flex-col gap-4">
        <h1 className="font-display text-3xl">Preview link expired</h1>
        <p>This preview link has expired. Open it again from the editor.</p>
        <NextLink
          href={`/merchant/products/${id}`}
          className="self-start underline underline-offset-4"
        >
          Back to the editor
        </NextLink>
      </div>
    );
  }
  const data = draft.parsed;
  const shipFrom = shipFromLocations(await listLocations(draft.shopId)).map((l) => l.id);
  const config = productConfigFor(data.categoryKey);
  const prices = data.matrix.map((r) => r.price).filter((p): p is number => p !== null && p > 0);
  const compareAts = data.matrix
    .map((r) => r.compareAtPrice)
    .filter((p): p is number => p !== null && p > 0);

  const variants: PdpVariant[] = data.matrix
    .filter((r) => r.price !== null)
    .map((r) => ({
      sku: r.sku || r.key,
      color: r.color,
      fitFamily: r.fit,
      size: r.size,
      price: r.price ?? 0,
      ...(r.compareAtPrice ? { compareAtPrice: r.compareAtPrice } : {}),
      online: r.availableOnline ? onlineStock(r.stock, shipFrom) + (r.backorder ? 99 : 0) : 0,
      stores: {},
      lowStockThreshold: r.lowStockThreshold,
    }));
  const view: PdpProductView = {
    id: draft.id,
    slug: data.slug || draft.id,
    name: data.name || "Untitled product",
    fitFamilies: data.fits,
    colors: data.colors.map((c) => ({
      code: c.code,
      name: c.name,
      swatch: c.swatch,
      images: c.images.map((i) => ({ url: i.url, alt: i.alt })),
    })),
    priceRange: {
      min: prices.length ? Math.min(...prices) : 0,
      max: prices.length ? Math.max(...prices) : 0,
      ...(compareAts.length ? { compareAtMin: Math.min(...compareAts) } : {}),
    },
    badges: [],
    ratingAvg: 0,
    ratingCount: 0,
    fitScore: null,
    finalSale: false,
  };
  const [department = "women"] = data.categoryKey.split("/");

  return (
    <div className="flex flex-col gap-6">
      <div
        role="status"
        className="flex flex-wrap items-center justify-between gap-3 bg-ink px-4 py-3 text-sm text-canvas"
      >
        <span>Preview — only you can see this page.</span>
        <NextLink href={`/merchant/products/${id}`} className="underline underline-offset-4">
          Back to editor
        </NextLink>
      </div>
      <ProductDetail
        preview
        product={view}
        variants={variants}
        sizeGuide={sizeGuideFor(department, config?.sizeType ?? "alpha")}
        initialColor={view.colors[0]?.code ?? ""}
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: department === "women" ? "Women" : "Men", href: `/${department}` },
              { label: config?.label ?? "Category", href: `/${data.categoryKey}` },
              { label: view.name, href: `/merchant/products/${id}` },
            ]}
          />
        }
        details={
          <DetailsAccordion
            sections={[
              {
                id: "description",
                title: "Description",
                content: (
                  <div className="max-w-prose">
                    <p className="whitespace-pre-line">{data.description}</p>
                    {data.highlights.filter(Boolean).length > 0 && (
                      <ul className="mt-3 list-disc pl-5">
                        {data.highlights.filter(Boolean).map((h) => (
                          <li key={h}>{h}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ),
              },
              {
                id: "fit",
                title: "Fit & sizing",
                content: (
                  <ul className="flex flex-col gap-2">
                    {data.details.fitNotes && <li>{data.details.fitNotes}</li>}
                    {data.details.modelInfo && <li>{data.details.modelInfo}</li>}
                    <li>Available in {data.fits.map((f) => FIT_LABELS[f]).join(", ")}.</li>
                  </ul>
                ),
              },
              {
                id: "fabric",
                title: "Fabric & care",
                content: (
                  <ul className="flex list-disc flex-col gap-1 pl-5">
                    {data.composition.length > 0 && <li>{formatComposition(data.composition)}</li>}
                    {data.details.care.filter(Boolean).map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                ),
              },
            ]}
          />
        }
      />
    </div>
  );
}
