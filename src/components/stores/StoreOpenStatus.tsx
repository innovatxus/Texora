"use client";

import { useNow } from "@/lib/browser/hooks";
import { openStatus } from "@/lib/stores/hours";
import { cn } from "@/lib/utils/cn";
import type { Store } from "@/lib/validation";

/**
 * "Open until 8pm", computed in the visitor's browser against the store's
 * own time zone and refreshed every minute. Pages stay static: the line is
 * reserved (same height) until the clock is available.
 */
export function StoreOpenStatus({
  store,
  className,
}: {
  store: Pick<Store, "hours" | "timezone" | "status">;
  className?: string;
}) {
  const now = useNow(60_000);
  if (now === null) {
    return (
      <p aria-hidden className={cn("text-sm", className)}>
        &nbsp;
      </p>
    );
  }
  const status = openStatus(store, new Date(now));
  return (
    // data-dynamic: depends on the time of day, so screenshot tests mask it.
    <p data-dynamic className={cn("flex items-center gap-2 text-sm", className)}>
      <span
        aria-hidden
        className={cn("size-2 rounded-full", status.open ? "bg-success" : "bg-ink-subtle")}
      />
      <span className={status.open ? "text-success" : "text-ink-soft"}>{status.label}</span>
    </p>
  );
}
