import { cityLine } from "@/config/locale";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { formatSize, TrackingTimeline } from "@/components/orders/OrderParts";
import { ButtonLink, Link, Skeleton } from "@/components/primitives";
import { PrintButton } from "@/components/returns/PrintButton";
import { getStore } from "@/lib/data/catalog-structure";
import { getReturn } from "@/lib/data/returns";
import { formatMoney } from "@/lib/format/money";
import { getAuthorisedOrder } from "@/lib/orders/access";
import { orderAccessToken } from "@/lib/orders/token";
import { RETURN_REASONS, RETURN_STATUS_LABELS, returnTimeline } from "@/lib/returns/policy";
import { qrSvg } from "@/lib/returns/qr";
import { directionsUrl } from "@/lib/stores/hours";

/** Return pages are private: never indexed. */
export const metadata: Metadata = {
  title: "Your return",
  robots: { index: false, follow: false },
};

const reasonLabel = (value: string) => RETURN_REASONS.find((r) => r.value === value)?.label;

async function ReturnDetail({
  params,
  searchParams,
}: PageProps<"/orders/[id]/returns/[returnId]">) {
  const [{ id, returnId }, query] = await Promise.all([params, searchParams]);
  await connection();
  const token = typeof query.t === "string" ? query.t : null;
  const [order, record] = await Promise.all([getAuthorisedOrder(id, token), getReturn(returnId)]);
  if (!order || !record || record.orderId !== order.id) notFound();

  const store = record.storeId ? await getStore(record.storeId) : null;
  const code = record.label?.code ?? record.number;
  const qr = await qrSvg(code);
  const open = record.status === "approved" || record.status === "requested";
  const back = `/orders/${order.id}?t=${encodeURIComponent(orderAccessToken(order.id))}`;

  return (
    <div className="container-page pt-10 pb-24">
      <p className="text-label text-ink-subtle print:hidden">Return for order {order.number}</p>
      <h1 className="mt-3 font-display text-5xl">
        {record.status === "denied" ? "Return not accepted" : `Return ${record.number}`}
      </h1>
      <p className="mt-4 text-lg text-ink-soft print:hidden">
        {RETURN_STATUS_LABELS[record.status]}
        {open &&
          (record.method === "mail"
            ? ": pack the items securely; the courier will collect the parcel from your address. Show them the code below."
            : `: bring the items to ${store?.name ?? "the store"} and show this QR code at the till.`)}
      </p>

      <div className="mt-12 grid gap-12 lg:grid-cols-[1fr_22rem]">
        <div className="flex flex-col gap-12">
          {record.status !== "denied" && (
            <section aria-labelledby="return-progress" className="print:hidden">
              <h2 id="return-progress" className="text-label">
                Progress
              </h2>
              <div className="mt-6">
                <TrackingTimeline steps={returnTimeline(record)} />
              </div>
            </section>
          )}

          <section aria-labelledby="return-items">
            <h2 id="return-items" className="text-label">
              Items
            </h2>
            <ul className="mt-5 flex flex-col divide-y divide-line border-y border-line text-sm">
              {record.lines.map((l) => {
                const line = order.lines.find((o) => o.sku === l.sku);
                return (
                  <li key={l.sku} className="flex justify-between gap-4 py-4">
                    <span>
                      <span className="font-medium">{line?.name ?? l.sku}</span>
                      <span className="block text-ink-soft">
                        {line ? `${line.colorName} · Size ${formatSize(line.size)} · ` : ""}Qty{" "}
                        {l.quantity}
                      </span>
                    </span>
                    <span className="text-ink-soft">{reasonLabel(l.reason)}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        <aside className="flex flex-col gap-6 self-start">
          {open && (
            <section
              aria-labelledby="return-label"
              className="flex flex-col items-center gap-4 border border-line bg-surface p-6 text-center text-sm"
            >
              <h2 id="return-label" className="text-label">
                {record.method === "mail" ? "Courier collection code" : "Show this in store"}
              </h2>
              <div
                role="img"
                aria-label={`QR code for return ${record.number}`}
                className="size-48 [&>svg]:size-full"
                dangerouslySetInnerHTML={{ __html: qr }}
              />
              <p className="font-mono text-base tracking-wider">{code}</p>
              {record.label && (
                <p className="text-ink-soft">
                  {record.label.carrier} · Tracking{" "}
                  <span className="tabular-nums">{record.label.trackingNumber}</span>
                </p>
              )}
              <PrintButton>{record.method === "mail" ? "Print code" : "Print QR code"}</PrintButton>
            </section>
          )}

          {store && (
            <section aria-labelledby="return-store" className="bg-surface-muted p-6 text-sm">
              <h2 id="return-store" className="text-label">
                Drop-off store
              </h2>
              <p className="mt-3 font-medium">{store.name}</p>
              <p className="text-ink-soft">
                {store.address.line1}, {cityLine(store.address)}
              </p>
              <p className="mt-3 flex flex-wrap gap-4">
                <Link href={`/stores/${store.slug}`}>Opening hours</Link>
                <Link href={directionsUrl(store)} target="_blank" rel="noopener noreferrer">
                  Directions
                </Link>
              </p>
            </section>
          )}

          <dl className="flex flex-col gap-3 bg-surface p-6 text-sm print:hidden">
            <div className="flex justify-between">
              <dt>Refund to</dt>
              <dd>{record.refundTo === "store_credit" ? "Store credit" : "Original payment"}</dd>
            </div>
            <div className="flex justify-between border-t border-line pt-3 text-base font-medium">
              <dt>{record.refundAmount !== undefined ? "Refunded" : "Estimated refund"}</dt>
              <dd className="tabular-nums">
                {formatMoney(record.refundAmount ?? record.refundEstimate)}
              </dd>
            </div>
          </dl>

          <ButtonLink href={back} variant="tertiary" className="self-start print:hidden">
            Back to your order
          </ButtonLink>
        </aside>
      </div>
    </div>
  );
}

/** Return details with the QR label, streamed because access depends on the signed link. */
export default function Page(props: PageProps<"/orders/[id]/returns/[returnId]">) {
  return (
    <Suspense
      fallback={
        <div className="container-page pt-10 pb-24">
          <Skeleton className="h-12 w-80" />
          <Skeleton className="mt-10 h-96" />
        </div>
      }
    >
      <ReturnDetail {...props} />
    </Suspense>
  );
}
