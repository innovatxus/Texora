export const GIFT_CARD_CODE_PATTERN = /^TXGC(-[A-Z0-9]{4}){3}$/;

export const GIFT_CARD_MIN = 1_000;
export const GIFT_CARD_MAX = 50_000;
export const GIFT_CARD_PRESETS = [2_500, 5_000, 10_000, 15_000, 25_000] as const;
/** Gift cards are valid for five years (see terms). */
export const GIFT_CARD_VALID_YEARS = 5;

/** Today's date (YYYY-MM-DD) where we operate, for scheduled delivery. */
export function businessDate(now: Date, timeZone = "America/New_York"): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Adds days to a YYYY-MM-DD date. */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
