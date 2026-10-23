import { VAT_RATE } from "@/config/locale";

/**
 * Egyptian VAT (14%), added at checkout on goods and delivery. Prices are
 * shown before VAT; the rate is the same in every governorate.
 */
export const DEFAULT_TAX_RATE = VAT_RATE;

/** The VAT rate for a delivery governorate (one national rate). */
export function taxRateFor(_region?: string | null): number {
  return VAT_RATE;
}

/** Label for the tax line on bags, orders and invoices, e.g. "VAT (14%)". */
export const TAX_LABEL = `VAT (${Math.round(VAT_RATE * 100)}%)`;
