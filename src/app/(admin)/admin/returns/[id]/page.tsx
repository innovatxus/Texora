import type { Metadata } from "next";
import NextLink from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ActionButton } from "@/components/admin/ActionButton";
import { ActionForm } from "@/components/admin/ActionForm";
import { AdminLoading } from "@/components/admin/AdminLoading";
import { ReceiveReturnForm } from "@/components/admin/ReceiveReturnForm";
import { formatDateTime, ReturnStatusPill } from "@/components/admin/status";
import { AdminPageHeader, DataTable, DetailList, Panel } from "@/components/admin/ui";
import { formatSize } from "@/components/orders/OrderParts";
import {
  decideReturnAction,
  refundReturnAction,
  resendReturnInstructionsAction,
} from "@/lib/admin/sales-actions";
import { requirePagePermission } from "@/lib/auth/guard";
import { hasPermission, type Permission } from "@/lib/auth/rbac";
import { listStores } from "@/lib/data/catalog-structure";
import { getOrder } from "@/lib/data/orders";
import { getReturn } from "@/lib/data/returns";
import { formatMoney } from "@/lib/format/money";
import { RETURN_REASONS, RETURN_STATUS_LABELS } from "@/lib/returns/policy";
import { ONLINE_LOCATION } from "@/lib/validation";

/** Return detail title. */
export const metadata: Metadata = { title: "Return" };

async function ReturnDetail({ params }: PageProps<"/admin/returns/[id]">) {
  await connection();
  const session = await requirePagePermission("returns.read");
  const can = (p: Permission) => hasPermission(session.role, p);
  const { id } = await params;
  const record = await getReturn(id);
  if (!record) notFound();
  const [order, stores] = await Promise.all([getOrder(record.orderId), listStores()]);
  const lineFor = (sku: string) => order?.lines.find((l) => l.sku === sku);
  const label = (sku: string) => {
    const l = lineFor(sku);
    return l ? `${l.name}, ${l.colorName}, ${formatSize(l.size)}` : sku;
  };
  const store = stores.find((s) => s.id === record.storeId);

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        eyebrow={
          <NextLink href="/admin/returns" className="underline">
            Returns
          </NextLink>
        }
        title={record.number}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <ReturnStatusPill status={record.status} /> Requested {formatDateTime(record.createdAt)}{" "}
            by {record.email}
          </span>
        }
        actions={
          can("emails.resend") && (
            <ActionButton
              action={resendReturnInstructionsAction}
              payload={{ returnId: record.id }}
              done="Email sent"
            >
              Resend instructions
            </ActionButton>
          )
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <div className="flex flex-col gap-6">
          <Panel title="Items">
            <DataTable
              caption="Returned items"
              rows={record.lines}
              rowKey={(l) => l.sku}
              columns={[
                { header: "Item", cell: (l) => label(l.sku) },
                { header: "SKU", cell: (l) => <span className="font-mono text-xs">{l.sku}</span> },
                { header: "Qty", cell: (l) => l.quantity, align: "right" },
                {
                  header: "Reason",
                  cell: (l) => (
                    <>
                      {RETURN_REASONS.find((r) => r.value === l.reason)?.label ?? l.reason}
                      {l.comment && (
                        <span className="block text-xs text-ink-soft">“{l.comment}”</span>
                      )}
                    </>
                  ),
                },
                { header: "Condition", cell: (l) => l.condition ?? "—" },
              ]}
            />
          </Panel>
          <Panel title="History">
            <ol className="flex flex-col gap-2">
              {record.statusHistory.map((h, i) => (
                <li key={`${h.status}-${i}`} className="flex gap-3">
                  <span className="w-36 text-ink-subtle">{formatDateTime(h.at)}</span>
                  <span>{RETURN_STATUS_LABELS[h.status]}</span>
                </li>
              ))}
            </ol>
          </Panel>
        </div>

        <aside className="flex flex-col gap-6">
          <Panel title="Details">
            <DetailList
              items={[
                [
                  "Order",
                  can("orders.read") ? (
                    <NextLink href={`/admin/orders/${record.orderId}`} className="underline">
                      {record.orderNumber}
                    </NextLink>
                  ) : (
                    record.orderNumber
                  ),
                ],
                [
                  "Method",
                  record.method === "mail" ? "Mail" : `In store: ${store?.name ?? record.storeId}`,
                ],
                [
                  "Label",
                  record.label ? `${record.label.carrier} ${record.label.trackingNumber}` : "—",
                ],
                [
                  "Refund to",
                  record.refundTo === "store_credit" ? "Store credit" : "Original payment",
                ],
                ["Estimate", formatMoney(record.refundEstimate)],
                [
                  "Refunded",
                  record.refundAmount !== undefined ? formatMoney(record.refundAmount) : "—",
                ],
                ...(record.staffNote ? [["Note", record.staffNote] as [string, string]] : []),
              ]}
            />
          </Panel>

          {record.status === "requested" && can("returns.approve") && (
            <Panel title="Decision">
              <div className="flex flex-col gap-3">
                <ActionButton
                  action={decideReturnAction}
                  payload={{ returnId: record.id, decision: "approved" }}
                  variant="primary"
                >
                  Approve
                </ActionButton>
                <ActionForm
                  action={decideReturnAction}
                  payload={{ returnId: record.id, decision: "denied" }}
                  submitLabel="Deny"
                  confirm="Deny this return?"
                  fields={[{ name: "note", label: "Reason for the customer", type: "text" }]}
                />
              </div>
            </Panel>
          )}

          {["approved", "in_transit"].includes(record.status) && can("returns.receive") && (
            <Panel title="Receive">
              <ReceiveReturnForm
                returnId={record.id}
                lines={record.lines.map((l) => ({
                  sku: l.sku,
                  label: label(l.sku),
                  quantity: l.quantity,
                }))}
                locations={[
                  { value: ONLINE_LOCATION, label: "Online warehouse" },
                  ...stores.map((s) => ({ value: s.id, label: s.name })),
                ]}
                defaultLocation={
                  record.method === "store" && record.storeId ? record.storeId : ONLINE_LOCATION
                }
              />
            </Panel>
          )}

          {["received", "inspected"].includes(record.status) && can("orders.refund") && (
            <Panel title="Refund">
              <p className="mb-3 text-ink-soft">
                Estimated {formatMoney(record.refundEstimate)}
                {record.refundTo === "store_credit"
                  ? ", issued as a store credit gift card emailed to the customer."
                  : ", back to the original payment."}{" "}
                Leave the amount empty to refund the estimate.
              </p>
              <ActionForm
                action={refundReturnAction}
                payload={{ returnId: record.id }}
                submitLabel="Refund return"
                done="Refunded"
                confirm="Refund this return?"
                fields={[{ name: "amount", label: "Amount ($)", type: "number", step: "0.01" }]}
              />
            </Panel>
          )}
        </aside>
      </div>
    </div>
  );
}

/** One return: items, history and the next step for its status. */
export default function Page(props: PageProps<"/admin/returns/[id]">) {
  return (
    <Suspense fallback={<AdminLoading />}>
      <ReturnDetail {...props} />
    </Suspense>
  );
}
