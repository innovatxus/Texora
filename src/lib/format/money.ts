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
