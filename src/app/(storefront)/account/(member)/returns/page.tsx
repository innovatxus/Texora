import { LOCALE, TIME_ZONE } from "@/config/locale";
import type { Metadata } from "next";
import NextLink from "next/link";
import { listReturnsForUser } from "@/lib/account/account-service";
import { getSession } from "@/lib/auth/session";
import { formatMoney } from "@/lib/format/money";
import { RETURN_STATUS_LABELS } from "@/lib/returns/policy";

export const metadata: Metadata = { title: "Returns" };

const dateFormat = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  month: "long",
  day: "numeric",
  year: "numeric",
});

/** Returns started from this account, with their status and refund. */
export default async function Page() {
  const session = await getSession();
  if (!session) return null;
  const returns = await listReturnsForUser(session.uid);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-4xl">Returns</h1>
      <p className="max-w-prose text-ink-soft">
        To start a return, open the order and choose <strong>Start a return</strong>. You have 30
        days from delivery.
      </p>
      {returns.length === 0 ? (
        <div className="flex flex-col items-start gap-4 bg-surface p-6">
          <p>You haven&apos;t started any returns.</p>
          <NextLink href="/account/orders" className="text-sm underline underline-offset-4">
            Go to your orders
          </NextLink>
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {returns.map((r) => (
            <li key={r.id} className="bg-surface p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
                <p className="font-medium">
                  Return {r.number}
                  <span className="ml-3 text-sm font-normal text-ink-soft">
                    Started {dateFormat.format(r.createdAt)}
                  </span>
                </p>
                <p className="text-sm">{RETURN_STATUS_LABELS[r.status]}</p>
              </div>
              <p className="mt-1 text-sm text-ink-soft">
                {r.lines.reduce((n, l) => n + l.quantity, 0)} item(s) · estimated refund{" "}
                {formatMoney(r.refundEstimate)}
              </p>
              <NextLink
                href={`/orders/${r.orderId}/returns/${r.id}`}
                className="mt-2 inline-flex min-h-11 items-center text-sm underline underline-offset-4"
              >
                View return<span className="sr-only"> {r.number}</span>
              </NextLink>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
