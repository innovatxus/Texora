import type { Metadata } from "next";
import NextLink from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ActionButton } from "@/components/admin/ActionButton";
import { ActionForm } from "@/components/admin/ActionForm";
import { AdminLoading } from "@/components/admin/AdminLoading";
import { formatDateTime, OrderStatusPill, ReturnStatusPill } from "@/components/admin/status";
import { AdminPageHeader, DataTable, DetailList, Panel } from "@/components/admin/ui";
import { AddressBlock, OrderLineList, OrderTotals } from "@/components/orders/OrderParts";
import {
  addOrderNoteAction,
  addShipmentAction,
  cancelOrderAction,
  markDeliveredAction,
  markProcessingAction,
  refundOrderAction,
  resendConfirmationAction,
} from "@/lib/admin/sales-actions";
import { requirePagePermission } from "@/lib/auth/guard";
import { hasPermission, ROLE_LABELS, type Permission } from "@/lib/auth/rbac";
import { getStoreSettings } from "@/lib/data/admin-records";
import { getOrder } from "@/lib/data/orders";
import { listReturnsForOrder } from "@/lib/data/returns";
import { formatMoney } from "@/lib/format/money";
import { refundableAmount, refundedTotal } from "@/lib/orders/refund-policy";
import { STATUS_LABELS } from "@/lib/orders/tracking";

/** Order detail title. */
export const metadata: Metadata = { title: "Order" };

const PAYMENT_LABELS: Record<string, string> = {
  paymob: "Card or wallet (Paymob)",
  cod: "Pay on delivery",
  gift_card: "Gift card",
  rewards: "Rewards",
};

