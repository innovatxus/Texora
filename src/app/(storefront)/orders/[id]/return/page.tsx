import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { formatSize } from "@/components/orders/OrderParts";
import { ButtonLink, Skeleton } from "@/components/primitives";
import { ReturnForm, type ReturnFormLine } from "@/components/returns/ReturnForm";
import { listStores } from "@/lib/data/catalog-structure";
import { listReturnsForOrder } from "@/lib/data/returns";
import { getAuthorisedOrder } from "@/lib/orders/access";
import { orderAccessToken } from "@/lib/orders/token";
import { INELIGIBLE_MESSAGES, returnEligibility } from "@/lib/returns/policy";

/** Return pages are private: never indexed. */
export const metadata: Metadata = {
  title: "Start a return",
  robots: { index: false, follow: false },
};

const longDate = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric" });

async function StartReturn({ params, searchParams }: PageProps<"/orders/[id]/return">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  await connection();
  const token = typeof query.t === "string" ? query.t : null;
  const order = await getAuthorisedOrder(id, token);
  if (!order) notFound();

  const [returns, stores] = await Promise.all([listReturnsForOrder(order.id), listStores()]);
  const eligibility = returnEligibility(order, returns, new Date());
  const back = `/orders/${order.id}?t=${encodeURIComponent(orderAccessToken(order.id))}`;

  if (!eligibility.eligible) {
    return (
      <div className="container-page max-w-2xl pt-10 pb-24">
        <h1 className="font-display text-5xl">Start a return</h1>
        <p className="mt-4 text-lg text-ink-soft">{INELIGIBLE_MESSAGES[eligibility.reason]}</p>
        <ButtonLink href={back} variant="secondary" className="mt-8">
          Back to your order
        </ButtonLink>
      </div>
    );
  }

  const lines: ReturnFormLine[] = order.lines.map((line) => {
    const status = eligibility.lines.find((l) => l.sku === line.sku);
    return {
      sku: line.sku,
      name: line.name,
      detail: `${line.colorName} · Size ${formatSize(line.size)} · Qty ${line.quantity}`,
      imageUrl: line.imageUrl,
      available: status?.available ?? 0,
      ...(status?.blockedBy ? { blockedBy: status.blockedBy } : {}),
      quantity: line.quantity,
      lineTotal: line.lineTotal,
    };
  });

  return (
    <div className="container-page pt-10 pb-24">
      <p className="text-label text-ink-subtle">Order {order.number}</p>
      <h1 className="mt-3 font-display text-5xl">Start a return</h1>
      <p className="mt-4 text-ink-soft">
        Free returns until {longDate.format(eligibility.deadline)}. Items must be unworn, with their
        tags.
      </p>
      <div className="mt-10">
        <ReturnForm
          orderId={order.id}
          token={token}
          lines={lines}
          stores={stores
            .filter((s) => s.status === "open" && s.services.includes("returns"))
            .map((s) => ({
              id: s.id,
              name: s.name,
              address: `${s.address.line1}, ${s.address.city}`,
            }))}
        />
      </div>
    </div>
  );
}

/** Start a return for an order, streamed because access depends on the signed link. */
export default function Page(props: PageProps<"/orders/[id]/return">) {
  return (
    <Suspense
      fallback={
        <div className="container-page pt-10 pb-24">
          <Skeleton className="h-12 w-80" />
          <Skeleton className="mt-10 h-96" />
        </div>
      }
    >
      <StartReturn {...props} />
    </Suspense>
  );
}
