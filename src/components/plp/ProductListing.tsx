import NextLink from "next/link";
import { connection } from "next/server";
import { ProductCard } from "@/components/commerce/ProductCard";
import { ProductImage } from "@/components/commerce/ProductImage";
import { ErrorState } from "@/components/feedback/ErrorState";
import { CloseIcon } from "@/components/icons";
import { ButtonLink, Skeleton } from "@/components/primitives";
import type { GridTile } from "@/config/merchandising";
import {
  applyFilters,
  computeFacets,
  describeActiveFilters,
  pageOf,
  parseListingQuery,
  sortProducts,
  toggleFilter,
  toSearchParams,
} from "@/lib/catalog/listing";
import { resolveScope, type ListingScope } from "@/lib/catalog/scope";
import { requestTime } from "@/lib/time";
import { DensityGrid, DensityToggle, SortMenu } from "./ListingControls";
import { FilterDrawer } from "./FilterDrawer";
import { FilterRail } from "./FilterRail";

type SearchParams = Record<string, string | string[] | undefined>;

export interface ProductListingProps {
  scope: ListingScope;
  searchParams: Promise<SearchParams>;
  /** Path the filters apply to, e.g. "/women/dresses". */
  basePath: string;
  tiles?: readonly GridTile[];
  /** Shown when the scope has no products at all (e.g. a new shop), instead of the filter message. */
  emptyScope?: { title: string; description: string };
}

/**
 * The PLP body: toolbar, filters, active chips, grid and load more. Reads
 * searchParams, so pages render it inside <Suspense> with ListingSkeleton.
 */
