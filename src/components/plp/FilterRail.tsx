"use client";

import * as Accordion from "@radix-ui/react-accordion";
import { ChevronDownIcon } from "@/components/icons";
import { toggleFilter, type Facet, type ListingFilters, type SortKey } from "@/lib/catalog/listing";
import { FacetControls } from "./FacetControls";
import { useListingNavigation } from "./useListingNavigation";

interface FilterRailProps {
  facets: Facet[];
  filters: ListingFilters;
  sort: SortKey;
  basePath: string;
  extraParams?: Record<string, string>;
  /** The listing's default sort, omitted from URLs. */
  defaultSort?: SortKey;
}

/** Desktop filter rail: collapsible groups; each change updates the URL. */
export function FilterRail({
  facets,
  filters,
  sort,
  basePath,
  extraParams,
  defaultSort,
}: FilterRailProps) {
  const { navigate, pending } = useListingNavigation(basePath, extraParams, defaultSort);
  const visible = facets.filter((f) => f.options.length > 0);
  const defaultOpen = visible
    .filter((f, i) => i < 4 || f.options.some((o) => o.selected))
    .map((f) => f.key);

  return (
    <aside aria-label="Filters" aria-busy={pending} className="hidden lg:block">
      <Accordion.Root
        type="multiple"
        defaultValue={defaultOpen}
        className={pending ? "opacity-60 transition-opacity" : undefined}
      >
        {visible.map((facet) => (
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
                facet={facet}
                idPrefix="rail"
                onToggle={(key, value) => navigate(toggleFilter(filters, key, value), sort)}
              />
            </Accordion.Content>
          </Accordion.Item>
        ))}
      </Accordion.Root>
    </aside>
  );
}
