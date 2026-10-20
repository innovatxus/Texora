/** Rewards redemption: 100 points = $1, redeemed in $5 steps. */
export const POINTS_PER_DOLLAR_REDEEMED = 100;
/** Rewards are redeemed in $5 steps. */
export const REDEMPTION_STEP_CENTS = 500;

/** Reward values (cents) a member can choose, given their points balance. */
export function redemptionOptions(points: number, max = 10): number[] {
  const affordable = Math.floor(
    points / POINTS_PER_DOLLAR_REDEEMED / (REDEMPTION_STEP_CENTS / 100),
  );
  return Array.from(
    { length: Math.min(affordable, max) },
    (_, i) => (i + 1) * REDEMPTION_STEP_CENTS,
  );
}

/** Points needed to redeem a reward value (cents). */
export function pointsFor(valueCents: number): number {
  return (valueCents / 100) * POINTS_PER_DOLLAR_REDEEMED;
}
