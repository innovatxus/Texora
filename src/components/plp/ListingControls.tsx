"use client";

import { type ReactNode } from "react";
import { Select } from "@/components/primitives";
import { useStorageItem } from "@/lib/browser/hooks";
import { writeStorage } from "@/lib/browser/storage";
import { SORTS, type ListingFilters, type SortKey } from "@/lib/catalog/listing";
import { cn } from "@/lib/utils/cn";
import { useListingNavigation } from "./useListingNavigation";

const DESKTOP_KEY = "texora-grid-desktop";
const MOBILE_KEY = "texora-grid-mobile";
const DESKTOP_OPTIONS = ["2", "3", "4"] as const;
const MOBILE_OPTIONS = ["1", "2"] as const;

export function SortMenu({
  filters,
  sort,
  basePath,
  extraParams,
  relevanceLabel,
}: {
  filters: ListingFilters;
  sort: SortKey;
  basePath: string;
  extraParams?: Record<string, string>;
  /** On search, "featured" means relevance. */
  relevanceLabel?: string;
}) {
  const { navigate } = useListingNavigation(basePath, extraParams);
  const options = Object.entries(SORTS).map(([value, label]) => ({
    value,
    label: value === "featured" && relevanceLabel ? relevanceLabel : label,
  }));
  return (
    <Select
      label="Sort by"
      hideLabel
      size="md"
      options={options}
      value={sort}
      onChange={(e) => navigate(filters, e.target.value as SortKey)}
      className="w-48"
    />
  );
}

function useDensity() {
  const desktop = useStorageItem("local", DESKTOP_KEY) ?? "4";
  const mobile = useStorageItem("local", MOBILE_KEY) ?? "2";
  return {
    desktop: (DESKTOP_OPTIONS as readonly string[]).includes(desktop) ? desktop : "4",
    mobile: (MOBILE_OPTIONS as readonly string[]).includes(mobile) ? mobile : "2",
  };
}

/** Columns per row, remembered per device class. */
export function DensityToggle() {
  const { desktop, mobile } = useDensity();
  const button = (active: boolean, extra: string) =>
    cn(
      "flex h-10 min-w-10 items-center justify-center border px-2 text-xs tabular-nums transition-colors duration-fast",
      active ? "border-ink bg-ink text-surface" : "border-ink-subtle hover:border-ink",
      extra,
    );
  return (
    <div role="group" aria-label="Products per row" className="flex gap-1">
      {MOBILE_OPTIONS.map((n) => (
        <button
          key={`m${n}`}
          type="button"
          aria-pressed={mobile === n}
          onClick={() => writeStorage("local", MOBILE_KEY, n)}
          className={button(mobile === n, "lg:hidden")}
        >
          {n}
        </button>
      ))}
      {DESKTOP_OPTIONS.map((n) => (
        <button
          key={`d${n}`}
          type="button"
          aria-pressed={desktop === n}
          onClick={() => writeStorage("local", DESKTOP_KEY, n)}
          className={button(desktop === n, "hidden lg:flex")}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

const DESKTOP_CLASS: Record<string, string> = {
  "2": "lg:grid-cols-2",
  "3": "lg:grid-cols-3",
  "4": "lg:grid-cols-4",
};
const MOBILE_CLASS: Record<string, string> = { "1": "grid-cols-1", "2": "grid-cols-2" };

/** The grid itself; children are server-rendered cards and tiles. */
export function DensityGrid({ children }: { children: ReactNode }) {
  const { desktop, mobile } = useDensity();
  return (
    <ul
      className={cn(
        "grid gap-x-4 gap-y-10 md:grid-cols-3",
        MOBILE_CLASS[mobile],
        DESKTOP_CLASS[desktop],
      )}
    >
      {children}
    </ul>
  );
}
