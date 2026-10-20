"use client";

import * as Accordion from "@radix-ui/react-accordion";
import { useEffect, useState } from "react";
import { Drawer } from "@/components/feedback/Drawer";
import { ChevronDownIcon, FilterIcon } from "@/components/icons";
import { Button } from "@/components/primitives";
import { countListing } from "@/lib/catalog/actions";
import {
  countActiveFilters,
  EMPTY_FILTERS,
  isFilterSelected,
  toggleFilter,
  toSearchParams,
  type Facet,
  type ListingFilters,
  type SortKey,
} from "@/lib/catalog/listing";
import type { ListingScope } from "@/lib/catalog/scope";
import { FacetControls } from "./FacetControls";
import { useListingNavigation } from "./useListingNavigation";

interface FilterDrawerProps {
  scope: ListingScope;
  facets: Facet[];
  filters: ListingFilters;
  sort: SortKey;
  total: number;
  basePath: string;
  extraParams?: Record<string, string>;
  /** The listing's default sort, omitted from URLs. */
  defaultSort?: SortKey;
}

/**
 * Mobile filters: changes are staged in the drawer and applied together.
 * The primary button shows the live result count for the staged selection.
 */
export function FilterDrawer({
  scope,
  facets,
  filters,
  sort,
  total,
  basePath,
  extraParams,
  defaultSort,
}: FilterDrawerProps) {
  const [open, setOpen] = useState(false);
  const [staged, setStaged] = useState<ListingFilters>(filters);
  const [count, setCount] = useState<{ query: string; total: number } | null>(null);
  const { navigate } = useListingNavigation(basePath, extraParams, defaultSort);

  const stagedQuery = toSearchParams({ filters: staged }).toString();

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const result = await countListing({ scope, query: stagedQuery });
      if (!cancelled && result.ok) setCount({ query: stagedQuery, total: result.data.total });
    }, 150);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, scope, stagedQuery]);

  const liveTotal =
    count?.query === stagedQuery
      ? count.total
      : stagedQuery === toSearchParams({ filters }).toString()
        ? total
        : null;
  const active = countActiveFilters(filters);

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        className="lg:hidden"
        onClick={() => {
          setStaged(filters);
          setOpen(true);
        }}
      >
        <FilterIcon /> Filter{active > 0 ? ` (${active})` : ""}
      </Button>
      <Drawer open={open} onOpenChange={setOpen} side="left" title="Filter">
        <div className="flex-1 overflow-y-auto px-4">
          <Accordion.Root type="multiple" defaultValue={facets.slice(0, 3).map((f) => f.key)}>
            {facets
              .filter((f) => f.options.length > 0)
              .map((facet) => (
                <Accordion.Item key={facet.key} value={facet.key} className="border-b border-line">
                  <Accordion.Header>
                    <Accordion.Trigger className="group flex w-full items-center justify-between py-4 text-label">
                      {facet.label}
                      <ChevronDownIcon
                        size={20}
                        className="size-4 transition-transform duration-fast group-data-[state=open]:rotate-180"
                      />
                    </Accordion.Trigger>
                  </Accordion.Header>
                  <Accordion.Content className="pb-5">
                    <FacetControls
                      idPrefix="drawer"
                      facet={{
                        ...facet,
                        options: facet.options.map((o) => ({
                          ...o,
                          selected: isFilterSelected(staged, facet.key, o.value),
                        })),
                      }}
                      onToggle={(key, value) => setStaged((s) => toggleFilter(s, key, value))}
                    />
                  </Accordion.Content>
                </Accordion.Item>
              ))}
          </Accordion.Root>
        </div>
        <div className="grid grid-cols-2 gap-3 border-t border-line p-4">
          <Button variant="secondary" onClick={() => setStaged(EMPTY_FILTERS)}>
            Clear all
          </Button>
          <Button
            onClick={() => {
              navigate(staged, sort);
              setOpen(false);
            }}
          >
            <span aria-live="polite">
              {liveTotal === null ? "Show results" : `Show ${liveTotal} results`}
            </span>
          </Button>
        </div>
      </Drawer>
    </>
  );
}
