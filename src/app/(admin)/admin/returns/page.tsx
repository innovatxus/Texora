import type { Metadata } from "next";
import NextLink from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { AdminLoading } from "@/components/admin/AdminLoading";
import { formatDateTime, ReturnStatusPill } from "@/components/admin/status";
import {
  AdminField,
  AdminPageHeader,
  adminControl,
  CursorPagination,
  DataTable,
  FilterBar,
} from "@/components/admin/ui";
import { listReturns } from "@/lib/admin/sales-queries";
import { requirePagePermission } from "@/lib/auth/guard";
import { formatMoney } from "@/lib/format/money";
import { RETURN_STATUS_LABELS } from "@/lib/returns/policy";
import { RETURN_STATUSES } from "@/lib/validation";

/** Returns queue title. */
export const metadata: Metadata = { title: "Returns" };

const param = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

async function Returns({ searchParams }: PageProps<"/admin/returns">) {
  await connection();
  await requirePagePermission("returns.read");
  const sp = await searchParams;
  const filters = { status: param(sp.status), cursor: param(sp.cursor) };
  const page = await listReturns(filters.status, filters.cursor);
  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader
        title="Returns"
        description="Approve, receive, inspect and refund returns."
      />
      <FilterBar action="/admin/returns">
        <AdminField label="Status">
          <select name="status" defaultValue={filters.status ?? ""} className={adminControl}>
            <option value="">All statuses</option>
            {RETURN_STATUSES.map((s) => (
              <option key={s} value={s}>
                {RETURN_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </AdminField>
      </FilterBar>
      <DataTable
        caption="Returns"
        rows={page.items}
        rowKey={(r) => r.id}
        empty="No returns match."
        columns={[
          {
            header: "Return",
            cell: (r) => (
              <NextLink href={`/admin/returns/${r.id}`} className="font-medium underline">
                {r.number}
              </NextLink>
            ),
          },
          { header: "Requested", cell: (r) => formatDateTime(r.createdAt) },
          { header: "Customer", cell: (r) => r.email },
          {
            header: "Method",
            cell: (r) => (r.method === "mail" ? "Courier collection" : "In store"),
          },
          {
            header: "Refund to",
            cell: (r) => (r.refundTo === "store_credit" ? "Store credit" : "Original"),
          },
          {
            header: "Amount",
            cell: (r) => formatMoney(r.refundAmount ?? r.refundEstimate),
            align: "right",
          },
          { header: "Status", cell: (r) => <ReturnStatusPill status={r.status} /> },
        ]}
      />
      <CursorPagination
        basePath="/admin/returns"
        params={filters}
        nextCursor={page.nextCursor}
        hasPrevious={Boolean(filters.cursor)}
      />
    </div>
  );
}

/** Returns queue with a status filter. */
export default function Page(props: PageProps<"/admin/returns">) {
  return (
    <Suspense fallback={<AdminLoading />}>
      <Returns {...props} />
    </Suspense>
  );
}
