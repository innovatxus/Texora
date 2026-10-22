import type { Metadata } from "next";
import NextLink from "next/link";
import { Suspense } from "react";
import { AdminLoading } from "@/components/admin/AdminLoading";
import { formatDateTime } from "@/components/admin/status";
import { AdminPageHeader, DataTable, StatusPill } from "@/components/admin/ui";
import { requirePagePermission } from "@/lib/auth/guard";
import { listShopsByStatus } from "@/lib/merchant/repositories/shops";
import { SHOP_STATUS_LABELS } from "@/lib/merchant/status";
import { SHOP_STATUSES, type ShopStatus } from "@/lib/validation/merchant";

export const metadata: Metadata = { title: "Merchant shops" };

const TONES: Record<ShopStatus, "neutral" | "success" | "warning" | "danger"> = {
  draft: "neutral",
  pending_review: "warning",
  changes_requested: "warning",
  approved: "success",
  suspended: "danger",
  closed: "neutral",
};

async function Shops({ searchParams }: PageProps<"/admin/merchants">) {
  await requirePagePermission("merchants.review");
  const { status: raw } = await searchParams;
  const status: ShopStatus =
    typeof raw === "string" && (SHOP_STATUSES as readonly string[]).includes(raw)
      ? (raw as ShopStatus)
      : "pending_review";
  const shops = await listShopsByStatus(status);

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader
        title="Merchant shops"
        description="Review new shops, request changes, and pause or reinstate live ones."
      />
      <nav aria-label="Shop status" className="flex flex-wrap gap-2 text-sm">
        {SHOP_STATUSES.map((s) => (
          <NextLink
            key={s}
            href={`/admin/merchants?status=${s}`}
            aria-current={s === status ? "page" : undefined}
            className={`border px-3 py-2 ${s === status ? "border-ink bg-ink text-surface" : "border-line"}`}
          >
            {SHOP_STATUS_LABELS[s]}
          </NextLink>
        ))}
      </nav>
      <DataTable
        caption={`Shops: ${SHOP_STATUS_LABELS[status]}`}
        rows={shops}
        rowKey={(s) => s.id}
        empty={status === "pending_review" ? "Nothing waiting for review." : "No shops here."}
        columns={[
          {
            header: "Shop",
            cell: (s) => (
              <NextLink href={`/admin/merchants/${s.id}`} className="font-medium underline">
                {s.name}
              </NextLink>
            ),
          },
          { header: "Address", cell: (s) => `/shops/${s.slug}` },
          {
            header: "Status",
            cell: (s) => (
              <StatusPill tone={TONES[s.status]}>{SHOP_STATUS_LABELS[s.status]}</StatusPill>
            ),
          },
          {
            header: "Submitted",
            cell: (s) => (s.submittedAt ? formatDateTime(s.submittedAt) : "—"),
          },
          { header: "Updated", cell: (s) => formatDateTime(s.updatedAt) },
        ]}
      />
    </div>
  );
}

/** Merchant shop review queue and directory, by status. */
export default function Page(props: PageProps<"/admin/merchants">) {
  return (
    <Suspense fallback={<AdminLoading />}>
      <Shops {...props} />
    </Suspense>
  );
}
