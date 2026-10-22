import type { Metadata } from "next";
import NextLink from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ReturnIcon, TruckIcon } from "@/components/icons";
import {
  AddressBlock,
  OrderLineList,
  OrderTotals,
  TrackingTimeline,
} from "@/components/orders/OrderParts";
import { ReorderButton } from "@/components/orders/ReorderButton";
import { Badge, ButtonLink, Link, Skeleton } from "@/components/primitives";
import { listReturnsForOrder } from "@/lib/data/returns";
import { getAuthorisedOrder } from "@/lib/orders/access";
import { orderAccessToken } from "@/lib/orders/token";
import { isTrackable, STATUS_LABELS, trackingTimeline } from "@/lib/orders/tracking";
import { INELIGIBLE_MESSAGES, RETURN_STATUS_LABELS, returnEligibility } from "@/lib/returns/policy";

/** Order pages are private: never indexed. */
export const metadata: Metadata = {
  title: "Your order",
  robots: { index: false, follow: false },
};

const longDate = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
});
const shortDate = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric" });

async function OrderStatus({ params, searchParams }: PageProps<"/orders/[id]">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  // Request-time only: access depends on the signed link or the session.
  await connection();
  const token = typeof query.t === "string" ? query.t : null;
  const order = await getAuthorisedOrder(id, token);
  if (!order) notFound();

  const returns = await listReturnsForOrder(order.id);
  const eligibility = returnEligibility(order, returns, new Date());
  const signed = `t=${encodeURIComponent(orderAccessToken(order.id))}`;
  const trackable = isTrackable(order.status);
  const delivered = ["delivered", "partially_refunded", "refunded"].includes(order.status);

  return (
    <div className="container-page pt-10 pb-24">
      <p className="text-label text-ink-subtle">Order {order.number}</p>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <h1 className="font-display text-5xl">{STATUS_LABELS[order.status]}</h1>
        <Badge tone={order.status === "cancelled" ? "sale" : "muted"}>
          Placed {shortDate.format(order.placedAt)}
        </Badge>
      </div>
      {trackable && !delivered && (
        <p className="mt-4 text-lg text-ink-soft">
          Estimated delivery {longDate.format(order.delivery.estimatedFrom)} –{" "}
          {longDate.format(order.delivery.estimatedTo)}
        </p>
      )}
      {order.status === "pending_payment" && (
        <p className="mt-4 text-ink-soft">
          We&apos;re waiting for your payment.{" "}
          <Link href={`/order-confirmation/${order.id}?${signed}`}>Complete your payment</Link>
        </p>
      )}
      {order.status === "cancelled" && (
        <p className="mt-4 text-ink-soft">
          This order was cancelled. If you were charged, the refund is on its way to you.
        </p>
      )}

      <div className="mt-12 grid gap-12 lg:grid-cols-[1fr_24rem]">
        <div className="flex flex-col gap-12">
          {trackable && (
            <section aria-labelledby="progress-title">
              <h2 id="progress-title" className="text-label">
                Progress
              </h2>
              <div className="mt-6">
                <TrackingTimeline steps={trackingTimeline(order)} />
              </div>
              {order.shipments.length > 0 && (
                <ul className="mt-8 flex flex-col gap-3">
                  {order.shipments.map((s, i) => (
                    <li key={s.id} className="flex items-start gap-3 bg-surface p-4 text-sm">
                      <TruckIcon />
                      <span>
                        <span className="font-medium">
                          {order.shipments.length > 1 ? `Parcel ${i + 1}: ` : ""}
                          {s.carrier}
                        </span>
                        <span className="block text-ink-soft">
                          Tracking number <span className="tabular-nums">{s.trackingNumber}</span>
                          {s.deliveredAt
                            ? ` · Delivered ${shortDate.format(s.deliveredAt)}`
                            : s.shippedAt
                              ? ` · Shipped ${shortDate.format(s.shippedAt)}`
                              : ""}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          <section aria-labelledby="items-title">
            <h2 id="items-title" className="text-label">
              Items
            </h2>
            <OrderLineList lines={order.lines} className="mt-5" />
          </section>

          <div className="grid gap-8 sm:grid-cols-2">
            <AddressBlock title="Shipping to" address={order.shippingAddress} />
            <div className="text-sm">
              <h3 className="text-label">Delivery</h3>
              <p className="mt-2 text-ink-soft">
                {order.delivery.method === "express" ? "Express" : "Standard"} delivery
              </p>
            </div>
          </div>
        </div>

        <aside className="flex flex-col gap-6">
          <OrderTotals order={order} />
          <div className="flex flex-wrap gap-3">
            <ReorderButton
              lines={order.lines.map((l) => ({
                sku: l.sku,
                productId: l.productId,
                quantity: l.quantity,
              }))}
            />
            <ButtonLink href={`/orders/${order.id}/invoice?${signed}`} variant="secondary">
              Invoice
            </ButtonLink>
          </div>

          <section aria-labelledby="returns-title" className="bg-surface-muted p-6 text-sm">
            <h2 id="returns-title" className="flex items-center gap-2 text-label">
              <ReturnIcon /> Returns
            </h2>
            {returns.length > 0 && (
              <ul className="mt-4 flex flex-col gap-2">
                {returns.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-4">
                    <NextLink
                      href={`/orders/${order.id}/returns/${r.id}?${signed}`}
                      className="underline underline-offset-4"
                    >
                      {r.number}
                    </NextLink>
                    <span className="text-ink-soft">{RETURN_STATUS_LABELS[r.status]}</span>
                  </li>
                ))}
              </ul>
            )}
            {eligibility.eligible ? (
              <>
                <p className="mt-3 text-ink-soft">
                  Free returns until {longDate.format(eligibility.deadline)}, by mail or in store.
                </p>
                <ButtonLink
                  href={`/orders/${order.id}/return?${signed}`}
                  variant="secondary"
                  className="mt-4"
                >
                  Start a return
                </ButtonLink>
              </>
            ) : (
              <p className="mt-3 text-ink-soft">{INELIGIBLE_MESSAGES[eligibility.reason]}</p>
            )}
          </section>

          <p className="text-sm text-ink-soft">
            Need help with this order? <Link href="/help/contact">Contact us</Link> and quote{" "}
            {order.number}.
          </p>
        </aside>
      </div>
    </div>
  );
}

/** Order tracking page, streamed because access depends on the signed link or session. */
export default function Page(props: PageProps<"/orders/[id]">) {
  return (
    <Suspense
      fallback={
        <div className="container-page pt-10 pb-24">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-4 h-12 w-96" />
          <Skeleton className="mt-12 h-96" />
        </div>
      }
    >
      <OrderStatus {...props} />
    </Suspense>
  );
}
