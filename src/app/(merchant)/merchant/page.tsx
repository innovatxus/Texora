import type { Metadata } from "next";
import NextLink from "next/link";
import { CheckIcon } from "@/components/icons";
import { ButtonLink } from "@/components/primitives";
import { MERCHANT_LIMITS } from "@/config/merchant";
import { listAuditLogs } from "@/lib/data/admin-records";
import { formatDate, formatDateTime } from "@/lib/format/date";
import { getMerchantContext } from "@/lib/merchant/context";
import { setupChecklist } from "@/lib/merchant/onboarding";
import { listLocations } from "@/lib/merchant/repositories/locations";
import { cn } from "@/lib/utils/cn";
import type { Shop } from "@/lib/validation/merchant";

export const metadata: Metadata = { title: "Home" };

/** Plain words for audit actions on a shop. */
const ACTIVITY: Record<string, string> = {
  "shops.create": "Shop created",
  "shops.update_basics": "Shop details updated",
  "shops.update_branding": "Branding updated",
  "shops.update_policies": "Policies updated",
  "shops.add_location": "Location added",
  "shops.update_location": "Location updated",
  "shops.archive_location": "Location archived",
  "shops.submit": "Shop submitted for review",
  "shops.approve": "Shop approved",
  "shops.request_changes": "Changes requested",
  "shops.reject": "Shop not approved",
  "shops.suspend": "Shop paused",
  "shops.reinstate": "Shop live again",
  "shops.close": "Shop closed",
  "shops.reopen": "Shop reopened",
};

function StatusCard({ shop, stepsDone }: { shop: Shop | null; stepsDone: number }) {
  const latestReasons =
    [...(shop?.reviewNotes ?? [])].reverse().find((n) => n.reasons.length > 0)?.reasons ?? [];
  const content: { text: React.ReactNode; action: { href: string; label: string } } = !shop
    ? {
        text: "Finish setting up your shop. 0 of 5 steps done.",
        action: { href: "/merchant/onboarding", label: "Continue setup" },
      }
    : {
        draft: {
          text: `Finish setting up your shop. ${stepsDone} of 5 steps done.`,
          action: { href: "/merchant/onboarding", label: "Continue setup" },
        },
        pending_review: {
          text: "Your shop is in review — we usually reply within 1 business day.",
          action: { href: "/merchant/products/new", label: "Add a product" },
        },
        changes_requested: {
          text: (
            <>
              We need a few changes before your shop goes live:
              <ul className="mt-2 list-disc pl-5">
                {latestReasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </>
          ),
          action: { href: "/merchant/onboarding/review", label: "Make changes" },
        },
        approved: {
          text: (
            <>
              Your shop is live.{" "}
              <NextLink href={`/shops/${shop.slug}`} className="underline underline-offset-4">
                View your shop page
              </NextLink>
            </>
          ),
          action: { href: "/merchant/products/new", label: "Add a product" },
        },
        suspended: {
          text: `Your shop is paused and hidden from shoppers.${shop.statusReason ? ` Reason: ${shop.statusReason}.` : ""} Contact merchant support to resolve it.`,
          action: { href: "/help/merchants", label: "Contact support" },
        },
        closed: {
          text: `Your shop is closed. You can reopen it until ${
            shop.closedAt
              ? formatDate(
                  new Date(
                    shop.closedAt.getTime() + MERCHANT_LIMITS.shop.reopenWithinDays * 86_400_000,
                  ),
                )
              : "30 days after closing"
          }.`,
          action: { href: "/merchant/shop/profile", label: "Reopen shop" },
        },
      }[shop.status];

  return (
    <section
      aria-labelledby="status-title"
      className="flex flex-col gap-4 border border-ink bg-surface p-6"
    >
      <h2 id="status-title" className="text-label">
        {shop ? shop.name : "Your shop"}
      </h2>
      <div className="text-lg">{content.text}</div>
      <ButtonLink href={content.action.href} className="self-start">
        {content.action.label}
      </ButtonLink>
    </section>
  );
}

/** Merchant home (journey §7): status and next action, checklist, counts, recent activity. */
export default async function Page() {
  const { merchant, shop } = await getMerchantContext();
  const locations = shop ? await listLocations(shop.id) : [];
  const counters = shop?.counters;
  const productCount = counters
    ? counters.live + counters.draft + counters.inReview + counters.changesRequested
    : 0;
  const checklist = setupChecklist(merchant, shop, locations, productCount);
  const activity = shop
    ? await listAuditLogs({ target: { type: "shop", id: shop.id }, limit: 10 })
    : { items: [] };

  return (
    <div className="flex max-w-5xl flex-col gap-8">
      <h1 className="font-display text-4xl">Welcome, {merchant.displayName}</h1>
      <StatusCard
        shop={shop}
        stepsDone={shop?.completedSteps.filter((s) => s !== "review").length ?? 0}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="checklist-title" className="border border-line bg-surface p-6">
          <h2 id="checklist-title" className="text-label">
            Setup checklist
          </h2>
          <ol className="mt-4 flex flex-col gap-1">
            {checklist.map((item) => (
              <li key={item.label}>
                <NextLink
                  href={item.href}
                  className="flex min-h-11 items-center gap-3 hover:underline"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center border",
                      item.done ? "border-ink bg-ink text-surface" : "border-ink-subtle",
                    )}
                  >
                    {item.done && <CheckIcon className="size-4" />}
                  </span>
                  <span className={cn(item.done && "text-ink-soft")}>
                    {item.label}
                    <span className="sr-only">{item.done ? " (done)" : " (to do)"}</span>
                  </span>
                </NextLink>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="counts-title" className="border border-line bg-surface p-6">
          <h2 id="counts-title" className="text-label">
            Products
          </h2>
          <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {(
              [
                ["Live", counters?.live ?? 0, "live"],
                ["Drafts", counters?.draft ?? 0, "draft"],
                ["In review", counters?.inReview ?? 0, "in_review"],
                ["Changes requested", counters?.changesRequested ?? 0, "changes_requested"],
                ["Low stock", counters?.lowStock ?? 0, "low_stock"],
              ] as const
            ).map(([label, value, filter]) => (
              <div key={label}>
                <dt className="text-sm text-ink-soft">{label}</dt>
                <dd className="font-display text-3xl">
                  <NextLink
                    href={`/merchant/products?status=${filter}`}
                    className="hover:underline"
                  >
                    {value}
                    <span className="sr-only"> {label.toLowerCase()} products</span>
                  </NextLink>
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      <section aria-labelledby="activity-title" className="border border-line bg-surface p-6">
        <h2 id="activity-title" className="text-label">
          Recent activity
        </h2>
        {activity.items.length === 0 ? (
          <p className="mt-4 text-sm text-ink-soft">Activity from your shop appears here.</p>
        ) : (
          <ul className="mt-4 flex flex-col divide-y divide-line text-sm">
            {activity.items.map((log) => (
              <li key={log.id} className="flex justify-between gap-4 py-2">
                <span>{ACTIVITY[log.action] ?? log.action}</span>
                <time dateTime={log.at.toISOString()} className="text-ink-soft">
                  {formatDateTime(log.at)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
