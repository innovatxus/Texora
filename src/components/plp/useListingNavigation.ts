"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toSearchParams, type ListingFilters, type SortKey } from "@/lib/catalog/listing";

/**
 * Pushes a new filter/sort state into the URL (shareable, back-button safe)
 * without jumping the scroll position. Any filter change resets to page 1.
 */
export function useListingNavigation(basePath: string, extra: Record<string, string> = {}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const navigate = (filters: ListingFilters, sort: SortKey) => {
    const query = toSearchParams({ filters, sort }, extra).toString();
    startTransition(() => {
      router.push(query ? `${basePath}?${query}` : basePath, { scroll: false });
    });
  };

  return { navigate, pending };
}
