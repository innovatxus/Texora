import { TIME_ZONE } from "@/config/locale";
/** Shape of generated gift card codes: TXGC-XXXX-XXXX-XXXX. */
export const GIFT_CARD_CODE_PATTERN = /^TXGC(-[A-Z0-9]{4}){3}$/;

/** Smallest e-gift card amount (piastres): EGP 250. */
export const GIFT_CARD_MIN = 25_000;
/** Largest e-gift card amount (piastres): EGP 25,000. */
export const GIFT_CARD_MAX = 2_500_000;
/** Amount buttons on the e-gift card form (piastres): EGP 500 to 10,000. */
export const GIFT_CARD_PRESETS = [50_000, 100_000, 250_000, 500_000, 1_000_000] as const;
/** Gift cards are valid for five years (see terms). */
export const GIFT_CARD_VALID_YEARS = 5;

/** Today's date (YYYY-MM-DD) where we operate, for scheduled delivery. */
export function businessDate(now: Date, timeZone = TIME_ZONE): string {
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
