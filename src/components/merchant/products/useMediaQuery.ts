"use client";

import { useSyncExternalStore } from "react";

/**
 * Whether a media query matches, kept in sync with the window. The server
 * (and the first client render) assume it doesn't, so desktop layout renders
 * first and switches after hydration on small screens.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
