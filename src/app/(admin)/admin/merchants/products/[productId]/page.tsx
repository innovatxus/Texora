import type { Metadata } from "next";
import Image from "next/image";
import NextLink from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AdminLoading } from "@/components/admin/AdminLoading";
import { DecisionForm } from "@/components/admin/DecisionForm";
import { AdminPageHeader, DetailList, Panel, StatusPill } from "@/components/admin/ui";
import { formatComposition, productConfigFor } from "@/config/product-attributes";
import { requirePagePermission } from "@/lib/auth/guard";
import { PRODUCT_STATUS_LABELS } from "@/lib/catalog/product-status";
import { formatMoney } from "@/lib/format/money";
import { reviewProductAction } from "@/lib/merchant/actions/admin";
import { draftPublishProblems, getDraftForReview } from "@/lib/merchant/publishing/publish";
import { getShop } from "@/lib/merchant/repositories/shops";
import { FIT_LABELS } from "@/lib/validation/common";
import { productDraftDataSchema } from "@/lib/validation/merchant";

export const metadata: Metadata = { title: "Review product" };

async function Review({ params }: PageProps<"/admin/merchants/products/[productId]">) {
  await requirePagePermission("merchants.review");
  const { productId } = await params;
  const draft = await getDraftForReview(productId);
  if (!draft) notFound();
  const data = productDraftDataSchema.parse(draft.data);
  const [shop, problems] = await Promise.all([getShop(draft.shopId), draftPublishProblems(draft)]);
  const prices = data.matrix.map((r) => r.price).filter((p): p is number => p !== null);

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader
        eyebrow={
          <NextLink href="/admin/merchants/products" className="underline">
            Product reviews
          </NextLink>
        }
        title={data.name || "Untitled product"}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusPill>{PRODUCT_STATUS_LABELS[draft.status]}</StatusPill>
            {shop && (
              <NextLink href={`/admin/merchants/${shop.id}`} className="underline">
                {shop.name}
              </NextLink>
            )}
          </span>
        }
      />
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="flex flex-col gap-5 lg:col-span-2">
          <Panel title="Photos">
            {data.colors.map((color) => (
              <div key={color.code} className="mb-4">
                <p className="mb-2 text-sm font-medium">{color.name}</p>
                <ul className="flex flex-wrap gap-3">
                  {color.images.map((image) => (
                    <li key={image.mediaId} className="w-28">
                      <div className="relative aspect-[3/4] bg-surface-muted">
                        <Image
                          src={image.url}
                          alt={image.alt}
                          fill
                          sizes="112px"
                          className="object-cover"
                        />
                      </div>
                      <p className="mt-1 text-xs text-ink-soft">{image.alt}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </Panel>
          <Panel title="Details">
            <DetailList
              items={[
                ["Category", productConfigFor(data.categoryKey)?.label ?? data.categoryKey],
                [
                  "Description",
                  <span key="d" className="whitespace-pre-line">
                    {data.description}
                  </span>,
                ],
                [
                  "Attributes",
                  Object.entries(data.attributes)
                    .map(([k, v]) => `${k}: ${[v].flat().join(", ")}`)
                    .join(" · ") || "—",
                ],
                [
                  "Composition",
                  data.composition.length ? formatComposition(data.composition) : "—",
                ],
                ["Fits", data.fits.map((f) => FIT_LABELS[f]).join(", ")],
                ["Sizes", data.sizes.join(", ")],
                ["Variants", `${data.matrix.length}`],
                [
                  "Prices",
                  prices.length
                    ? `${formatMoney(Math.min(...prices))} – ${formatMoney(Math.max(...prices))}`
                    : "—",
                ],
              ]}
            />
          </Panel>
        </div>
        <div className="flex flex-col gap-5">
          <Panel title="Checks">
            {problems.length === 0 ? (
              <p className="text-sm text-success">Everything required is in place.</p>
            ) : (
              <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-sale">
                {problems.map((p) => (
                  <li key={p.message}>{p.message}</li>
                ))}
              </ul>
            )}
          </Panel>
          {draft.status !== "in_review" && (
            <Panel title="Decision">
              <p role="status" className="text-sm">
                {draft.status === "live"
                  ? "Approved. It's live on the storefront once the shop is approved."
                  : draft.status === "scheduled"
                    ? "Approved. It goes live at the merchant's scheduled time."
                    : draft.status === "changes_requested"
                      ? "Changes requested. Waiting for the merchant."
                      : `Not waiting for review (${PRODUCT_STATUS_LABELS[draft.status].toLowerCase()}).`}
              </p>
            </Panel>
          )}
          {draft.status === "in_review" && (
            <Panel title="Decision">
              <DecisionForm
                action={reviewProductAction}
                payload={{ productId: draft.id }}
                options={[
                  { value: "approve", label: "Approve", needsReason: false, variant: "primary" },
                  { value: "changes", label: "Request changes", needsReason: true },
                ]}
                done={{
                  approve: "Approved. It's live (or scheduled), once the shop is approved.",
                  changes: "Changes requested. The merchant has been emailed.",
                }}
              />
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}

/** A merchant product in review: photos, details, automatic checks and the decision. */
export default function Page(props: PageProps<"/admin/merchants/products/[productId]">) {
  return (
    <Suspense fallback={<AdminLoading />}>
      <Review {...props} />
    </Suspense>
  );
}
