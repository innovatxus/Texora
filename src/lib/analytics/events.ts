/**
 * Typed ecommerce analytics (spec 10). Events use the GA4 ecommerce shape on
 * `window.dataLayer`, so a tag manager or analytics tool can be connected
 * without code changes. Nothing is recorded unless the shopper accepted
 * analytics cookies; money is sent in dollars, as GA4 expects.
 */
import { CONSENT_COOKIE, parseConsent } from "@/lib/consent";

export interface AnalyticsItem {
  item_id: string;
  item_name: string;
  /** SKU, or the colour when no size is chosen yet. */
  item_variant?: string;
  /** Unit price in dollars. */
  price?: number;
  quantity?: number;
  item_category?: string;
  /** The merchant shop for marketplace items. */
  item_brand?: string;
}

type Money = { currency: "USD"; value: number };

export type AnalyticsEvent =
  | { name: "view_item_list"; params: { item_list_name: string; items: AnalyticsItem[] } }
  | { name: "select_item"; params: { item_list_name: string; items: AnalyticsItem[] } }
  | { name: "view_item"; params: Money & { items: AnalyticsItem[] } }
  | { name: "add_to_cart"; params: Money & { items: AnalyticsItem[] } }
  | { name: "begin_checkout"; params: { currency: "USD"; items: AnalyticsItem[] } }
  | { name: "add_payment_info"; params: Money & { payment_type: string } }
  | {
      name: "purchase";
      params: Money & {
        transaction_id: string;
        tax: number;
        shipping: number;
        items: AnalyticsItem[];
      };
    }
  | { name: "refund"; params: Money & { transaction_id: string } };

/** Cents to dollars, rounded to the cent. */
export const dollars = (cents: number) => Math.round(cents) / 100;

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

/** Whether the shopper has accepted analytics cookies (false on the server). */
export function analyticsAllowed(cookie = typeof document === "undefined" ? "" : document.cookie) {
  const value = cookie
    .split(/;\s*/)
    .find((part) => part.startsWith(`${CONSENT_COOKIE}=`))
    ?.slice(CONSENT_COOKIE.length + 1);
  return parseConsent(value)?.analytics === true;
}

/**
 * Records one event, if analytics are allowed. Each event clears the previous
 * ecommerce object first (GA4's recommendation) so fields never leak across.
 * Returns whether it was recorded.
 */
export function track(event: AnalyticsEvent): boolean {
  if (typeof window === "undefined" || !analyticsAllowed()) return false;
  window.dataLayer ??= [];
  window.dataLayer.push({ ecommerce: null });
  window.dataLayer.push({ event: event.name, ecommerce: event.params });
  return true;
}

/** Records an event once per key in this tab (e.g. a purchase on a reloaded confirmation page). */
export function trackOnce(key: string, event: AnalyticsEvent): boolean {
  try {
    const storageKey = `texora-tracked-${key}`;
    if (sessionStorage.getItem(storageKey)) return false;
    const recorded = track(event);
    if (recorded) sessionStorage.setItem(storageKey, "1");
    return recorded;
  } catch {
    return track(event);
  }
}
