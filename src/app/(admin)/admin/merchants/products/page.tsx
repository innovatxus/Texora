import type { Metadata } from "next";
import NextLink from "next/link";
import { Suspense } from "react";
import { AdminLoading } from "@/components/admin/AdminLoading";
import { formatDateTime } from "@/components/admin/status";
import { AdminPageHeader, DataTable } from "@/components/admin/ui";
import { requirePagePermission } from "@/lib/auth/guard";
import { formatMoney } from "@/lib/format/money";
import { listProductsInReview } from "@/lib/merchant/publishing/publish";

export const metadata: Metadata = { title: "Product reviews" };

async function Queue() {
  await requirePagePermission("merchants.review");
  const queue = await listProductsInReview();
  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader
        title="Product reviews"
        description="Products from standard merchants wait here before going live. Trusted merchants publish directly."
      />
      <DataTable
        caption="Products waiting for review"
        rows={queue}
        rowKey={(row) => row.draft.id}
        empty="Nothing waiting for review."
        columns={[
          {
            header: "Product",
            cell: (row) => (
              <NextLink
                href={`/admin/merchants/products/${row.draft.id}`}
                className="font-medium underline"
              >
                {row.draft.summary?.name ?? "Untitled"}
              </NextLink>
            ),
          },
          { header: "Shop", cell: (row) => row.shopName },
          { header: "Variants", cell: (row) => row.draft.summary?.variants ?? 0, align: "right" },
          {
            header: "From",
            cell: (row) =>
              typeof row.draft.summary?.priceMin === "number"
                ? formatMoney(row.draft.summary.priceMin)
                : "—",
            align: "right",
          },
          { header: "Submitted", cell: (row) => formatDateTime(row.draft.updatedAt) },
        ]}
      />
    </div>
  );
}

/** Queue of merchant products waiting for review. */
export default function Page() {
  return (
    <Suspense fallback={<AdminLoading />}>
      <Queue />
    </Suspense>
  );
}
