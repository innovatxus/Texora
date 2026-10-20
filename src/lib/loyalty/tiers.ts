import type { LoyaltyTier } from "@/lib/validation";

export interface TierThresholds {
  /** Qualifying spend (cents) in the current period to reach each tier. */
  enthusiast: number;
  icon: number;
}

export const TIER_NAMES: Record<LoyaltyTier, string> = {
  core: "Core",
  enthusiast: "Enthusiast",
  icon: "Icon",
};

/** Higher tiers earn faster: points per dollar are multiplied by this. */
export const TIER_MULTIPLIERS: Record<LoyaltyTier, number> = {
  core: 1,
  enthusiast: 1.25,
  icon: 1.5,
};

export function tierFor(periodSpend: number, thresholds: TierThresholds): LoyaltyTier {
  if (periodSpend >= thresholds.icon) return "icon";
  if (periodSpend >= thresholds.enthusiast) return "enthusiast";
  return "core";
}

/**
 * Points for an order: whole dollars of merchandise (after discounts, before
 * shipping and tax) × the base rate × the member's tier multiplier.
 */
export function pointsForOrder(
  merchandiseCents: number,
  pointsPerDollar: number,
  tier: LoyaltyTier,
): number {
  if (merchandiseCents <= 0) return 0;
  return Math.floor(Math.floor(merchandiseCents / 100) * pointsPerDollar * TIER_MULTIPLIERS[tier]);
}

export interface TierProgress {
  tier: LoyaltyTier;
  next: LoyaltyTier | null;
  /** Cents still to spend to reach the next tier (0 at the top tier). */
  remaining: number;
  /** 0–1 progress from the current tier's threshold to the next one. */
  ratio: number;
}

export function tierProgress(periodSpend: number, thresholds: TierThresholds): TierProgress {
  const tier = tierFor(periodSpend, thresholds);
  if (tier === "icon") return { tier, next: null, remaining: 0, ratio: 1 };
  const [from, to, next] =
    tier === "core"
      ? [0, thresholds.enthusiast, "enthusiast" as const]
      : [thresholds.enthusiast, thresholds.icon, "icon" as const];
  return {
    tier,
    next,
    remaining: to - periodSpend,
    ratio: Math.min(1, Math.max(0, (periodSpend - from) / (to - from))),
  };
}

/**
 * Applying an order (positive spend) or a refund (negative) to a member's
 * balance. Tiers recalculate from period spend; points never go below zero.
 */
export function applyLoyaltyChange(
  current: { points: number; periodSpend: number },
  change: { points: number; spend: number },
  thresholds: TierThresholds,
): { points: number; periodSpend: number; tier: LoyaltyTier } {
  const periodSpend = Math.max(0, current.periodSpend + change.spend);
  return {
    points: Math.max(0, current.points + change.points),
    periodSpend,
    tier: tierFor(periodSpend, thresholds),
  };
}
