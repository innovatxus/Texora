import type { Metadata } from "next";
import NextLink from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ActionButton } from "@/components/admin/ActionButton";
import { AdminLoading } from "@/components/admin/AdminLoading";
import { formatDateTime, OrderStatusPill } from "@/components/admin/status";
import { AdminPageHeader, DataTable } from "@/components/admin/ui";
import { markProcessingAction } from "@/lib/admin/sales-actions";
import { listOrdersToShip } from "@/lib/admin/sales-queries";
import { requirePagePermission } from "@/lib/auth/guard";

/** Fulfilment queue title. */
export const metadata: Metadata = { title: "Fulfilment" };

async function Queue() {
  await connection();
  await requirePagePermission("fulfillment.write");
  const orders = await listOrdersToShip();
  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader
        title="Fulfilment"
        description="Orders waiting to ship, oldest first. Add parcels from the order page."
      />
      <DataTable
        caption="Orders waiting to ship"
        rows={orders}
        rowKey={(o) => o.id}
        empty="Everything has shipped."
        columns={[
          {
            header: "Order",
            cell: (o) => (
              <NextLink href={`/admin/orders/${o.id}`} className="font-medium underline">
                {o.number}
              </NextLink>
            ),
          },
          { header: "Placed", cell: (o) => formatDateTime(o.placedAt) },
          {
            header: "Delivery",
            cell: (o) => (o.delivery.method === "express" ? "Express" : "Standard"),
          },
          {
            header: "Ship to",
            cell: (o) => `${o.shippingAddress.city}, ${o.shippingAddress.region}`,
          },
          {
            header: "Units",
            cell: (o) => o.lines.reduce((n, l) => n + l.quantity, 0),
            align: "right",
          },
          { header: "Status", cell: (o) => <OrderStatusPill status={o.status} /> },
          {
            header: "Action",
            cell: (o) =>
              o.status === "placed" ? (
                <ActionButton action={markProcessingAction} payload={{ orderId: o.id }}>
                  Start preparing
                </ActionButton>
              ) : (
                <NextLink href={`/admin/orders/${o.id}`} className="underline">
                  Add parcel
                </NextLink>
              ),
          },
        ]}
      />
    </div>
  );
}

/** Fulfilment: the queue of orders to pick, pack and ship. */
export default function Page() {
  return (
    <Suspense fallback={<AdminLoading />}>
      <Queue />
    </Suspense>
  );
}
