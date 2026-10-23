import { PRODUCT_STATUS_LABELS, PRODUCT_STATUS_TONES } from "@/lib/catalog/product-status";
import type { Metadata } from "next";
import Image from "next/image";
import NextLink from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ActionButton } from "@/components/admin/ActionButton";
import { ActionForm } from "@/components/admin/ActionForm";
import { AdminLoading } from "@/components/admin/AdminLoading";
import { formatDateTime } from "@/components/admin/status";
import { AdminPageHeader, DetailList, Panel, StatusPill } from "@/components/admin/ui";
import {
  changePriceAction,
  moveImageAction,
  setProductStatusAction,
  updateProductAction,
} from "@/lib/admin/catalog-actions";
import { getProductForEdit } from "@/lib/admin/catalog-service";
import { requirePagePermission } from "@/lib/auth/guard";
import { hasPermission, type Permission } from "@/lib/auth/rbac";
import { compareSizes } from "@/lib/catalog/sizes";
import { formatMoney } from "@/lib/format/money";
import { ONLINE_LOCATION, PRODUCT_BADGES, type Variant } from "@/lib/validation";

/** Product editor title. */
export const metadata: Metadata = { title: "Product" };

const BADGE_LABELS: Record<(typeof PRODUCT_BADGES)[number], string> = {
  sale: "Sale",
  final_sale: "Final sale",
  low_stock: "Low stock",
  back_in_stock: "Back in stock",
  online_exclusive: "Online exclusive",
  new: "New",
};

/** "2026-10-19T15:04" for a datetime-local input. */
const localInput = (d: Date) =>
  new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

