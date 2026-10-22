"use client";

import { useEffect } from "react";
import { trackOnce, type AnalyticsItem } from "@/lib/analytics/events";

/** Records a completed purchase once per order in this tab (reloads don't count twice). */
export function TrackPurchase({
  number,
  value,
  tax,
  shipping,
  items,
}: {
  number: string;
  value: number;
  tax: number;
  shipping: number;
  items: AnalyticsItem[];
}) {
  useEffect(() => {
    trackOnce(`purchase-${number}`, {
      name: "purchase",
      params: { currency: "USD", transaction_id: number, value, tax, shipping, items },
    });
    // One record per order number.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [number]);
  return null;
}
