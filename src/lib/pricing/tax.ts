/**
 * Estimated sales tax by US state (combined average state + local rates).
 * Admin-managed tax rules replace this table in Phase 8; checkout shows the
 * result as "estimated" until an address is entered.
 */
const STATE_RATES: Record<string, number> = {
  AL: 0.0924,
  AZ: 0.084,
  CA: 0.0885,
  CO: 0.0781,
  CT: 0.0635,
  FL: 0.0702,
  GA: 0.0738,
  IL: 0.0886,
  IN: 0.07,
  MA: 0.0625,
  MD: 0.06,
  MI: 0.06,
  MN: 0.0749,
  MO: 0.0839,
  NC: 0.07,
  NJ: 0.066,
  NY: 0.0853,
  OH: 0.0724,
  PA: 0.0634,
  TN: 0.0955,
  TX: 0.082,
  VA: 0.0577,
  WA: 0.0938,
  WI: 0.0543,
  // No statewide sales tax.
  AK: 0,
  DE: 0,
  MT: 0,
  NH: 0,
  OR: 0,
};

/** Used before the shopper gives an address. */
export const DEFAULT_TAX_RATE = 0.075;

/** Estimated sales tax rate for a US state, or the default rate. */
export function taxRateFor(region: string | undefined | null): number {
  if (!region) return DEFAULT_TAX_RATE;
  return STATE_RATES[region.trim().toUpperCase()] ?? DEFAULT_TAX_RATE;
}
