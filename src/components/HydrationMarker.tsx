"use client";

import { useEffect } from "react";

/**
 * Marks <html data-hydrated> once React has taken over the server HTML.
 * End-to-end tests wait for it before interacting; it has no visual effect.
 */
export function HydrationMarker() {
  useEffect(() => {
    document.documentElement.dataset.hydrated = "true";
  }, []);
  return null;
}
