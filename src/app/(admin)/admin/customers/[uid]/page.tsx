import { LOCALE } from "@/config/locale";
import type { Metadata } from "next";
import NextLink from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ActionForm } from "@/components/admin/ActionForm";
import { AdminLoading } from "@/components/admin/AdminLoading";
import { formatDate, formatDateTime, OrderStatusPill } from "@/components/admin/status";
import { AdminPageHeader, DataTable, DetailList, Panel } from "@/components/admin/ui";
import { addCustomerNoteAction, adjustLoyaltyAction } from "@/lib/admin/ops-actions";
import { listCustomerNotes, listLoyaltyLedger } from "@/lib/admin/people-service";
import { requirePagePermission } from "@/lib/auth/guard";
import { hasPermission, ROLE_LABELS, type Permission } from "@/lib/auth/rbac";
import { getStoreSettings, getUserProfile } from "@/lib/data/admin-records";
import { listOrdersForUser } from "@/lib/data/orders";
import { formatMoney } from "@/lib/format/money";
import { TIER_NAMES, tierProgress } from "@/lib/loyalty/tiers";

/** Customer detail title. */
export const metadata: Metadata = { title: "Customer" };

async function Customer({ params }: PageProps<"/admin/customers/[uid]">) {
  const session = await requirePagePermission("customers.read");
  const can = (p: Permission) => hasPermission(session.role, p);
  const { uid } = await params;
  const user = await getUserProfile(uid);
  if (!user) notFound();
  const [orders, notes, ledger, settings] = await Promise.all([
    listOrdersForUser(uid, { limit: 20 }),
    listCustomerNotes(uid),
    user.loyalty ? listLoyaltyLedger(uid) : Promise.resolve([]),
    getStoreSettings(),
  ]);
  const progress = user.loyalty
    ? tierProgress(user.loyalty.periodSpend, settings.loyalty.tierThresholds)
    : null;
  const lifetime = orders.items
    .filter((o) => !["cancelled", "pending_payment"].includes(o.status))
    .reduce((sum, o) => sum + o.totals.total, 0);

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        eyebrow={
          <NextLink href="/admin/customers" className="underline">
            Customers
          </NextLink>
        }
        title={`${user.firstName} ${user.lastName}`}
        description={`${user.email} · ${ROLE_LABELS[user.role]} · joined ${formatDate(user.createdAt)}`}
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <div className="flex flex-col gap-6">
          <Panel title={`Orders (${orders.items.length}${orders.nextCursor ? "+" : ""})`}>
            <DataTable
              caption="Orders"
              rows={orders.items}
              rowKey={(o) => o.id}
              empty="No orders yet."
              columns={[
                {
                  header: "Order",
                  cell: (o) =>
                    can("orders.read") ? (
                      <NextLink href={`/admin/orders/${o.id}`} className="underline">
                        {o.number}
                      </NextLink>
                    ) : (
                      o.number
                    ),
                },
                { header: "Placed", cell: (o) => formatDate(o.placedAt) },
                { header: "Total", cell: (o) => formatMoney(o.totals.total), align: "right" },
                { header: "Status", cell: (o) => <OrderStatusPill status={o.status} /> },
              ]}
            />
          </Panel>
          {user.loyalty && (
            <Panel title="Rewards history">
              <DataTable
                caption="Rewards points history"
                rows={ledger}
                rowKey={(e) => e.id}
                empty="No points activity yet."
                columns={[
                  { header: "When", cell: (e) => formatDateTime(e.at) },
                  { header: "Type", cell: (e) => e.type },
                  { header: "Detail", cell: (e) => e.reason ?? "—" },
                  {
                    header: "Points",
                    cell: (e) => (e.points > 0 ? `+${e.points}` : e.points),
                    align: "right",
                  },
                  { header: "Balance", cell: (e) => e.balance, align: "right" },
                ]}
              />
            </Panel>
          )}
        </div>
        <aside className="flex flex-col gap-6">
          <Panel title="Profile">
            <DetailList
              items={[
                ["Phone", user.phone ?? "—"],
                ["Spend (last 20 orders)", formatMoney(lifetime)],
                ["Marketing email", user.preferences.marketingEmail ? "Yes" : "No"],
                ["Fit", user.preferences.fitFamily ?? "—"],
                ["Account", user.disabled ? "Disabled" : "Active"],
              ]}
            />
          </Panel>
          {user.loyalty && progress && (
            <Panel title="Rewards">
              <DetailList
                items={[
                  ["Tier", TIER_NAMES[user.loyalty.tier]],
                  ["Points", user.loyalty.points.toLocaleString(LOCALE)],
                  ["Spend this period", formatMoney(user.loyalty.periodSpend)],
                  [
                    "Next tier",
                    progress.next
                      ? `${TIER_NAMES[progress.next]} in ${formatMoney(progress.remaining)}`
                      : "Top tier",
                  ],
                ]}
              />
              {can("loyalty.adjust") && (
                <div className="mt-4 border-t border-line pt-4">
                  <ActionForm
                    action={adjustLoyaltyAction}
                    payload={{ uid }}
                    submitLabel="Adjust points"
                    done="Points updated"
                    fields={[
                      {
                        name: "points",
                        label: "Points",
                        type: "number",
                        required: true,
                        hint: "Positive to add, negative to remove",
                      },
                      { name: "reason", label: "Reason", type: "text", required: true },
                    ]}
                  />
                </div>
              )}
            </Panel>
          )}
          <Panel title="Notes">
            {notes.length > 0 && (
              <ul className="mb-4 flex flex-col gap-3">
                {notes.map((n) => (
                  <li key={n.id}>
                    <p>{n.text}</p>
                    <p className="text-xs text-ink-subtle">
                      {ROLE_LABELS[n.byRole]} · {formatDateTime(n.at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            {can("customers.write") ? (
              <ActionForm
                action={addCustomerNoteAction}
                payload={{ uid }}
                submitLabel="Add note"
                done="Note added"
                fields={[
                  {
                    name: "text",
                    label: "Internal note",
                    type: "textarea",
                    rows: 2,
                    required: true,
                  },
                ]}
              />
            ) : (
              notes.length === 0 && <p className="text-ink-soft">No notes.</p>
            )}
          </Panel>
        </aside>
      </div>
    </div>
  );
}

/** One customer: orders, rewards, profile and notes. */
export default function Page(props: PageProps<"/admin/customers/[uid]">) {
  return (
    <Suspense fallback={<AdminLoading />}>
      <Customer {...props} />
    </Suspense>
  );
}
