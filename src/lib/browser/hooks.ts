"use client";

import { useCallback, useSyncExternalStore } from "react";
import { readCookie, readStorage, subscribeToBrowserState, type StorageArea } from "./storage";

/**
 * A storage value, kept in sync with writes from this tab and others.
 * Returns undefined during server rendering and hydration, so markup matches.
 */
export function useStorageItem(kind: StorageArea, key: string): string | null | undefined {
  return useSyncExternalStore(
    subscribeToBrowserState,
    () => readStorage(kind, key),
    () => undefined,
  );
}

/** A cookie value; undefined on the server. */
export function useCookie(name: string): string | null | undefined {
  return useSyncExternalStore(
    subscribeToBrowserState,
    () => readCookie(name),
    () => undefined,
  );
}

/** The current time, updated every `intervalMs`; null on the server. */
export function useNow(intervalMs: number): number | null {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const id = window.setInterval(onChange, intervalMs);
      return () => window.clearInterval(id);
    },
    [intervalMs],
  );
  return useSyncExternalStore(
    subscribe,
    () => Math.floor(Date.now() / intervalMs) * intervalMs,
    () => null,
  );
}

const noopSubscribe = () => () => {};

/** False during server render and hydration, true once this tree runs on the client. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}
