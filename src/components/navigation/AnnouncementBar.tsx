"use client";

import NextLink from "next/link";
import { useEffect, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon } from "@/components/icons";
import type { Announcement } from "@/config/announcements";
import { useNow, useStorageItem } from "@/lib/browser/hooks";
import { writeStorage } from "@/lib/browser/storage";
import { cn } from "@/lib/utils/cn";

const ROTATE_MS = 6000;
const DISMISS_KEY = "texora-announcements-dismissed";

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  return d > 0 ? `${d}d ${h}h` : `${h}h ${m}m`;
}

/**
 * Rotating promo messages. Auto-rotation pauses on hover and focus and is
 * not announced (WAI carousel pattern); manual controls are.
 */
export function AnnouncementBar({ announcements }: { announcements: readonly Announcement[] }) {
  const now = useNow(30_000);
  const dismissed = useStorageItem("session", DISMISS_KEY) === "1";
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [userNavigated, setUserNavigated] = useState(false);

  const active = announcements.filter(
    (a) => !a.endsAt || now === null || Date.parse(a.endsAt) > now,
  );
  const count = active.length;

  useEffect(() => {
    if (paused || count < 2) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % count), ROTATE_MS);
    return () => window.clearInterval(id);
  }, [paused, count]);

  if (dismissed || count === 0) return null;
  const current = active[index % count];
  if (!current) return null;

  const go = (delta: number) => {
    setUserNavigated(true);
    setIndex((i) => (i + delta + count) % count);
  };

  return (
    <section
      aria-label="Promotions"
      aria-roledescription="carousel"
      className="relative bg-ink text-canvas"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="container-page flex h-10 items-center justify-center gap-2 pr-12 sm:pr-14">
        {count > 1 && (
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Previous message"
            className="hidden size-8 items-center justify-center sm:inline-flex"
          >
            <ChevronLeftIcon />
          </button>
        )}
        <p
          aria-live={userNavigated ? "polite" : "off"}
          className="min-w-0 flex-1 truncate text-center text-xs sm:flex-none"
        >
          <span>{current.message}</span>
          {current.endsAt && now !== null && (
            <span className="ml-2 tabular-nums">
              · Ends in {formatRemaining(Date.parse(current.endsAt) - now)}
            </span>
          )}
          {current.link && (
            <NextLink href={current.link.href} className="ml-3 underline underline-offset-4">
              {current.link.label}
            </NextLink>
          )}
        </p>
        {count > 1 && (
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Next message"
            className="hidden size-8 items-center justify-center sm:inline-flex"
          >
            <ChevronRightIcon />
          </button>
        )}
      </div>
      <button
        type="button"
        aria-label="Dismiss promotions"
        onClick={() => writeStorage("session", DISMISS_KEY, "1")}
        className={cn(
          "absolute top-1/2 right-2 inline-flex size-8 -translate-y-1/2 items-center justify-center",
        )}
      >
        <CloseIcon />
      </button>
    </section>
  );
}
