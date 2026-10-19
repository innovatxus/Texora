"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";
import { IconButton } from "@/components/primitives";

/**
 * Horizontal scroller with snap points and previous/next controls. Native
 * scrolling stays available (touch, trackpad, Shift+wheel); the buttons
 * page by one viewport and disable at the ends.
 */
export function CarouselTrack({ label, children }: { label: string; children: ReactNode }) {
  const ref = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setEdges({
      start: el.scrollLeft <= 2,
      end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2,
    });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure]);

  const page = (direction: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.9, behavior: "smooth" });
  };

  return (
    <div className="relative">
      <ul
        ref={ref}
        onScroll={measure}
        aria-label={label}
        className="-mx-4 flex snap-x snap-mandatory scroll-px-4 [scrollbar-width:none] gap-4 overflow-x-auto px-4 pb-2 md:-mx-6 md:scroll-px-6 md:px-6 lg:mx-0 lg:scroll-px-0 lg:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </ul>
      <div className="mt-6 hidden justify-end gap-2 md:flex">
        <IconButton
          label={`Previous ${label}`}
          icon={<ChevronLeftIcon />}
          variant="outline"
          size="sm"
          disabled={edges.start}
          onClick={() => page(-1)}
        />
        <IconButton
          label={`Next ${label}`}
          icon={<ChevronRightIcon />}
          variant="outline"
          size="sm"
          disabled={edges.end}
          onClick={() => page(1)}
        />
      </div>
    </div>
  );
}
