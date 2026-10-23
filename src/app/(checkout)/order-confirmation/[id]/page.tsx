import { LOCALE, TIME_ZONE } from "@/config/locale";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { TrackPurchase } from "@/components/analytics/TrackPurchase";
import { ClearAfterOrder } from "@/components/checkout/ClearAfterOrder";
import { PendingCardPayment } from "@/components/checkout/PendingCardPayment";
import { CheckIcon } from "@/components/icons";
import { AddressBlock, OrderLineList, OrderTotals } from "@/components/orders/OrderParts";
import { ButtonLink, Skeleton } from "@/components/primitives";
import { dollars } from "@/lib/analytics/events";
import { getSession } from "@/lib/auth/session";
import { getOrder } from "@/lib/data/orders";
import { clientEnv } from "@/lib/env/client";
import { orderAccessToken, verifyOrderAccessToken } from "@/lib/orders/token";

/** Confirmation pages are private: never indexed. */
export const metadata: Metadata = {
  title: "Order confirmation",
  robots: { index: false, follow: false },
};

const dateFormat = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  weekday: "long",
  month: "long",
  day: "numeric",
});

async function Confirmation({ params, searchParams }: PageProps<"/order-confirmation/[id]">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  // Always request-time: the order and its access check are never prerendered.
  await connection();
  const token = typeof query.t === "string" ? query.t : null;
  const [order, session] = await Promise.all([getOrder(id), getSession()]);
  // Visible to the signed-in owner, or to whoever holds the signed link from checkout/email.
  const allowed =
    order && (verifyOrderAccessToken(order.id, token) || (session && order.userId === session.uid));
  if (!order || !allowed) notFound();

  const awaitingPayment = order.status === "pending_payment";
  const trackingHref = `/orders/${order.id}?t=${encodeURIComponent(orderAccessToken(order.id))}`;
  const returnUrl = new URL(`/order-confirmation/${order.id}`, clientEnv.NEXT_PUBLIC_SITE_URL);
  if (token) returnUrl.searchParams.set("t", token);

  return (
    <div className="container-page pt-10 pb-24">
      {order.status !== "cancelled" && <ClearAfterOrder />}
      {!awaitingPayment && order.status !== "cancelled" && (
        <TrackPurchase
          number={order.number}
          value={dollars(order.totals.total)}
          tax={dollars(order.totals.tax)}
          shipping={dollars(order.totals.shipping)}
          items={order.lines.map((l) => ({
            item_id: l.productId,
            item_name: l.name,
            item_variant: l.sku,
            price: dollars(l.unitPrice),
            quantity: l.quantity,
            ...(l.shopName ? { item_brand: l.shopName } : {}),
          }))}
        />
      )}
      <div className="max-w-2xl">
        {awaitingPayment ? (
          <>
            <p className="text-label text-ink-subtle">Order {order.number}</p>
            <h1 className="mt-3 font-display text-5xl">Complete your payment</h1>
            <p className="mt-4 text-ink-soft">Your items are held for 15 minutes while you pay.</p>
            <div className="mt-8">
              <PendingCardPayment orderId={order.id} amount={order.totals.total} />
            </div>
          </>
        ) : (
          <>
            <p className="flex items-center gap-2 text-label text-success">
              <CheckIcon /> Order {order.status === "cancelled" ? "cancelled" : "confirmed"}
            </p>
            <h1 className="mt-3 font-display text-5xl">
              {order.status === "cancelled"
                ? "This order was cancelled"
                : `Thank you, ${(order.shippingAddress ?? order.billingAddress).firstName}`}
            </h1>
            <p className="mt-4 text-lg text-ink-soft">
              Your order number is <strong className="text-ink">{order.number}</strong>. We&apos;ve
              emailed a confirmation to {order.email}.
            </p>
          </>
        )}
      </div>

      <div className="mt-12 grid gap-10 lg:grid-cols-[1fr_24rem]">
        <section aria-labelledby="items-title">
          <h2 id="items-title" className="text-label">
            Items
          </h2>
          <OrderLineList lines={order.lines} className="mt-5" />
          <div className="mt-8 grid gap-8 text-sm sm:grid-cols-2">
            <div>
              <h3 className="text-label">Delivery</h3>
              <p className="mt-2 text-ink-soft">
                {`${order.delivery.method === "express" ? "Express" : "Standard"}: arriving ${dateFormat.format(order.delivery.estimatedFrom)} – ${dateFormat.format(order.delivery.estimatedTo)}`}
              </p>
            </div>
            <AddressBlock title="Shipping to" address={order.shippingAddress} />
          </div>
        </section>

        <aside className="flex flex-col gap-6">
          <OrderTotals order={order} />
          {!awaitingPayment && order.status !== "cancelled" && (
            <div className="bg-surface-muted p-6 text-sm">
              <h2 className="text-label">Track your order</h2>
              <p className="mt-2 text-ink-soft">
                Follow its progress and start a return from your order page. We&apos;ve also emailed
                you the link.
              </p>
              <ButtonLink href={trackingHref} variant="secondary" className="mt-4">
                Track this order
              </ButtonLink>
            </div>
          )}
          <ButtonLink href="/" variant="tertiary" className="self-start">
            Continue shopping
          </ButtonLink>
        </aside>
      </div>
    </div>
  );
}

/** Order confirmation, streamed behind a skeleton because it renders at request time. */
export default function Page(props: PageProps<"/order-confirmation/[id]">) {
  return (
    <Suspense
      fallback={
        <div className="container-page pt-10 pb-24">
          <Skeleton className="h-12 w-80" />
          <Skeleton className="mt-10 h-96" />
        </div>
      }
    >
      <Confirmation {...props} />
    </Suspense>
  );
}
