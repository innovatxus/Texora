/** Display order for alpha sizes; numeric and waist×inseam sizes sort numerically. */
export const ALPHA_SIZE_ORDER = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL"] as const;

/** Compares sizes the way a size run reads: XXS…4XL, 00 < 0 < 2…, 28x30 < 28x32 < 29x30. */
export function compareSizes(a: string, b: string): number {
  const ia = (ALPHA_SIZE_ORDER as readonly string[]).indexOf(a);
  const ib = (ALPHA_SIZE_ORDER as readonly string[]).indexOf(b);
  if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  // "00" is smaller than "0" in women's numeric sizing.
  if (a === "00" || b === "00") return a === b ? 0 : a === "00" ? -1 : 1;
  return a.localeCompare(b, undefined, { numeric: true });
}