export async function ProductListing({
  scope,
  searchParams,
  basePath,
  tiles = [],
  emptyScope,
}: ProductListingProps) {
  const params = await searchParams;
  const resolved = await resolveScope(scope);
  const defaultSort = resolved.defaultSort;
  const { filters, sort, page } = parseListingQuery(
    params,
    resolved.context.attributeKeys,
    defaultSort,
  );
  // Results depend on the request (filters, "new" window), never the prerender.
  await connection();
  const now = requestTime();
  const extraParams: Record<string, string> = scope.query ? { q: scope.query } : {};

  const facets = computeFacets(resolved.products, filters, resolved.context, now);
  const results = sortProducts(
    applyFilters(resolved.products, filters, now),
    sort,
    resolved.pinned,
    { boosted: resolved.boosted, buried: resolved.buried },
  );
  const { items, shown, total, hasMore } = pageOf(results, page);
  const chips = describeActiveFilters(filters, facets);

  const hrefFor = (query: URLSearchParams) => (query.size > 0 ? `${basePath}?${query}` : basePath);
  const clearAll = hrefFor(
    toSearchParams({ filters: parseListingQuery({}).filters, sort, defaultSort }, extraParams),
  );
  const nextPage = hrefFor(
    toSearchParams({ filters, sort, page: page + 1, defaultSort }, extraParams),
  );
  const tileAt = new Map(tiles.map((t) => [t.position, t]));

  return (
    <div className="grid gap-8 lg:grid-cols-[15rem_1fr] lg:gap-12">
      <FilterRail
        facets={facets}
        filters={filters}
        sort={sort}
        basePath={basePath}
        extraParams={extraParams}
        defaultSort={defaultSort}
      />

      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
          <p aria-live="polite" className="text-sm text-ink-soft tabular-nums">
            {total} {total === 1 ? "product" : "products"}
          </p>
          <div className="flex items-center gap-2">
            <FilterDrawer
              scope={scope}
              facets={facets}
              filters={filters}
              sort={sort}
              total={total}
              basePath={basePath}
              extraParams={extraParams}
              defaultSort={defaultSort}
            />
            <SortMenu
              filters={filters}
              sort={sort}
              basePath={basePath}
              extraParams={extraParams}
              defaultSort={defaultSort}
              {...(scope.query ? { relevanceLabel: "Relevance" } : {})}
            />
            <div className="hidden sm:block">
              <DensityToggle />
            </div>
          </div>
        </div>

        {chips.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <h2 className="sr-only">Active filters</h2>
            {chips.map((chip) => (
              <NextLink
                key={`${chip.key}:${chip.value}`}
                href={hrefFor(
                  toSearchParams(
                    { filters: toggleFilter(filters, chip.key, chip.value), sort, defaultSort },
                    extraParams,
                  ),
                )}
                scroll={false}
                aria-label={`Remove filter ${chip.label}`}
                className="inline-flex h-9 items-center gap-1.5 rounded-chip bg-surface-muted pr-2 pl-3 text-sm hover:bg-line"
              >
                {chip.label}
                <CloseIcon size={20} className="size-4" />
              </NextLink>
            ))}
            <NextLink
              href={clearAll}
              scroll={false}
              className="ml-1 text-label underline underline-offset-4"
            >
              Clear all
            </NextLink>
          </div>
        )}

        {items.length === 0 && emptyScope && resolved.products.length === 0 ? (
          <ErrorState title={emptyScope.title} description={emptyScope.description} />
        ) : items.length === 0 ? (
          <ErrorState
            title="No products match these filters"
            description="Try removing a filter or two to see more."
            actions={
              <ButtonLink href={clearAll} variant="secondary">
                Clear all filters
              </ButtonLink>
            }
          />
        ) : (
          <div className="mt-8">
            <DensityGrid>
              {items.flatMap((product, i) => {
                const cells = [
                  <li key={product.id}>
                    <ProductCard
                      product={product}
                      priority={i < 4}
                      preferColorFamilies={filters.color}
                    />
                  </li>,
                ];
                const tile = chips.length === 0 ? tileAt.get(i + 2) : undefined;
                if (tile) {
                  cells.push(
                    <li key={`tile-${tile.position}`}>
                      <NextLink href={tile.href} className="group flex h-full flex-col">
                        <span className="relative block aspect-3/4">
                          <ProductImage
                            src={tile.image}
                            alt={tile.imageAlt}
                            fill
                            sizes="(min-width: 1024px) 25vw, 50vw"
                          />
                        </span>
                        <span className="mt-3 text-label text-ink-subtle">{tile.eyebrow}</span>
                        <span className="mt-1 font-display text-2xl group-hover:underline">
                          {tile.title}
                        </span>
                      </NextLink>
                    </li>,
                  );
                }
                return cells;
              })}
            </DensityGrid>

            <div className="mt-14 flex flex-col items-center gap-4">
              <p className="text-sm text-ink-soft tabular-nums">
                Showing {shown} of {total}
              </p>
              <div aria-hidden className="h-0.5 w-48 bg-line">
                <div
                  className="h-full bg-ink"
                  style={{ width: `${(shown / Math.max(1, total)) * 100}%` }}
                />
              </div>
              {hasMore && (
                <ButtonLink href={nextPage} scroll={false} variant="secondary" rel="next">
                  Load more
                </ButtonLink>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Same footprint as the final listing, so nothing shifts when it streams in. */
export function ListingSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-[15rem_1fr] lg:gap-12" aria-busy="true">
      <div className="hidden flex-col gap-6 lg:flex">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} shape="text" className="h-5" />
        ))}
      </div>
      <div>
        <Skeleton shape="text" className="h-10" />
        <ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <li key={i} className="flex flex-col gap-3">
              <Skeleton shape="product" />
              <Skeleton shape="text" className="w-3/4" />
              <Skeleton shape="text" className="w-1/3" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Fallback for a whole listing page while its URL-dependent content streams in. */
export function ListingPageSkeleton() {
  return (
    <div className="container-page pt-8 pb-24" aria-busy="true">
      <Skeleton shape="text" className="h-3 w-48" />
      <Skeleton shape="text" className="mt-5 mb-8 h-12 w-72" />
      <ListingSkeleton />
    </div>
  );
}
