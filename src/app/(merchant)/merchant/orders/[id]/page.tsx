import { cityLine } from "@/config/locale";
import type { Metadata } from "next";
import Image from "next/image";
import NextLink from "next/link";
import { notFound } from "next/navigation";
import { ShipForm } from "@/components/merchant/orders/ShipForm";
import { formatDate, formatDateTime } from "@/lib/format/date";
import { formatMoney } from "@/lib/format/money";
import { getMerchantContext } from "@/lib/merchant/context";
import { getMerchantOrder } from "@/lib/merchant/order-service";
import { MERCHANT_ORDER_STATUS_LABELS } from "@/lib/merchant/orders";

export const metadata: Metadata = { title: "Order" };

/**
 * One order, merchant's part only: their lines, the ship-to address and
 * parcels. Orders without the merchant's items are "not found" (not
 * forbidden), so order ids can't be probed.
 */
export default async function Page({ params }: PageProps<"/merchant/orders/[id]">) {
  const { session } = await getMerchantContext();
  const { id } = await params;
  const order = await getMerchantOrder(session.vendorId, id);
  if (!order) notFound();
  const a = order.shippingAddress;

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <NextLink
          href="/merchant/orders"
          className="self-start text-sm underline underline-offset-4"
        >
          Orders
        </NextLink>
        <h1 className="font-display text-4xl">{order.number}</h1>
        <p className="text-sm text-ink-soft">
          Placed {formatDate(order.placedAt)} · {MERCHANT_ORDER_STATUS_LABELS[order.status]} ·{" "}
          {order.deliveryMethod === "express" ? "Express" : "Standard"} delivery
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section
          aria-labelledby="items"
          className="border border-line bg-surface p-5 lg:col-span-2"
        >
          <h2 id="items" className="text-label">
            Your items
          </h2>
          <ul className="mt-4 flex flex-col divide-y divide-line">
            {order.lines.map((line) => (
              <li key={line.sku} className="flex gap-4 py-3 text-sm">
                <div className="relative h-20 w-16 shrink-0 bg-surface-muted">
                  {line.imageUrl && (
                    <Image src={line.imageUrl} alt="" fill sizes="64px" className="object-cover" />
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-1">
                  <p className="font-medium">{line.name}</p>
                  <p className="text-ink-soft">
                    {line.colorName} · Size {line.size.replace("x", " × ")} · Qty {line.quantity}
                  </p>
                  <p className="text-xs text-ink-subtle">SKU {line.sku}</p>
                </div>
                <p className="tabular-nums">{formatMoney(line.lineTotal)}</p>
              </li>
            ))}
          </ul>
          <p className="mt-3 flex justify-between border-t border-line pt-3 text-sm font-medium">
            <span>Your total</span>
            <span className="tabular-nums">{formatMoney(order.total)}</span>
          </p>
        </section>

        <div className="flex flex-col gap-6">
          <section aria-labelledby="ship-to" className="border border-line bg-surface p-5 text-sm">
            <h2 id="ship-to" className="text-label">
              Ship to
            </h2>
            <address className="mt-3 not-italic">
              {a.firstName} {a.lastName}
              <br />
              {a.line1}
              {a.line2 ? (
                <>
                  <br />
                  {a.line2}
                </>
              ) : null}
              <br />
              {cityLine(a)}
              <br />
              {a.country}
            </address>
          </section>

          {order.unshipped.length > 0 && order.status !== "cancelled" && (
            <section aria-labelledby="ship" className="border border-line bg-surface p-5">
              <h2 id="ship" className="mb-3 text-label">
                Ship {order.unshipped.length === order.lines.length ? "your items" : "the rest"}
              </h2>
              <ShipForm orderId={order.id} />
            </section>
          )}

          {order.unshipped.length === 0 && order.status !== "cancelled" && (
            <p role="status" className="border border-line bg-surface p-5 text-sm text-success">
              All your items in this order have shipped. We emailed the customer the tracking
              details.
            </p>
          )}

          {order.shipments.length > 0 && (
            <section
              aria-labelledby="parcels"
              className="border border-line bg-surface p-5 text-sm"
            >
              <h2 id="parcels" className="text-label">
                Parcels
              </h2>
              <ul className="mt-3 flex flex-col gap-2">
                {order.shipments.map((s) => (
                  <li key={s.id}>
                    {s.carrier} · {s.trackingNumber}
                    <span className="block text-ink-soft">
                      {s.status === "delivered" ? "Delivered" : "In transit"}
                      {s.shippedAt ? ` · shipped ${formatDateTime(s.shippedAt)}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