function VariantMatrix({ variants, color }: { variants: Variant[]; color: string }) {
  const inColor = variants.filter((v) => v.color === color);
  const fits = [...new Set(inColor.map((v) => v.fitFamily))];
  const sizes = [...new Set(inColor.map((v) => v.size))].sort(compareSizes);
  return (
    <div
      tabIndex={0}
      role="region"
      aria-label={`Variants in ${color}`}
      className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-ink"
    >
      <table className="text-xs tabular-nums">
        <caption className="sr-only">Price and online stock for {color}, by fit and size</caption>
        <thead>
          <tr>
            <th scope="col" className="px-2 py-1 text-left font-medium text-ink-subtle">
              Fit
            </th>
            {sizes.map((s) => (
              <th key={s} scope="col" className="px-2 py-1 font-medium text-ink-subtle">
                {s.replace("x", "×")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {fits.map((fit) => (
            <tr key={fit} className="border-t border-line">
              <th scope="row" className="px-2 py-1 text-left font-medium capitalize">
                {fit}
              </th>
              {sizes.map((size) => {
                const v = inColor.find((x) => x.fitFamily === fit && x.size === size);
                const stock = v?.stockByLocation[ONLINE_LOCATION] ?? 0;
                return (
                  <td key={size} className="px-2 py-1 text-center" title={v?.sku}>
                    {v ? (
                      <>
                        <span className="block">{formatMoney(v.price)}</span>
                        <span
                          className={stock <= v.lowStockThreshold ? "text-sale" : "text-ink-soft"}
                        >
                          {stock} online
                        </span>
                      </>
                    ) : (
                      <span className="text-ink-subtle">—</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function Editor({ params }: PageProps<"/admin/catalog/[id]">) {
  await connection();
  const session = await requirePagePermission("catalog.read_drafts");
  const can = (p: Permission) => hasPermission(session.role, p);
  const { id } = await params;
  const data = await getProductForEdit(id);
  if (!data) notFound();
  const { product, variants } = data;
  const directPricing = can("pricing.write");

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        eyebrow={
          <NextLink href="/admin/catalog" className="underline">
            Products
          </NextLink>
        }
        title={product.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusPill tone={PRODUCT_STATUS_TONES[product.status]}>
              {PRODUCT_STATUS_LABELS[product.status]}
            </StatusPill>
            <span className="font-mono text-xs">{product.id}</span> · updated{" "}
            {formatDateTime(product.updatedAt)}
          </span>
        }
        actions={
          <>
            {product.status === "live" && (
              <NextLink
                href={`/product/${product.slug}`}
                target="_blank"
                className="text-sm underline"
              >
                View on site<span className="sr-only"> (opens in a new tab)</span>
              </NextLink>
            )}
            {can("catalog.publish") && product.status !== "live" && (
              <ActionButton
                action={setProductStatusAction}
                payload={{ productIds: [product.id], status: "live" }}
                variant="primary"
              >
                Publish
              </ActionButton>
            )}
            {can("catalog.publish") && product.status === "live" && (
              <ActionButton
                action={setProductStatusAction}
                payload={{ productIds: [product.id], status: "draft" }}
                confirm="Unpublish this product? It disappears from the shop."
              >
                Unpublish
              </ActionButton>
            )}
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="flex flex-col gap-6">
          <Panel title="Content">
            {can("catalog.write") ? (
              <ActionForm
                action={updateProductAction}
                payload={{ productId: product.id }}
                submitLabel="Save"
                variant="primary"
                resetOnSuccess={false}
                fields={[
                  {
                    name: "name",
                    label: "Name",
                    type: "text",
                    required: true,
                    defaultValue: product.name,
                  },
                  {
                    name: "description",
                    label: "Description",
                    type: "textarea",
                    rows: 6,
                    defaultValue: product.description,
                  },
                  ...PRODUCT_BADGES.map((b) => ({
                    name: `badge_${b}`,
                    label: `Badge: ${BADGE_LABELS[b]}`,
                    type: "checkbox" as const,
                    defaultChecked: product.badges.includes(b),
                  })),
                  {
                    name: "seoTitle",
                    label: "SEO title",
                    type: "text",
                    defaultValue: product.seo.title ?? "",
                    hint: "Up to 70 characters. Leave empty to use the product name.",
                  },
                  {
                    name: "seoDescription",
                    label: "SEO description",
                    type: "textarea",
                    rows: 2,
                    defaultValue: product.seo.description ?? "",
                    hint: "Up to 160 characters.",
                  },
                  {
                    name: "publishAt",
                    label: "Scheduled publish (your local time)",
                    type: "datetime-local",
                    defaultValue: product.publishAt ? localInput(product.publishAt) : "",
                  },
                ]}
              />
            ) : (
              <p className="whitespace-pre-line text-ink-soft">{product.description}</p>
            )}
          </Panel>

          {product.colors.map((color) => (
            <Panel key={color.code} title={`${color.name}`}>
              <div className="flex flex-col gap-5">
                <VariantMatrix variants={variants} color={color.code} />
                <div>
                  <h3 className="mb-2 text-xs text-ink-soft">Images (first is the main image)</h3>
                  <ol className="flex flex-wrap gap-3">
                    {color.images.map((image, i) => (
                      <li key={image.url} className="flex w-28 flex-col gap-1">
                        <span className="relative aspect-3/4 bg-surface-muted">
                          <Image
                            src={image.url}
                            alt={image.alt}
                            fill
                            sizes="112px"
                            className="object-cover"
                          />
                        </span>
                        {can("catalog.write") && (
                          <span className="flex gap-1">
                            <ActionButton
                              action={moveImageAction}
                              payload={{
                                productId: product.id,
                                color: color.code,
                                from: i,
                                to: i - 1,
                              }}
                              variant="secondary"
                              className={i === 0 ? "invisible w-11 px-0" : "w-11 px-0"}
                            >
                              ← <span className="sr-only">Move image {i + 1} earlier</span>
                            </ActionButton>
                            <ActionButton
                              action={moveImageAction}
                              payload={{
                                productId: product.id,
                                color: color.code,
                                from: i,
                                to: i + 1,
                              }}
                              variant="secondary"
                              className={
                                i === color.images.length - 1 ? "invisible w-11 px-0" : "w-11 px-0"
                              }
                            >
                              → <span className="sr-only">Move image {i + 1} later</span>
                            </ActionButton>
                          </span>
                        )}
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </Panel>
          ))}
        </div>

        <aside className="flex flex-col gap-6">
          <Panel title="Summary">
            <DetailList
              items={[
                ["Category", product.categoryPath.join(" / ")],
                ["Fits", product.fitFamilies.join(", ")],
                ["Size type", product.sizeType.replace("_", " × ")],
                ["Variants", variants.length],
                [
                  "Price",
                  product.priceRange.min === product.priceRange.max
                    ? formatMoney(product.priceRange.min)
                    : `${formatMoney(product.priceRange.min)} – ${formatMoney(product.priceRange.max)}`,
                ],
                [
                  "Rating",
                  product.ratingCount > 0
                    ? `${product.ratingAvg.toFixed(1)} (${product.ratingCount})`
                    : "—",
                ],
              ]}
            />
          </Panel>

          {can("catalog.write") && (
            <Panel title={directPricing ? "Change a price" : "Request a price change"}>
              <p className="mb-3 text-ink-soft">
                {directPricing
                  ? "Applies immediately and updates the product's price range and sale badge."
                  : "A pricing manager approves the change before it goes live."}
              </p>
              <ActionForm
                action={changePriceAction}
                submitLabel={directPricing ? "Apply price" : "Send for approval"}
                done={directPricing ? "Price updated" : "Request sent"}
                fields={[
                  {
                    name: "sku",
                    label: "SKU",
                    type: "select",
                    required: true,
                    options: variants
                      .slice()
                      .sort((a, b) => a.sku.localeCompare(b.sku))
                      .map((v) => ({
                        value: v.sku,
                        label: `${v.color} · ${v.fitFamily} · ${v.size} — ${formatMoney(v.price)}`,
                      })),
                  },
                  {
                    name: "price",
                    label: "New price (EGP)",
                    type: "number",
                    step: "0.01",
                    required: true,
                  },
                  {
                    name: "compareAtPrice",
                    label: "Compare-at price (EGP)",
                    type: "number",
                    step: "0.01",
                    hint: "The original price, for a markdown. Leave empty for full price.",
                  },
                  { name: "reason", label: "Reason", type: "text", required: true },
                ]}
              />
            </Panel>
          )}
        </aside>
      </div>
    </div>
  );
}

/** One product: content, SEO, schedule, status, variant matrix, images and pricing. */
export default function Page(props: PageProps<"/admin/catalog/[id]">) {
  return (
    <Suspense fallback={<AdminLoading />}>
      <Editor {...props} />
    </Suspense>
  );
}
