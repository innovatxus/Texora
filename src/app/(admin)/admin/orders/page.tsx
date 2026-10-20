import type { Metadata } from "next";
import NextLink from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { AdminLoading } from "@/components/admin/AdminLoading";
import { formatDateTime, OrderStatusPill } from "@/components/admin/status";
import {
  AdminField,
  AdminPageHeader,
  adminControl,
  CursorPagination,
  DataTable,
  FilterBar,
} from "@/components/admin/ui";
import { searchOrders } from "@/lib/admin/sales-queries";
import { requirePagePermission } from "@/lib/auth/guard";
import { formatMoney } from "@/lib/format/money";
import { STATUS_LABELS } from "@/lib/orders/tracking";
import { ORDER_STATUSES } from "@/lib/validation";

/** Orders list title. */
export const metadata: Metadata = { title: "Orders" };

const param = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

async function Orders({ searchParams }: PageProps<"/admin/orders">) {
  await connection();
  await requirePagePermission("orders.read");
  const sp = await searchParams;
  const filters = { q: param(sp.q), status: param(sp.status), cursor: param(sp.cursor) };
  const page = await searchOrders(filters);

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader title="Orders" description="Search by order number or customer email." />
      <FilterBar action="/admin/orders">
        <AdminField label="Order number or email">
          <input name="q" defaultValue={filters.q} className={`${adminControl} w-64`} />
        </AdminField>
        <AdminField label="Status">
          <select name="status" defaultValue={filters.status ?? ""} className={adminControl}>
            <option value="">All statuses</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </AdminField>
      </FilterBar>
      <DataTable
        caption="Orders"
        rows={page.items}
        rowKey={(o) => o.id}
        empty="No orders match."
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
          { header: "Customer", cell: (o) => o.email },
          {
            header: "Items",
            cell: (o) => o.lines.reduce((n, l) => n + l.quantity, 0),
            align: "right",
          },
          { header: "Total", cell: (o) => formatMoney(o.totals.total), align: "right" },
          { header: "Status", cell: (o) => <OrderStatusPill status={o.status} /> },
        ]}
      />
      <CursorPagination
        basePath="/admin/orders"
        params={filters}
        nextCursor={page.nextCursor}
        hasPrevious={Boolean(filters.cursor)}
      />
    </div>
  );
}

/** Orders: search, status filter and pagination. */
export default function Page(props: PageProps<"/admin/orders">) {
  return (
    <Suspense fallback={<AdminLoading />}>
      <Orders {...props} />
    </Suspense>
  );
}
