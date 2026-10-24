"use client";

import { useSyncExternalStore } from "react";
import { openStatus, type HoursSource } from "@/lib/stores/hours";

const subscribe = (onChange: () => void) => {
  const timer = setInterval(onChange, 60_000);
  return () => clearInterval(timer);
};

/**
 * "Open until 6pm" / "Closed · opens 10am tomorrow", computed in the browser
 * at the shopper's current time, so the shop page itself can stay static.
 */
export function OpenNow({ location }: { location: HoursSource }) {
  const minute = useSyncExternalStore(
    subscribe,
    () => Math.floor(Date.now() / 60_000),
    () => null,
  );
  if (minute === null) return null;
  const status = openStatus(location, new Date(minute * 60_000));
  return (
    <p data-dynamic className={status.open ? "text-sm text-success" : "text-sm text-ink-soft"}>
      {status.label}
    </p>
  );
}
