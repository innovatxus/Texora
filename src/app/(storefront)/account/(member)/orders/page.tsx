import type { Metadata } from "next";
import NextLink from "next/link";
import { ButtonLink } from "@/components/primitives";
import { getSession } from "@/lib/auth/session";
import { listOrdersForUser } from "@/lib/data/orders";
import { formatMoney } from "@/lib/format/money";
import { STATUS_LABELS } from "@/lib/orders/tracking";

export const metadata: Metadata = { title: "Orders" };

const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
});

/** Every order placed while signed in, newest first. */
export default async function Page({ searchParams }: PageProps<"/account/orders">) {
  const session = await getSession();
  if (!session) return null;
  const { cursor } = await searchParams;
  const page = await listOrdersForUser(session.uid, {
    limit: 10,
    cursor: typeof cursor === "string" ? cursor : null,
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-4xl">Orders</h1>
      {page.items.length === 0 && !cursor ? (
        <div className="flex flex-col items-start gap-4 bg-surface p-6">
          <p>You haven&apos;t placed an order yet. Orders you place while signed in appear here.</p>
          <p className="text-sm text-ink-soft">
            Checked out as a guest?{" "}
            <NextLink href="/orders/lookup" className="underline underline-offset-4">
              Find a guest order
            </NextLink>
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {page.items.map((o) => {
            const items = o.lines.reduce((n, l) => n + l.quantity, 0);
            return (
              <li key={o.id} className="bg-surface p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
                  <p className="font-medium">
                    Order {o.number}
                    <span className="ml-3 text-sm font-normal text-ink-soft">
                      {dateFormat.format(o.placedAt)}
                    </span>
                  </p>
                  <p className="tabular-nums">{formatMoney(o.totals.total)}</p>
                </div>
                <p className="mt-1 text-sm text-ink-soft">
                  {STATUS_LABELS[o.status]} · {items} item{items === 1 ? "" : "s"}:{" "}
                  {o.lines
                    .slice(0, 3)
                    .map((l) => l.name)
                    .join(", ")}
                  {o.lines.length > 3 ? "…" : ""}
                </p>
                <div className="mt-2 flex flex-wrap gap-x-6 text-sm">
                  <NextLink
                    href={`/orders/${o.id}`}
                    className="inline-flex min-h-11 items-center underline underline-offset-4"
                  >
                    View order<span className="sr-only"> {o.number}</span>
                  </NextLink>
                  <NextLink
                    href={`/orders/${o.id}/invoice`}
                    className="inline-flex min-h-11 items-center underline underline-offset-4"
                  >
                    Invoice<span className="sr-only"> for {o.number}</span>
                  </NextLink>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {page.nextCursor && (
        <ButtonLink
          href={`/account/orders?cursor=${encodeURIComponent(page.nextCursor)}`}
          variant="secondary"
          className="self-center"
        >
          Older orders
        </ButtonLink>
      )}
    </div>
  );
}
