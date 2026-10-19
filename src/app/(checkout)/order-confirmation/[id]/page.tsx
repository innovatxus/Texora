import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ClearAfterOrder } from "@/components/checkout/ClearAfterOrder";
import { PendingCardPayment } from "@/components/checkout/PendingCardPayment";
import { PriceDisplay } from "@/components/commerce/PriceDisplay";
import { ProductImage } from "@/components/commerce/ProductImage";
import { CheckIcon } from "@/components/icons";
import { ButtonLink, Skeleton } from "@/components/primitives";
import { getSession } from "@/lib/auth/session";
import { getOrder } from "@/lib/data/orders";
import { clientEnv } from "@/lib/env/client";
import { formatMoney } from "@/lib/format/money";
import { verifyOrderAccessToken } from "@/lib/orders/token";

export const metadata: Metadata = {
  title: "Order confirmation",
  robots: { index: false, follow: false },
};

const dateFormat = new Intl.DateTimeFormat("en-US", {
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
  const returnUrl = new URL(`/order-confirmation/${order.id}`, clientEnv.NEXT_PUBLIC_SITE_URL);
  if (token) returnUrl.searchParams.set("t", token);

  return (
    <div className="container-page pt-10 pb-24">
      {order.status !== "cancelled" && <ClearAfterOrder />}
      <div className="max-w-2xl">
        {awaitingPayment ? (
          <>
            <p className="text-label text-ink-subtle">Order {order.number}</p>
            <h1 className="mt-3 font-display text-5xl">Complete your payment</h1>
            <p className="mt-4 text-ink-soft">Your items are held for 15 minutes while you pay.</p>
            <div className="mt-8">
              <PendingCardPayment
                orderId={order.id}
                amount={order.totals.total}
                returnUrl={returnUrl.toString()}
              />
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
          <ul className="mt-5 flex flex-col divide-y divide-line border-y border-line">
            {order.lines.map((line) => (
              <li key={line.sku} className="flex gap-4 py-5 text-sm">
                <span className="relative aspect-3/4 w-20 shrink-0">
                  <ProductImage src={line.imageUrl} alt={line.name} fill sizes="80px" />
                </span>
                <span className="flex flex-1 flex-col gap-1">
                  <span className="font-medium">{line.name}</span>
                  <span className="text-ink-soft">
                    {line.colorName} · Size {line.size.replace("x", " × ")} · Qty {line.quantity}
                  </span>
                  {line.finalSale && <span className="text-xs text-sale">Final sale</span>}
                </span>
                <PriceDisplay size="sm" price={line.lineTotal} showPercent={false} />
              </li>
            ))}
          </ul>
          <div className="mt-8 grid gap-8 text-sm sm:grid-cols-2">
            <div>
              <h3 className="text-label">Delivery</h3>
              <p className="mt-2 text-ink-soft">
                {`${order.delivery.method === "express" ? "Express" : "Standard"}: arriving ${dateFormat.format(order.delivery.estimatedFrom)} – ${dateFormat.format(order.delivery.estimatedTo)}`}
              </p>
            </div>
            {order.shippingAddress && (
              <div>
                <h3 className="text-label">Shipping to</h3>
                <address className="mt-2 text-ink-soft not-italic">
                  {order.shippingAddress.firstName} {order.shippingAddress.lastName}
                  <br />
                  {order.shippingAddress.line1}
                  <br />
                  {order.shippingAddress.city}, {order.shippingAddress.region}{" "}
                  {order.shippingAddress.postalCode}
                </address>
              </div>
            )}
          </div>
        </section>

        <aside className="flex flex-col gap-6">
          <dl className="flex flex-col gap-3 bg-surface p-6 text-sm">
            {[
              ["Subtotal", formatMoney(order.totals.subtotal)],
              ...(order.totals.discount > 0
                ? [["Discounts", `−${formatMoney(order.totals.discount)}`]]
                : []),
              [
                "Shipping",
                order.totals.shipping === 0 ? "Free" : formatMoney(order.totals.shipping),
              ],
              ["Tax", formatMoney(order.totals.tax)],
              ...(order.totals.giftCard > 0
                ? [["Gift card", `−${formatMoney(order.totals.giftCard)}`]]
                : []),
              ...(order.totals.rewards > 0
                ? [["Rewards", `−${formatMoney(order.totals.rewards)}`]]
                : []),
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between">
                <dt>{label}</dt>
                <dd className="tabular-nums">{value}</dd>
              </div>
            ))}
            <div className="flex justify-between border-t border-line pt-3 text-base font-medium">
              <dt>Total</dt>
              <dd className="tabular-nums">{formatMoney(order.totals.total)}</dd>
            </div>
            {order.payments.some((p) => p.provider === "cod") && (
              <p className="text-xs text-ink-soft">Pay by card or cash on delivery.</p>
            )}
          </dl>
          {!order.userId && (
            <div className="bg-surface-muted p-6 text-sm">
              <h2 className="text-label">Save your details</h2>
              <p className="mt-2 text-ink-soft">
                Create an account to track this order, check out faster and earn rewards.
              </p>
              <ButtonLink
                href={`/auth/register?email=${encodeURIComponent(order.email)}`}
                variant="secondary"
                className="mt-4"
              >
                Create an account
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
