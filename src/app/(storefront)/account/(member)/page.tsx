import type { Metadata } from "next";
import NextLink from "next/link";
import { JoinRewardsButton } from "@/components/account/JoinRewardsButton";
import { RewardsSummary } from "@/components/account/RewardsSummary";
import { ButtonLink } from "@/components/primitives";
import { getAccountUser, listAddresses } from "@/lib/account/account-service";
import { getSession } from "@/lib/auth/session";
import { getStoreSettings } from "@/lib/data/admin-records";
import { listOrdersForUser } from "@/lib/data/orders";
import { formatMoney } from "@/lib/format/money";
import { STATUS_LABELS } from "@/lib/orders/tracking";

export const metadata: Metadata = { title: "Overview" };

const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

/** Account overview: recent orders, rewards and the default address. */
export default async function Page() {
  const session = await getSession();
  if (!session) return null;
  const [user, orders, addresses, settings] = await Promise.all([
    getAccountUser(session.uid),
    listOrdersForUser(session.uid, { limit: 3, cursor: null }),
    listAddresses(session.uid),
    getStoreSettings(),
  ]);
  const address = addresses.find((a) => a.isDefaultShipping);
  const canJoin = session.role === "customer";

  return (
    <div className="flex flex-col gap-10">
      <h1 className="sr-only">Account overview</h1>
      <section aria-labelledby="recent-orders" className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="recent-orders" className="text-label">
            Recent orders
          </h2>
          {orders.items.length > 0 && (
            <NextLink href="/account/orders" className="text-sm underline underline-offset-4">
              All orders
            </NextLink>
          )}
        </div>
        {orders.items.length === 0 ? (
          <div className="flex flex-col items-start gap-4 bg-surface p-6">
            <p>You haven&apos;t placed an order yet.</p>
            <ButtonLink href="/" variant="secondary">
              Start shopping
            </ButtonLink>
          </div>
        ) : (
          <ul className="flex flex-col divide-y divide-line border-y border-line">
            {orders.items.map((o) => (
              <li key={o.id}>
                <NextLink
                  href={`/orders/${o.id}`}
                  className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 py-4 hover:bg-surface"
                >
                  <span className="font-medium">{o.number}</span>
                  <span className="text-sm text-ink-soft">{dateFormat.format(o.placedAt)}</span>
                  <span className="text-sm">{STATUS_LABELS[o.status]}</span>
                  <span className="tabular-nums">{formatMoney(o.totals.total)}</span>
                </NextLink>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <RewardsSummary
          loyalty={user?.loyalty}
          thresholds={settings.loyalty.tierThresholds}
          {...(canJoin ? { join: <JoinRewardsButton /> } : {})}
        />
        <div className="flex flex-col gap-4 bg-surface p-6">
          <h2 className="text-label">Default address</h2>
          {address ? (
            <address className="text-sm not-italic">
              {address.firstName} {address.lastName}
              <br />
              {address.line1}
              {address.line2 ? `, ${address.line2}` : ""}
              <br />
              {address.city}, {address.region} {address.postalCode}
            </address>
          ) : (
            <p className="text-sm text-ink-soft">Save an address to check out faster next time.</p>
          )}
          <NextLink
            href="/account/addresses"
            className="self-start text-sm underline underline-offset-4"
          >
            {address ? "Manage addresses" : "Add an address"}
          </NextLink>
        </div>
      </div>
    </div>
  );
}
