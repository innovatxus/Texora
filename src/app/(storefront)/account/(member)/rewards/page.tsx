import { LOCALE, TIME_ZONE } from "@/config/locale";
import type { Metadata } from "next";
import { JoinRewardsButton } from "@/components/account/JoinRewardsButton";
import { RewardsSummary } from "@/components/account/RewardsSummary";
import { getAccountUser } from "@/lib/account/account-service";
import { listLoyaltyLedger } from "@/lib/admin/people-service";
import { getSession } from "@/lib/auth/session";
import { getStoreSettings } from "@/lib/data/admin-records";
import { formatMoney } from "@/lib/format/money";
import { TIER_MULTIPLIERS, TIER_NAMES } from "@/lib/loyalty/tiers";
import { LOYALTY_TIERS } from "@/lib/validation/customer";

export const metadata: Metadata = { title: "Rewards" };

const dateFormat = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  month: "short",
  day: "numeric",
  year: "numeric",
});

function describe(entry: { type: string; reason?: string | undefined }): string {
  if (entry.type === "earn") return `Earned${entry.reason ? ` on order ${entry.reason}` : ""}`;
  if (entry.type === "redeem") return `Spent${entry.reason ? ` on order ${entry.reason}` : ""}`;
  return entry.reason ?? "Adjustment";
}

/** Tier, points, progress, history and how the programme works. */
export default async function Page() {
  const session = await getSession();
  if (!session) return null;
  const [user, settings] = await Promise.all([getAccountUser(session.uid), getStoreSettings()]);
  const ledger = user?.loyalty ? await listLoyaltyLedger(session.uid) : [];
  const { pointsPerCurrencyUnit, tierThresholds, birthdayRewardPoints } = settings.loyalty;

  return (
    <div className="flex flex-col gap-10">
      <h1 className="font-display text-4xl">Rewards</h1>
      <RewardsSummary
        loyalty={user?.loyalty}
        thresholds={tierThresholds}
        {...(session.role === "customer" ? { join: <JoinRewardsButton /> } : {})}
      />

      {user?.loyalty && (
        <section aria-labelledby="history" className="flex flex-col gap-4">
          <h2 id="history" className="text-label">
            Points history
          </h2>
          {ledger.length === 0 ? (
            <p className="text-ink-soft">Points appear here once your first order is delivered.</p>
          ) : (
            <div className="overflow-x-auto" role="region" aria-label="Points history" tabIndex={0}>
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-line">
                    <th scope="col" className="py-2 pr-4 font-medium">
                      Date
                    </th>
                    <th scope="col" className="py-2 pr-4 font-medium">
                      Details
                    </th>
                    <th scope="col" className="py-2 pr-4 text-right font-medium">
                      Points
                    </th>
                    <th scope="col" className="py-2 text-right font-medium">
                      Balance
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((e) => (
                    <tr key={e.id} className="border-b border-line">
                      <td className="py-3 pr-4">{dateFormat.format(e.at)}</td>
                      <td className="py-3 pr-4">{describe(e)}</td>
                      <td className="py-3 pr-4 text-right tabular-nums">
                        {e.points > 0 ? `+${e.points}` : e.points}
                      </td>
                      <td className="py-3 text-right tabular-nums">{e.balance}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <section aria-labelledby="how" className="flex flex-col gap-4">
        <h2 id="how" className="text-label">
          How rewards work
        </h2>
        <ul className="flex max-w-prose list-disc flex-col gap-2 pl-5 text-ink-soft">
          <li>
            Earn {pointsPerCurrencyUnit} {pointsPerCurrencyUnit === 1 ? "point" : "points"} for
            every EGP 1 you spend, credited when your order is delivered.
          </li>
          <li>Spend points at checkout in EGP 50 steps: 500 points take EGP 50 off.</li>
          <li>
            Spend {formatMoney(tierThresholds.enthusiast)} in a year to reach{" "}
            {TIER_NAMES.enthusiast}, or {formatMoney(tierThresholds.icon)} for {TIER_NAMES.icon}.
            Higher tiers earn faster:{" "}
            {LOYALTY_TIERS.map((t) => `${TIER_NAMES[t]} ×${TIER_MULTIPLIERS[t]}`).join(", ")}.
          </li>
          <li>{birthdayRewardPoints} bonus points on your birthday.</li>
        </ul>
      </section>
    </div>
  );
}
