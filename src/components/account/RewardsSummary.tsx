import { ButtonLink } from "@/components/primitives";
import { formatMoney } from "@/lib/format/money";
import { TIER_NAMES, tierProgress, type TierThresholds } from "@/lib/loyalty/tiers";
import { POINTS_PER_DOLLAR_REDEEMED } from "@/lib/pricing/rewards";
import type { User } from "@/lib/validation/customer";

/** Tier, points and progress to the next tier; or an invitation to join. */
export function RewardsSummary({
  loyalty,
  thresholds,
  join,
}: {
  loyalty: User["loyalty"];
  thresholds: TierThresholds;
  join?: React.ReactNode;
}) {
  if (!loyalty) {
    return (
      <div className="flex flex-col gap-4 bg-surface p-6">
        <h2 className="text-label">Rewards</h2>
        <p>Earn points on every purchase and spend them at checkout. It&apos;s free to join.</p>
        {join ?? (
          <ButtonLink href="/account/rewards" variant="secondary" className="self-start">
            Join rewards
          </ButtonLink>
        )}
      </div>
    );
  }
  const progress = tierProgress(loyalty.periodSpend, thresholds);
  return (
    <div className="flex flex-col gap-4 bg-surface p-6">
      <h2 className="text-label">Rewards</h2>
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <p className="font-display text-3xl">{TIER_NAMES[progress.tier]}</p>
        <p>
          <span className="text-2xl tabular-nums">{loyalty.points.toLocaleString("en-US")}</span>{" "}
          points
          <span className="block text-sm text-ink-soft">
            worth up to{" "}
            {formatMoney(Math.floor((loyalty.points * 100) / POINTS_PER_DOLLAR_REDEEMED))} at
            checkout
          </span>
        </p>
      </div>
      {progress.next ? (
        <div>
          <div
            role="progressbar"
            aria-label={`Progress to ${TIER_NAMES[progress.next]}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress.ratio * 100)}
            className="h-2 bg-surface-muted"
          >
            <div className="h-full bg-ink" style={{ width: `${progress.ratio * 100}%` }} />
          </div>
          <p className="mt-2 text-sm text-ink-soft">
            Spend {formatMoney(progress.remaining)} more this year to reach{" "}
            {TIER_NAMES[progress.next]}.
          </p>
        </div>
      ) : (
        <p className="text-sm text-ink-soft">You&apos;re at our highest tier. Thank you.</p>
      )}
    </div>
  );
}
