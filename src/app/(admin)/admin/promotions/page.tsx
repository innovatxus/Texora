import type { Metadata } from "next";
import NextLink from "next/link";
import { Suspense } from "react";
import { ActionForm } from "@/components/admin/ActionForm";
import { AdminLoading } from "@/components/admin/AdminLoading";
import { PROMOTION_TYPE_LABELS, promotionFields } from "@/components/admin/promotion-fields";
import { formatDate } from "@/components/admin/status";
import { AdminPageHeader, DataTable, Panel, StatusPill } from "@/components/admin/ui";
import { listPromotions } from "@/lib/admin/merch-service";
import { savePromotionAction } from "@/lib/admin/ops-actions";
import { requirePagePermission } from "@/lib/auth/guard";
import { isScheduledNow } from "@/lib/data/promotions";
import { requestTime } from "@/lib/time";
import { formatMoney } from "@/lib/format/money";
import type { Promotion } from "@/lib/validation";

/** Promotions title. */
export const metadata: Metadata = { title: "Promotions" };

const describe = (p: Promotion) =>
  p.type === "percent"
    ? `${p.value}% off`
    : p.type === "fixed"
      ? `${formatMoney(p.value)} off`
      : p.type === "tiered"
        ? (p.tiers ?? []).map((t) => `${t.value}% over ${formatMoney(t.minSubtotal)}`).join(", ")
        : PROMOTION_TYPE_LABELS[p.type];

async function Promotions() {
  await requirePagePermission("promotions.write");
  const promotions = await listPromotions();
  const now = requestTime();
  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader title="Promotions" description="Discounts, free shipping and their codes." />
      <DataTable
        caption="Promotions"
        rows={promotions}
        rowKey={(p) => p.id}
        empty="No promotions yet."
        columns={[
          {
            header: "Promotion",
            cell: (p) => (
              <NextLink href={`/admin/promotions/${p.id}`} className="font-medium underline">
                {p.name}
              </NextLink>
            ),
          },
          { header: "Offer", cell: describe },
          { header: "How", cell: (p) => (p.automatic ? "Automatic" : "Code") },
          {
            header: "Window",
            cell: (p) =>
              p.schedule.startsAt || p.schedule.endsAt
                ? `${p.schedule.startsAt ? formatDate(p.schedule.startsAt) : "Now"} – ${p.schedule.endsAt ? formatDate(p.schedule.endsAt) : "open"}`
                : "Always",
          },
          { header: "Priority", cell: (p) => p.priority, align: "right" },
          {
            header: "Status",
            cell: (p) =>
              !p.active ? (
                <StatusPill>Off</StatusPill>
              ) : isScheduledNow(p, now) ? (
                <StatusPill tone="success">Running</StatusPill>
              ) : (
                <StatusPill tone="warning">Scheduled</StatusPill>
              ),
          },
        ]}
      />
      <Panel title="New promotion">
        <ActionForm
          action={savePromotionAction}
          submitLabel="Create promotion"
          done="Promotion created"
          variant="primary"
          className="grid gap-4 md:grid-cols-2"
          fields={promotionFields()}
        />
      </Panel>
    </div>
  );
}

/** Promotions: list with live status and a create form. */
export default function Page() {
  return (
    <Suspense fallback={<AdminLoading />}>
      <Promotions />
    </Suspense>
  );
}
