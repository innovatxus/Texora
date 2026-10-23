import { CURRENCY, LOCALE } from "@/config/locale";

const formatters = new Map<string, Intl.NumberFormat>();

function formatterFor(currency: string, locale: string, decimals: number): Intl.NumberFormat {
  const key = `${locale}:${currency}:${decimals}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    formatters.set(key, formatter);
  }
  return formatter;
}

/**
 * Formats minor units (piastres) for display: whole amounts without decimals
 * ("EGP 1,299"), others with two ("EGP 1,299.50").
 */
export function formatMoney(minorUnits: number, currency = CURRENCY, locale = LOCALE): string {
  const decimals = minorUnits % 100 === 0 ? 0 : 2;
  return formatterFor(currency, locale, decimals).format(minorUnits / 100);
}

/** Whole-number percentage saved, e.g. (6900, 9800) → 30. */
export function percentOff(price: number, compareAtPrice: number): number {
  if (compareAtPrice <= 0 || price >= compareAtPrice) return 0;
  return Math.round((1 - price / compareAtPrice) * 100);
}

/**
 * Parses a typed price ("1299", "1299.5", "EGP 1,299.00") into minor units.
 * Returns null for anything that isn't a non-negative amount with at most two decimals.
 */
export function parsePrice(input: string): number | null {
  const cleaned = input
    .trim()
    .replace(/^(EGP|E£|LE|L\.E\.)/i, "")
    .replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole = "0", fraction = ""] = cleaned.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

/** Minor units to the plain amount an input shows: 129900 → "1299.00". */
export function centsToInput(cents: number | null): string {
  return cents === null ? "" : (cents / 100).toFixed(2);
}
