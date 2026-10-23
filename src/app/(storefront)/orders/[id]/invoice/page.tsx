import { TAX_LABEL } from "@/lib/pricing/tax";
import { cityLine, COUNTRY_NAME, LOCALE, TIME_ZONE } from "@/config/locale";
import type { Metadata } from "next";
import NextLink from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { PrintButton } from "@/components/orders/PrintButton";
import { formatSize } from "@/components/orders/OrderParts";
import { Skeleton } from "@/components/primitives";
import { brand } from "@/config/brand";
import { formatMoney } from "@/lib/format/money";
import { getAuthorisedOrder } from "@/lib/orders/access";
import type { Order } from "@/lib/validation";

export const metadata: Metadata = {
  title: "Invoice",
  robots: { index: false, follow: false },
};

const dateFormat = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  month: "long",
  day: "numeric",
  year: "numeric",
});

function Address({ title, address }: { title: string; address: Order["shippingAddress"] }) {
  return (
    <div>
      <h2 className="text-label">{title}</h2>
      <address className="mt-2 text-sm not-italic">
        {address.firstName} {address.lastName}
        <br />
        {address.line1}
        {address.line2 ? (
          <>
            <br />
            {address.line2}
          </>
        ) : null}
        <br />
        {cityLine(address)}
        <br />
        {COUNTRY_NAME}
      </address>
    </div>
  );
}

async function Invoice({ params, searchParams }: PageProps<"/orders/[id]/invoice">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  await connection();
  const order = await getAuthorisedOrder(id, typeof query.t === "string" ? query.t : null);
  if (!order) notFound();
  const t = order.totals;
  const rows: Array<[string, number, boolean?]> = [
    ["Subtotal", t.subtotal],
    ...(t.discount ? ([["Discounts", -t.discount]] as Array<[string, number]>) : []),
    ["Shipping", t.shipping],
    [TAX_LABEL, t.tax],
    ...(t.giftCard ? ([["Gift card", -t.giftCard]] as Array<[string, number]>) : []),
    ...(t.rewards ? ([["Rewards", -t.rewards]] as Array<[string, number]>) : []),
  ];

  return (
    <div className="container-page max-w-3xl pt-10 pb-24 print:pt-0">
      <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
        <NextLink href={`/orders/${order.id}`} className="text-sm underline underline-offset-4">
          Back to order
        </NextLink>
        <PrintButton />
      </div>
      <div className="mt-8 flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className="font-display text-2xl tracking-[0.28em] text-brand uppercase">
            {brand.name}
          </p>
          <h1 className="mt-4 font-display text-4xl">Invoice</h1>
        </div>
        <dl className="grid grid-cols-[auto_auto] gap-x-6 gap-y-1 text-sm">
          <dt className="text-ink-soft">Order</dt>
          <dd>{order.number}</dd>
          <dt className="text-ink-soft">Date</dt>
          <dd>{dateFormat.format(order.placedAt)}</dd>
          <dt className="text-ink-soft">Email</dt>
          <dd>{order.email}</dd>
        </dl>
      </div>
      <div className="mt-10 grid gap-8 sm:grid-cols-2">
        <Address title="Billed to" address={order.billingAddress} />
        <Address title="Shipped to" address={order.shippingAddress} />
      </div>
      <table className="mt-10 w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-ink">
            <th scope="col" className="py-2 pr-4 font-medium">
              Item
            </th>
            <th scope="col" className="py-2 pr-4 text-right font-medium">
              Qty
            </th>
            <th scope="col" className="py-2 pr-4 text-right font-medium">
              Price
            </th>
            <th scope="col" className="py-2 text-right font-medium">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {order.lines.map((l) => (
            <tr key={l.sku} className="border-b border-line align-top">
              <td className="py-3 pr-4">
                {l.name}
                <span className="block text-ink-soft">
                  {l.colorName} · Size {formatSize(l.size)} · SKU {l.sku}
                </span>
              </td>
              <td className="py-3 pr-4 text-right tabular-nums">{l.quantity}</td>
              <td className="py-3 pr-4 text-right tabular-nums">{formatMoney(l.unitPrice)}</td>
              <td className="py-3 text-right tabular-nums">{formatMoney(l.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="mt-6 ml-auto flex max-w-xs flex-col gap-2 text-sm">
        {rows.map(([label, amount]) => (
          <div key={label} className="flex justify-between">
            <dt>{label}</dt>
            <dd className="tabular-nums">
              {amount < 0 ? `−${formatMoney(-amount)}` : formatMoney(amount)}
            </dd>
          </div>
        ))}
        <div className="flex justify-between border-t border-ink pt-2 text-base font-medium">
          <dt>Total</dt>
          <dd className="tabular-nums">{formatMoney(t.total)}</dd>
        </div>
      </dl>
      <p className="mt-12 text-xs text-ink-subtle">
        Thank you for shopping with {brand.name}. Keep this invoice for your records.
      </p>
    </div>
  );
}

/** A printable invoice for an order you can view (signed link or your account). */
export default function Page(props: PageProps<"/orders/[id]/invoice">) {
  return (
    <Suspense fallback={<Skeleton className="container-page mt-10 h-96" />}>
      <Invoice {...props} />
    </Suspense>
  );
}
