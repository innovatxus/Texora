const formatters = new Map<string, Intl.NumberFormat>();

function formatterFor(currency: string, locale: string): Intl.NumberFormat {
  const key = `${locale}:${currency}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, { style: "currency", currency });
    formatters.set(key, formatter);
  }
  return formatter;
}

/** Formats minor units (cents) for display, e.g. 12800 → "$128.00". */
export function formatMoney(minorUnits: number, currency = "USD", locale = "en-US"): string {
  return formatterFor(currency, locale).format(minorUnits / 100);
}

/** Whole-number percentage saved, e.g. (6900, 9800) → 30. */
export function percentOff(price: number, compareAtPrice: number): number {
  if (compareAtPrice <= 0 || price >= compareAtPrice) return 0;
  return Math.round((1 - price / compareAtPrice) * 100);
}

/**
 * Parses a price typed in dollars ("148", "148.5", "$1,048.00") into cents.
 * Returns null for anything that isn't a non-negative amount with at most two decimals.
 */
export function parseDollars(input: string): number | null {
  const cleaned = input.trim().replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole = "0", fraction = ""] = cleaned.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

/** Cents to the plain dollar string an input shows: 14800 → "148.00". */
export function centsToInput(cents: number | null): string {
  return cents === null ? "" : (cents / 100).toFixed(2);
}
