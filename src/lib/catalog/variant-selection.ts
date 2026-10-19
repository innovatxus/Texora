/**
 * PDP variant logic: sizes per colour and fit, stock messaging, store
 * availability and delivery estimates. Pure and unit tested; shared by the
 * server page and the client buy box.
 */
import { compareSizes } from "./sizes";

export interface PdpVariant {
  sku: string;
  color: string;
  fitFamily: string;
  size: string;
  price: number;
  compareAtPrice?: number;
  /** Online (DC) units. */
  online: number;
  /** Units per store id. */
  stores: Record<string, number>;
  lowStockThreshold: number;
}

export interface SizeOption {
  size: string;
  sku: string;
  inStock: boolean;
  online: number;
}

export function sizeOptions(
  variants: readonly PdpVariant[],
  color: string,
  fit: string,
): SizeOption[] {
  return variants
    .filter((v) => v.color === color && v.fitFamily === fit)
    .map((v) => ({ size: v.size, sku: v.sku, inStock: v.online > 0, online: v.online }))
    .sort((a, b) => compareSizes(a.size, b.size));
}

export function findVariant(
  variants: readonly PdpVariant[],
  color: string,
  fit: string,
  size: string | null,
): PdpVariant | undefined {
  if (!size) return undefined;
  return variants.find((v) => v.color === color && v.fitFamily === fit && v.size === size);
}

/** Fits offered for a colour, in the product's order. */
export function fitsForColor(
  variants: readonly PdpVariant[],
  color: string,
  fitOrder: readonly string[],
): string[] {
  const present = new Set(variants.filter((v) => v.color === color).map((v) => v.fitFamily));
  return fitOrder.filter((f) => present.has(f));
}

export type StockMessage =
  { kind: "in_stock" } | { kind: "low"; remaining: number } | { kind: "out_of_stock" };

export function stockMessage(variant: PdpVariant | undefined): StockMessage | null {
  if (!variant) return null;
  if (variant.online <= 0) return { kind: "out_of_stock" };
  if (variant.online <= variant.lowStockThreshold)
    return { kind: "low", remaining: variant.online };
  return { kind: "in_stock" };
}

export interface StoreStock {
  storeId: string;
  quantity: number;
}

/** Per-store units for a variant, most stock first; zero-stock stores included last. */
export function storeAvailability(
  variant: PdpVariant | undefined,
  storeIds: readonly string[],
): StoreStock[] {
  return storeIds
    .map((storeId) => ({ storeId, quantity: variant?.stores[storeId] ?? 0 }))
    .sort((a, b) => b.quantity - a.quantity || a.storeId.localeCompare(b.storeId));
}

// ------------------------------------------------------------- delivery

export const DELIVERY_METHODS = {
  standard: { label: "Standard", minDays: 3, maxDays: 5 },
  express: { label: "Express", minDays: 1, maxDays: 2 },
} as const;
export type DeliveryMethod = keyof typeof DELIVERY_METHODS;

/** Orders after this hour (local) leave the warehouse the next business day. */
export const DISPATCH_CUTOFF_HOUR = 14;

function addBusinessDays(start: Date, days: number): Date {
  const date = new Date(start);
  let added = 0;
  while (added < days) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    if (day !== 0 && day !== 6) added += 1;
  }
  return date;
}

/** Earliest and latest arrival for a method, skipping weekends and honouring the dispatch cutoff. */
export function estimateDelivery(method: DeliveryMethod, now: Date): { from: Date; to: Date } {
  const { minDays, maxDays } = DELIVERY_METHODS[method];
  let dispatch = new Date(now);
  const weekend = dispatch.getDay() === 0 || dispatch.getDay() === 6;
  if (weekend || dispatch.getHours() >= DISPATCH_CUTOFF_HOUR)
    dispatch = addBusinessDays(dispatch, 1);
  return { from: addBusinessDays(dispatch, minDays), to: addBusinessDays(dispatch, maxDays) };
}

/** US ZIP (5 digits or ZIP+4). Other markets join with i18n. */
export function isValidPostcode(value: string): boolean {
  return /^\d{5}(-\d{4})?$/.test(value.trim());
}

// ------------------------------------------------------------- reviews

export interface ReviewSummary {
  average: number;
  count: number;
  /** Count per star, index 0 = 1 star. */
  distribution: [number, number, number, number, number];
  /** -1 runs small … 0 true to size … 1 runs large; null without fit data. */
  fit: number | null;
  recommendPercent: number;
}

export function summariseReviews(
  reviews: ReadonlyArray<{ rating: number; fit?: number | undefined }>,
): ReviewSummary {
  const distribution: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  let total = 0;
  const fits: number[] = [];
  for (const r of reviews) {
    const index = Math.min(5, Math.max(1, Math.round(r.rating))) - 1;
    distribution[index] = (distribution[index] ?? 0) + 1;
    total += r.rating;
    if (r.fit !== undefined) fits.push(r.fit);
  }
  const count = reviews.length;
  return {
    average: count ? Math.round((total / count) * 10) / 10 : 0,
    count,
    distribution,
    fit: fits.length
      ? Math.round((fits.reduce((a, b) => a + b, 0) / fits.length / 2) * 100) / 100
      : null,
    recommendPercent: count
      ? Math.round((reviews.filter((r) => r.rating >= 4).length / count) * 100)
      : 0,
  };
}

export function fitLabel(fit: number | null): string | null {
  if (fit === null) return null;
  if (fit <= -0.35) return "Runs small";
  if (fit <= -0.12) return "Runs slightly small";
  if (fit < 0.12) return "True to size";
  if (fit < 0.35) return "Runs slightly large";
  return "Runs large";
}
