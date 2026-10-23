/** Rewards redemption: 10 points = EGP 1, redeemed in EGP 50 steps (500 points). */
export const POINTS_PER_POUND_REDEEMED = 10;
/** Rewards are redeemed in EGP 50 steps (minor units). */
export const REDEMPTION_STEP_CENTS = 5000;

/** Reward values (piastres) a member can choose, given their points balance. */
export function redemptionOptions(points: number, max = 10): number[] {
  const affordable = Math.floor(points / POINTS_PER_POUND_REDEEMED / (REDEMPTION_STEP_CENTS / 100));
  return Array.from(
    { length: Math.min(affordable, max) },
    (_, i) => (i + 1) * REDEMPTION_STEP_CENTS,
  );
}

/** Points needed to redeem a reward value (piastres). */
export function pointsFor(valueCents: number): number {
  return (valueCents / 100) * POINTS_PER_POUND_REDEEMED;
}