async function OrderDetail({ params }: PageProps<"/admin/orders/[id]">) {
  await connection();
  const session = await requirePagePermission("orders.read");
  const can = (p: Permission) => hasPermission(session.role, p);
  const { id } = await params;
  const [order, returns, settings] = await Promise.all([
    getOrder(id),
    listReturnsForOrder(id),
    getStoreSettings(),
  ]);
  if (!order) notFound();

  const refundable = refundableAmount(order);
  const unlimited = can("orders.refund_unlimited");
  const agentRoom = Math.max(0, settings.refundLimits.customer_service - refundedTotal(order));
  const shippable = ["placed", "processing", "partially_shipped"].includes(order.status);
  const cancellable = ["pending_payment", "placed", "processing"].includes(order.status);

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        eyebrow={
          <NextLink href="/admin/orders" className="underline">
            Orders
          </NextLink>
        }
        title={order.number}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <OrderStatusPill status={order.status} /> Placed {formatDateTime(order.placedAt)} by{" "}
            {order.email}
            {order.userId ? " (account)" : " (guest)"}
          </span>
        }
        actions={
          <>
            {can("emails.resend") && order.status !== "pending_payment" && (
              <ActionButton
                action={resendConfirmationAction}
                payload={{ orderId: order.id }}
                done="Email sent"
              >
                Resend confirmation
              </ActionButton>
            )}
            {can("fulfillment.write") && order.status === "placed" && (
              <ActionButton action={markProcessingAction} payload={{ orderId: order.id }}>
                Start preparing
              </ActionButton>
            )}
            {can("fulfillment.write") && order.status === "shipped" && (
              <ActionButton action={markDeliveredAction} payload={{ orderId: order.id }}>
                Mark delivered
              </ActionButton>
            )}
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <div className="flex flex-col gap-6">
          <Panel title="Items">
            <OrderLineList lines={order.lines} />
          </Panel>

          <div className="grid gap-6 md:grid-cols-2">
            <Panel title="Customer">
              <DetailList
                items={[
                  ["Email", order.email],
                  ["Phone", order.shippingAddress.phone ?? "—"],
                  [
                    "Delivery",
                    `${order.delivery.method === "express" ? "Express" : "Standard"}, ${formatMoney(order.delivery.cost)}`,
                  ],
                  ["Promo codes", order.promoCodes.join(", ") || "—"],
                ]}
              />
            </Panel>
            <Panel title="Addresses">
              <div className="grid gap-4 sm:grid-cols-2">
                <AddressBlock title="Ship to" address={order.shippingAddress} />
                <AddressBlock title="Bill to" address={order.billingAddress} />
              </div>
            </Panel>
          </div>

          <Panel title="Payments">
            <DataTable
              caption="Payments"
              rows={order.payments}
              rowKey={(p) => `${p.provider}-${p.ref}`}
              empty="No payments recorded."
              columns={[
                { header: "Method", cell: (p) => PAYMENT_LABELS[p.provider] ?? p.provider },
                {
                  header: "Reference",
                  cell: (p) => <span className="font-mono text-xs">{p.ref}</span>,
                },
                { header: "Status", cell: (p) => p.status },
                { header: "Amount", cell: (p) => formatMoney(p.amount), align: "right" },
              ]}
            />
          </Panel>

          <Panel title="Shipments">
            <DataTable
              caption="Shipments"
              rows={order.shipments}
              rowKey={(s) => s.id}
              empty="Nothing has shipped yet."
              columns={[
                { header: "Carrier", cell: (s) => s.carrier },
                {
                  header: "Tracking",
                  cell: (s) => <span className="font-mono text-xs">{s.trackingNumber}</span>,
                },
                { header: "Items", cell: (s) => s.skus.length },
                { header: "Status", cell: (s) => s.status.replace(/_/g, " ") },
                {
                  header: "Shipped",
                  cell: (s) => (s.shippedAt ? formatDateTime(s.shippedAt) : "—"),
                },
              ]}
            />
            {can("fulfillment.write") && shippable && (
              <div className="mt-4 border-t border-line pt-4">
                <h3 className="mb-2 text-xs text-ink-soft">Add a parcel</h3>
                <ActionForm
                  action={addShipmentAction}
                  payload={{ orderId: order.id }}
                  layout="inline"
                  submitLabel="Mark shipped"
                  done="Shipment added"
                  fields={[
                    {
                      name: "carrier",
                      label: "Carrier",
                      type: "text",
                      required: true,
                      placeholder: "UPS Ground",
                    },
                    {
                      name: "trackingNumber",
                      label: "Tracking number",
                      type: "text",
                      required: true,
                    },
                    {
                      name: "skus",
                      label: "SKUs in this parcel",
                      type: "text",
                      hint: "Leave empty when everything ships together",
                    },
                  ]}
                />
              </div>
            )}
          </Panel>

          <Panel title="History">
            <ol className="flex flex-col gap-2">
              {order.statusHistory.map((h, i) => (
                <li key={`${h.status}-${i}`} className="flex flex-wrap gap-x-3">
                  <span className="w-36 text-ink-subtle">{formatDateTime(h.at)}</span>
                  <span className="font-medium">{STATUS_LABELS[h.status]}</span>
                  {h.by && <span className="text-ink-soft">by {ROLE_LABELS[h.by.role]}</span>}
                  {h.note && <span className="text-ink-soft">· {h.note}</span>}
                </li>
              ))}
            </ol>
          </Panel>
        </div>

        <aside className="flex flex-col gap-6">
          <OrderTotals order={order} />

          {can("orders.refund") &&
            refundable > 0 &&
            !["pending_payment", "cancelled"].includes(order.status) && (
              <Panel title="Refund">
                <p className="mb-3 text-ink-soft">
                  {formatMoney(refundable)} left to refund.
                  {!unlimited &&
                    ` You can refund up to ${formatMoney(Math.min(refundable, agentRoom))} on this order.`}
                </p>
                <ActionForm
                  action={refundOrderAction}
                  payload={{ orderId: order.id }}
                  submitLabel="Refund"
                  done="Refunded"
                  confirm="Refund this amount to the customer?"
                  fields={[
                    {
                      name: "amount",
                      label: "Amount (EGP)",
                      type: "number",
                      step: "0.01",
                      required: true,
                    },
                    { name: "reason", label: "Reason", type: "text", required: true },
                  ]}
                />
              </Panel>
            )}

          {order.refunds.length > 0 && (
            <Panel title="Refunds">
              <ul className="flex flex-col gap-2">
                {order.refunds.map((r) => (
                  <li key={r.id}>
                    <span className="font-medium tabular-nums">{formatMoney(r.amount)}</span>{" "}
                    <span className="text-ink-soft">
                      {formatDateTime(r.at)} · {r.reason}
                      {r.storeCredit ? " · store credit" : ""}
                      {r.manual ? ` · ${formatMoney(r.manual)} to pay back manually` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {returns.length > 0 && (
            <Panel title="Returns">
              <ul className="flex flex-col gap-2">
                {returns.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2">
                    {can("returns.read") ? (
                      <NextLink href={`/admin/returns/${r.id}`} className="underline">
                        {r.number}
                      </NextLink>
                    ) : (
                      r.number
                    )}
                    <ReturnStatusPill status={r.status} />
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {can("orders.write") && (
            <Panel title="Notes">
              {order.notes.length > 0 && (
                <ul className="mb-4 flex flex-col gap-3">
                  {order.notes.map((n, i) => (
                    <li key={i}>
                      <p>{n.text}</p>
                      <p className="text-xs text-ink-subtle">
                        {ROLE_LABELS[n.by.role]} · {formatDateTime(n.at)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              <ActionForm
                action={addOrderNoteAction}
                payload={{ orderId: order.id }}
                submitLabel="Add note"
                done="Note added"
                fields={[
                  {
                    name: "text",
                    label: "Internal note",
                    type: "textarea",
                    rows: 2,
                    required: true,
                  },
                ]}
              />
            </Panel>
          )}

          {can("orders.cancel") && cancellable && (
            <Panel title="Cancel order">
              <p className="mb-3 text-ink-soft">
                Puts the stock back and refunds anything already collected.
              </p>
              <ActionForm
                action={cancelOrderAction}
                payload={{ orderId: order.id }}
                submitLabel="Cancel order"
                done="Order cancelled"
                confirm="Cancel this order? This can't be undone."
                fields={[{ name: "reason", label: "Reason", type: "text", required: true }]}
              />
            </Panel>
          )}
        </aside>
      </div>
    </div>
  );
}

/** One order: everything about it, plus the actions the role allows. */
export default function Page(props: PageProps<"/admin/orders/[id]">) {
  return (
    <Suspense fallback={<AdminLoading />}>
      <OrderDetail {...props} />
    </Suspense>
  );
}
