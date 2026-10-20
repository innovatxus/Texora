import type { Metadata } from "next";
import NextLink from "next/link";
import { Suspense } from "react";
import { ActionButton } from "@/components/admin/ActionButton";
import { ActionForm } from "@/components/admin/ActionForm";
import { AdminLoading } from "@/components/admin/AdminLoading";
import { formatDateTime } from "@/components/admin/status";
import { AdminPageHeader, DataTable, Panel } from "@/components/admin/ui";
import { decidePriceChangeAction, setPriceAction } from "@/lib/admin/catalog-actions";
import { listPriceRequests } from "@/lib/admin/merch-service";
import { percentOff } from "@/lib/admin/pricing";
import { requirePagePermission } from "@/lib/auth/guard";
import { hasPermission } from "@/lib/auth/rbac";
import { formatMoney } from "@/lib/format/money";

/** Price changes title. */
export const metadata: Metadata = { title: "Price changes" };

async function Pricing() {
  const session = await requirePagePermission("pricing.write");
  const canApprove = hasPermission(session.role, "pricing.approve");
  const [pending, approved, rejected] = await Promise.all([
    listPriceRequests("pending"),
    listPriceRequests("approved"),
    listPriceRequests("rejected"),
  ]);
  const decided = [...approved, ...rejected]
    .sort((a, b) => (b.decidedAt?.getTime() ?? 0) - (a.decidedAt?.getTime() ?? 0))
    .slice(0, 20);

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Price changes"
        description="Approve requests from merchandisers and set markdowns."
      />
      <Panel title={`Waiting for approval (${pending.length})`}>
        <DataTable
          caption="Price change requests waiting for approval"
          rows={pending}
          rowKey={(r) => r.id}
          empty="No requests waiting."
          columns={[
            {
              header: "SKU",
              cell: (r) => (
                <NextLink
                  href={`/admin/catalog/${r.productId}`}
                  className="font-mono text-xs underline"
                >
                  {r.sku}
                </NextLink>
              ),
            },
            { header: "Now", cell: (r) => formatMoney(r.currentPrice), align: "right" },
            {
              header: "Proposed",
              cell: (r) =>
                r.proposedCompareAtPrice
                  ? `${formatMoney(r.proposedPrice)} (was ${formatMoney(r.proposedCompareAtPrice)}, ${percentOff(r.proposedPrice, r.proposedCompareAtPrice)}% off)`
                  : formatMoney(r.proposedPrice),
              align: "right",
            },
            { header: "Reason", cell: (r) => r.reason },
            { header: "Requested", cell: (r) => formatDateTime(r.createdAt) },
            {
              header: "Decision",
              cell: (r) =>
                canApprove ? (
                  <span className="flex gap-2">
                    <ActionButton
                      action={decidePriceChangeAction}
                      payload={{ requestId: r.id, decision: "approved" }}
                      variant="primary"
                    >
                      Approve
                    </ActionButton>
                    <ActionButton
                      action={decidePriceChangeAction}
                      payload={{ requestId: r.id, decision: "rejected" }}
                    >
                      Reject
                    </ActionButton>
                  </span>
                ) : (
                  <span className="text-ink-soft">Needs a pricing approver</span>
                ),
            },
          ]}
        />
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <Panel title="Recently decided">
          <DataTable
            caption="Recently decided price changes"
            rows={decided}
            rowKey={(r) => r.id}
            empty="Nothing decided yet."
            columns={[
              { header: "SKU", cell: (r) => <span className="font-mono text-xs">{r.sku}</span> },
              { header: "Price", cell: (r) => formatMoney(r.proposedPrice), align: "right" },
              { header: "Decision", cell: (r) => r.status },
              { header: "When", cell: (r) => (r.decidedAt ? formatDateTime(r.decidedAt) : "—") },
            ]}
          />
        </Panel>
        <Panel title="Set a price or markdown">
          <ActionForm
            action={setPriceAction}
            submitLabel="Apply"
            done="Price updated"
            confirm="Change this price now? It goes live immediately."
            fields={[
              {
                name: "sku",
                label: "SKU",
                type: "text",
                required: true,
                placeholder: "W104-CHARCOAL-R-M",
              },
              { name: "price", label: "Price ($)", type: "number", step: "0.01", required: true },
              {
                name: "compareAtPrice",
                label: "Compare-at price ($)",
                type: "number",
                step: "0.01",
                hint: "The original price, shown struck through. Leave empty for full price.",
              },
              { name: "reason", label: "Reason", type: "text", required: true },
            ]}
          />
        </Panel>
      </div>
    </div>
  );
}

/** Price changes: approval queue, history and direct markdowns. */
export default function Page() {
  return (
    <Suspense fallback={<AdminLoading />}>
      <Pricing />
    </Suspense>
  );
}
