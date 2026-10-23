/**
 * PDP variant logic: sizes per colour and fit, stock messaging, store
 * availability and delivery estimates. Pure and unit tested; shared by the
 * server page and the client buy box.
 */
import { DELIVERY_DAYS, NON_DELIVERY_DAYS, type DeliveryZone } from "@/config/locale";
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

/** Sizes for a colour and fit, with availability, in size order. */
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

/** The variant for a colour, fit and size, if it exists. */
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

/** Out of stock / low stock / in stock message for a variant. */
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

/** Delivery options. Day ranges depend on the zone (see DELIVERY_DAYS). */
export const DELIVERY_METHODS = {
  standard: { label: "Standard" },
  express: { label: "Express" },
} as const;
export type DeliveryMethod = keyof typeof DELIVERY_METHODS;

/** Orders after this hour (local) leave the warehouse the next business day. */
export const DISPATCH_CUTOFF_HOUR = 14;

const isDeliveryDay = (date: Date) => !NON_DELIVERY_DAYS.includes(date.getDay());

function addBusinessDays(start: Date, days: number): Date {
  const date = new Date(start);
  let added = 0;
  while (added < days) {
    date.setDate(date.getDate() + 1);
    if (isDeliveryDay(date)) added += 1;
  }
  return date;
}

/**
 * Earliest and latest arrival for a method and delivery zone, skipping
 * Fridays and honouring the dispatch cutoff.
 */
export function estimateDelivery(
  method: DeliveryMethod,
  now: Date,
  zone: DeliveryZone = "greater_cairo",
): { from: Date; to: Date } {
  const { minDays, maxDays } = DELIVERY_DAYS[zone][method];
  let dispatch = new Date(now);
  if (!isDeliveryDay(dispatch) || dispatch.getHours() >= DISPATCH_CUTOFF_HOUR)
    dispatch = addBusinessDays(dispatch, 1);
  return { from: addBusinessDays(dispatch, minDays), to: addBusinessDays(dispatch, maxDays) };
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

/** Average rating, star distribution, fit tendency and recommend rate from reviews. */
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

/** "Runs small", "True to size" or "Runs large" from the fit score. */
export function fitLabel(fit: number | null): string | null {
  if (fit === null) return null;
  if (fit <= -0.35) return "Runs small";
  if (fit <= -0.12) return "Runs slightly small";
  if (fit < 0.12) return "True to size";
  if (fit < 0.35) return "Runs slightly large";
  return "Runs large";
}
