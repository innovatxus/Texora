import type { Metadata } from "next";
import NextLink from "next/link";
import { ButtonLink } from "@/components/primitives";
import { formatDate } from "@/lib/format/date";
import { formatMoney } from "@/lib/format/money";
import { getMerchantContext } from "@/lib/merchant/context";
import { listMerchantOrders } from "@/lib/merchant/order-service";
import { MERCHANT_ORDER_STATUS_LABELS } from "@/lib/merchant/orders";

export const metadata: Metadata = { title: "Orders" };

/** The merchant's orders: their items only, newest first (journey §12). */
export default async function Page({ searchParams }: PageProps<"/merchant/orders">) {
  const { session } = await getMerchantContext();
  const { cursor } = await searchParams;
  const page = await listMerchantOrders(session.vendorId, {
    limit: 25,
    cursor: typeof cursor === "string" ? cursor : null,
  });

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <h1 className="font-display text-4xl">Orders</h1>
      {page.items.length === 0 && !cursor ? (
        <p className="border border-line bg-surface p-8">
          No orders yet. When shoppers buy your products, they appear here.
        </p>
      ) : (
        <div
          className="overflow-x-auto border border-line"
          role="region"
          aria-label="Orders"
          tabIndex={0}
        >
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-surface">
              <tr className="border-b border-line">
                <th scope="col" className="px-3 py-2 font-medium">
                  Order
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Placed
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Your items
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Your total
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {page.items.map((order) => (
                <tr key={order.id} className="border-b border-line">
                  <td className="px-3 py-3">
                    <NextLink
                      href={`/merchant/orders/${order.id}`}
                      className="font-medium underline"
                    >
                      {order.number}
                    </NextLink>
                  </td>
                  <td className="px-3 py-3">{formatDate(order.placedAt)}</td>
                  <td className="px-3 py-3 tabular-nums">{order.items}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{formatMoney(order.total)}</td>
                  <td className="px-3 py-3">{MERCHANT_ORDER_STATUS_LABELS[order.status]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {page.nextCursor && (
        <ButtonLink
          href={`/merchant/orders?cursor=${encodeURIComponent(page.nextCursor)}`}
          variant="secondary"
          className="self-center"
        >
          Older orders
        </ButtonLink>
      )}
    </div>
  );
}
