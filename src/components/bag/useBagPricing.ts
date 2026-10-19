"use client";

import { useEffect, useRef, useState } from "react";
import { getPricedBag } from "@/lib/bag/actions";
import type { BagRequest, BagView } from "@/lib/bag/types";
import { useBagStore } from "@/stores/bag";

interface Options {
  shippingMethod?: BagRequest["shippingMethod"];
  region?: string | null;
  /** Skip pricing (e.g. while a drawer is closed). */
  enabled?: boolean;
}

/**
 * The server-priced view of the bag. Re-prices whenever lines, codes or
 * redemptions change (debounced); stale responses are discarded.
 */
export function useBagPricing({
  shippingMethod = "standard",
  region,
  enabled = true,
}: Options = {}) {
  const lines = useBagStore((s) => s.lines);
  const promoCodes = useBagStore((s) => s.promoCodes);
  const giftCardCode = useBagStore((s) => s.giftCardCode);
  const rewardsValue = useBagStore((s) => s.rewardsValue);
  const [resolved, setResolved] = useState<{
    key: string;
    bag: BagView | null;
    error: string | null;
  } | null>(null);
  const latest = useRef("");

  const request: BagRequest = {
    lines: lines.map((l) => ({ sku: l.sku, quantity: l.quantity })),
    promoCodes,
    shippingMethod,
    ...(region ? { region } : {}),
    ...(giftCardCode ? { giftCardCode } : {}),
    ...(rewardsValue ? { rewardsValue } : {}),
  };
  const key = JSON.stringify(request);

  useEffect(() => {
    if (!enabled) return;
    latest.current = key;
    const timer = window.setTimeout(async () => {
      const result = await getPricedBag(JSON.parse(key));
      if (latest.current !== key) return;
      setResolved({
        key,
        bag: result.ok ? result.data : null,
        error: result.ok ? null : result.error.message,
      });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [key, enabled]);

  return {
    bag: resolved?.bag ?? null,
    error: resolved?.key === key ? resolved.error : null,
    /** True while the shown bag is older than the current request. */
    pending: enabled && resolved?.key !== key,
    empty: lines.length === 0,
  };
}
