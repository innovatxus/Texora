import type { Metadata } from "next";
import NextLink from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { AdminLoading } from "@/components/admin/AdminLoading";
import { RevenueChart } from "@/components/admin/RevenueChart";
import { AdminPageHeader, DataTable, Panel, StatCard } from "@/components/admin/ui";
import { getQueueCounts, listLowStock, listRecentOrders } from "@/lib/admin/dashboard";
import { summariseSales } from "@/lib/admin/metrics";
import { brand } from "@/config/brand";
import { requirePagePermission } from "@/lib/auth/guard";
import { hasPermission } from "@/lib/auth/rbac";
import { formatMoney } from "@/lib/format/money";

/** Dashboard title. */
export const metadata: Metadata = { title: { absolute: `Dashboard · ${brand.name} back office` } };

async function Dashboard() {
  await connection();
  const session = await requirePagePermission("admin.access");
  const can = (p: Parameters<typeof hasPermission>[1]) => hasPermission(session.role, p);
  const showSales = can("reports.read") || can("orders.read");

  const [orders, lowStock, queues] = await Promise.all([
    showSales ? listRecentOrders(30) : Promise.resolve([]),
    can("inventory.read") ? listLowStock(8) : Promise.resolve([]),
    getQueueCounts(),
  ]);
  const sales = summariseSales(orders, new Date(), 30);

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Dashboard"
        description="The last 30 days and the work waiting for you."
      />

      {showSales && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Revenue" value={formatMoney(sales.revenue)} hint="Net of refunds" />
          <StatCard label="Orders" value={sales.orders} href="/admin/orders" />
          <StatCard label="Average order" value={formatMoney(sales.averageOrderValue)} />
          <StatCard label="Conversion" value="—" hint="Needs the analytics integration (Phase 9)" />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {can("fulfillment.write") && (
          <StatCard label="To ship" value={queues.ordersToShip} href="/admin/fulfillment" />
        )}
        {can("returns.read") && (
          <StatCard label="Returns open" value={queues.returnsToProcess} href="/admin/returns" />
        )}
        {can("reviews.moderate") && (
          <StatCard
            label="Reviews to moderate"
            value={queues.reviewsPending}
            href="/admin/reviews"
          />
        )}
        {can("pricing.approve") && (
          <StatCard
            label="Price changes to approve"
            value={queues.priceRequestsPending}
            href="/admin/pricing"
          />
        )}
        {can("customers.read") && (
          <StatCard label="Customer messages" value={queues.contactRequestsOpen} />
        )}
      </div>

      {showSales && (
        <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
          <Panel title="Revenue per day">
            <RevenueChart data={sales.daily} />
          </Panel>
          <Panel title="Top products">
            <DataTable
              caption="Top products by units sold"
              rows={sales.topProducts}
              rowKey={(p) => p.productId}
              empty="No sales yet in this period."
              columns={[
                {
                  header: "Product",
                  cell: (p) =>
                    can("catalog.read_drafts") ? (
                      <NextLink href={`/admin/catalog/${p.productId}`} className="underline">
                        {p.name}
                      </NextLink>
                    ) : (
                      p.name
                    ),
                },
                { header: "Units", cell: (p) => p.units, align: "right" },
                { header: "Revenue", cell: (p) => formatMoney(p.revenue), align: "right" },
              ]}
            />
          </Panel>
        </div>
      )}

      {can("inventory.read") && (
        <Panel
          title="Low stock online"
          actions={
            <NextLink href="/admin/inventory?low=1" className="text-xs underline">
              All low stock
            </NextLink>
          }
        >
          <DataTable
            caption="SKUs at or below their low-stock threshold"
            rows={lowStock}
            rowKey={(v) => v.sku}
            empty="Nothing is running low."
            columns={[
              { header: "SKU", cell: (v) => <span className="font-mono text-xs">{v.sku}</span> },
              { header: "Product", cell: (v) => v.productName },
              {
                header: "Colour / size",
                cell: (v) => `${v.color} / ${v.size.replace("x", " × ")}`,
              },
              { header: "Online", cell: (v) => v.online, align: "right" },
              { header: "Threshold", cell: (v) => v.threshold, align: "right" },
            ]}
          />
        </Panel>
      )}
    </div>
  );
}

/** Back office home: sales KPIs and chart, work queues and low stock, by permission. */
export default function Page() {
  return (
    <Suspense fallback={<AdminLoading />}>
      <Dashboard />
    </Suspense>
  );
}
