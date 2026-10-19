"use client";

import { useEffect } from "react";
import { useBagStore } from "@/stores/bag";
import { useCheckoutStore } from "@/stores/checkout";

/**
 * Empties the bag and checkout state once the confirmation page for a placed
 * order is on screen. Clearing earlier would trip the checkout's "empty bag"
 * guard before navigation completed.
 */
export function ClearAfterOrder() {
  useEffect(() => {
    useBagStore.getState().clear();
    useCheckoutStore.getState().reset();
  }, []);
  return null;
}
