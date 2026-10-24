"use client";

import { useEffect, useRef, useState } from "react";
import type { HeroVideo as HeroVideoSources } from "@/lib/cms/modules";
import { cn } from "@/lib/utils/cn";

const DESKTOP = "(min-width: 768px)";

/** Whether the visitor asked for less motion or less data. */
function prefersStill(): boolean {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return true;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return connection?.saveData === true;
}

/** Runs after the page has loaded and the browser is idle, so the video never competes with the LCP. */
function whenIdle(run: () => void): () => void {
  let cancelled = false;
  let idleId: number | undefined;
  const schedule = () => {
    if (cancelled) return;
    if ("requestIdleCallback" in window)
      idleId = window.requestIdleCallback(run, { timeout: 2000 });
    else idleId = globalThis.setTimeout(run, 300) as unknown as number;
  };
  if (document.readyState === "complete") schedule();
  else window.addEventListener("load", schedule, { once: true });
  return () => {
    cancelled = true;
    window.removeEventListener("load", schedule);
    if (idleId !== undefined) {
      if ("cancelIdleCallback" in window) window.cancelIdleCallback(idleId);
      else globalThis.clearTimeout(idleId);
    }
  };
}

/**
 * The hero's looping background video, layered over the server-rendered
 * poster (its first frame), so nothing shifts and the poster stays the LCP
 * image. Decorative: the poster carries the alt text. Pauses off screen and in
 * background tabs; the visitor can pause it at any time (WCAG 2.2.2).
 */
export function HeroVideo({
  sources,
  className,
}: {
  sources: HeroVideoSources;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [src, setSrc] = useState<{ webm?: string | undefined; mp4: string } | null>(null);
  const [playing, setPlaying] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const userPausedRef = useRef(false);

  // Choose the file for this screen once the page is idle; switch if the breakpoint changes.
  useEffect(() => {
    if (prefersStill()) return;
    const query = window.matchMedia(DESKTOP);
    const pick = () => setSrc(query.matches ? sources.desktop : sources.mobile);
    const cancel = whenIdle(pick);
    query.addEventListener("change", pick);
    return () => {
      cancel();
      query.removeEventListener("change", pick);
    };
  }, [sources]);

  // Play only while visible and the tab is in front, unless the visitor paused it.
  useEffect(() => {
    const video = ref.current;
    if (!video || !src) return;
    video.load();
    let visible = true;
    const sync = () => {
      if (visible && !document.hidden && !userPausedRef.current) void video.play().catch(() => {});
      else video.pause();
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = (entry?.intersectionRatio ?? 0) > 0.15;
        sync();
      },
      { threshold: [0, 0.15, 0.5] },
    );
    observer.observe(video);
    document.addEventListener("visibilitychange", sync);
    sync();
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, [src]);

  const toggle = () => {
    const video = ref.current;
    if (!video) return;
    const pause = !userPausedRef.current;
    userPausedRef.current = pause;
    setUserPaused(pause);
    if (pause) video.pause();
    else void video.play().catch(() => {});
  };

  if (!src) return null;
  return (
    <>
      <video
        ref={ref}
        muted
        loop
        playsInline
        preload="none"
        aria-hidden="true"
        tabIndex={-1}
        disablePictureInPicture
        disableRemotePlayback
        onPlaying={() => setPlaying(true)}
        className={cn(
          "pointer-events-none absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-slow ease-atelier",
          playing && "opacity-100",
          className,
        )}
      >
        {src.webm && <source src={src.webm} type="video/webm" />}
        <source src={src.mp4} type="video/mp4" />
      </video>
      <button
        type="button"
        onClick={toggle}
        aria-label={userPaused ? "Play background video" : "Pause background video"}
        className="absolute right-3 bottom-3 z-10 inline-flex size-11 items-center justify-center rounded-full bg-surface/80 text-ink backdrop-blur-sm transition-colors hover:bg-brand-tint hover:text-brand md:right-5 md:bottom-5"
      >
        <svg viewBox="0 0 24 24" width={18} height={18} fill="currentColor" aria-hidden="true">
          {userPaused ? (
            <path d="M8 5.5v13l11-6.5z" />
          ) : (
            <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" />
          )}
        </svg>
      </button>
    </>
  );
}
