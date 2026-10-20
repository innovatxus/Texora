/**
 * Product listing engine: URL ↔ filters, faceting, sorting and paging.
 * Pure and unit tested. Filters are OR within a group and AND across groups;
 * each facet's counts apply every other active filter (standard faceting).
 */
import type { ListingProduct } from "./listing-types";
import { compareSizes } from "./sizes";

/** Products per page in listings. */
export const PAGE_SIZE = 24;
/** Products added within this many days count as new. */
export const NEW_WINDOW_DAYS = 30;

/** Listing sort options and their labels. */
export const SORTS = {
  featured: "Featured",
  newest: "Newest",
  price_asc: "Price: low to high",
  price_desc: "Price: high to low",
  best_sellers: "Best sellers",
  top_rated: "Top rated",
} as const;
export type SortKey = keyof typeof SORTS;

/** Price filter buckets (cents). */
export const PRICE_RANGES = [
  { value: "0-50", label: "Under $50", min: 0, max: 5000 },
  { value: "50-100", label: "$50 – $100", min: 5000, max: 10000 },
  { value: "100-150", label: "$100 – $150", min: 10000, max: 15000 },
  { value: "150-250", label: "$150 – $250", min: 15000, max: 25000 },
  { value: "250-", label: "$250 and over", min: 25000, max: Number.POSITIVE_INFINITY },
] as const;

/** Labels for attribute facets; unknown keys are title-cased. */
export const ATTRIBUTE_LABELS: Record<string, string> = {
  material: "Material",
  length: "Length",
  sleeve: "Sleeve",
  neckline: "Neckline",
  rise: "Rise",
  leg: "Leg shape",
  cut: "Cut",
  style: "Style",
};

const FIT_LABELS: Record<string, string> = {
  regular: "Regular",
  petite: "Petite",
  tall: "Tall",
  plus: "Plus",
};

export interface ListingFilters {
  category: string[];
  size: string[];
  fit: string[];
  color: string[];
  price: string[];
  /** Attribute facets (material, length, sleeve, …). */
  attrs: Record<string, string[]>;
  sale: boolean;
  new: boolean;
  /** "online" and/or store ids. */
  availability: string[];
}

export interface ListingQuery {
  filters: ListingFilters;
  sort: SortKey;
  page: number;
}

type Params = Record<string, string | string[] | undefined>;

/** URL keys owned by built-in filters; attribute facets may never use these. */
export const RESERVED_FILTER_KEYS = new Set([
  "category",
  "size",
  "fit",
  "color",
  "price",
  "sale",
  "new",
  "availability",
  "sort",
  "page",
  "q",
]);

function list(value: string | string[] | undefined): string[] {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return [
    ...new Set(
      values
        .flatMap((v) => v.split(","))
        .map((v) => v.trim())
        .filter(Boolean),
    ),
  ].slice(0, 30);
}

/** Listing filters with nothing selected. */
export const EMPTY_FILTERS: ListingFilters = {
  category: [],
  size: [],
  fit: [],
  color: [],
  price: [],
  attrs: {},
  sale: false,
  new: false,
  availability: [],
};

/** Parses URL search params. Unknown or malformed values are ignored, never thrown. */
export function parseListingQuery(
  params: Params,
  attributeKeys: readonly string[] = Object.keys(ATTRIBUTE_LABELS),
  /** The listing's own default (a category can set one); used when the URL has no sort. */
  defaultSort: SortKey = "featured",
): ListingQuery {
  const attrs: Record<string, string[]> = {};
  for (const key of attributeKeys) {
    if (RESERVED_FILTER_KEYS.has(key)) continue;
    const values = list(params[key]);
    if (values.length > 0) attrs[key] = values;
  }
  const sortParam = list(params.sort)[0];
  const page = Number.parseInt(list(params.page)[0] ?? "1", 10);
  return {
    filters: {
      category: list(params.category),
      size: list(params.size),
      fit: list(params.fit),
      color: list(params.color),
      price: list(params.price).filter((v) => PRICE_RANGES.some((r) => r.value === v)),
      attrs,
      sale: list(params.sale)[0] === "1",
      new: list(params.new)[0] === "1",
      availability: list(params.availability),
    },
    sort: sortParam && sortParam in SORTS ? (sortParam as SortKey) : defaultSort,
    page: Number.isFinite(page) && page > 0 ? Math.min(page, 50) : 1,
  };
}

/** Serialises filters back to a query string (stable order, defaults omitted). */
export function toSearchParams(
  query: Partial<ListingQuery> & { filters: ListingFilters; defaultSort?: SortKey | undefined },
  extra: Record<string, string> = {},
): URLSearchParams {
  const params = new URLSearchParams(extra);
  const { filters } = query;
  for (const key of ["category", "size", "fit", "color", "price", "availability"] as const) {
    for (const value of filters[key]) params.append(key, value);
  }
  for (const [key, values] of Object.entries(filters.attrs).sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    for (const value of values) params.append(key, value);
  }
  if (filters.sale) params.set("sale", "1");
  if (filters.new) params.set("new", "1");
  // The listing's default sort is implied by an absent parameter, so it is omitted.
  if (query.sort && query.sort !== (query.defaultSort ?? "featured")) {
    params.set("sort", query.sort);
  }
  if (query.page && query.page > 1) params.set("page", String(query.page));
  return params;
}

/** Number of selected filter values, for the filter button badge. */
export function countActiveFilters(filters: ListingFilters): number {
  return (
    filters.category.length +
    filters.size.length +
    filters.fit.length +
    filters.color.length +
    filters.price.length +
    filters.availability.length +
    Object.values(filters.attrs).reduce((n, v) => n + v.length, 0) +
    (filters.sale ? 1 : 0) +
    (filters.new ? 1 : 0)
  );
}

// ------------------------------------------------------------- matching

type FacetKey =
  | "category"
  | "size"
  | "fit"
  | "color"
  | "price"
  | "sale"
  | "new"
  | "availability"
  | `attr:${string}`;

const isNew = (p: ListingProduct, now: number) => now - p.createdAt < NEW_WINDOW_DAYS * 86_400_000;
const onSale = (p: ListingProduct) => p.compareAtPrice !== undefined && p.compareAtPrice > p.price;

function matches(p: ListingProduct, f: ListingFilters, now: number, skip?: FacetKey): boolean {
  const any = (values: string[], test: (v: string) => boolean) =>
    values.length === 0 || values.some(test);
  if (skip !== "category" && !any(f.category, (c) => p.categoryPath[1] === c)) return false;
  if (skip !== "size" && !any(f.size, (s) => p.sizesInStock.includes(s))) return false;
  if (skip !== "fit" && !any(f.fit, (fit) => p.fitFamilies.includes(fit))) return false;
  if (skip !== "color" && !any(f.color, (c) => p.colors.some((col) => col.family === c)))
    return false;
  if (
    skip !== "price" &&
    !any(f.price, (value) => {
      const range = PRICE_RANGES.find((r) => r.value === value);
      return range ? p.price >= range.min && p.price < range.max : false;
    })
  ) {
    return false;
  }
  if (skip !== "sale" && f.sale && !onSale(p)) return false;
  if (skip !== "new" && f.new && !isNew(p, now)) return false;
  if (
    skip !== "availability" &&
    !any(f.availability, (a) => (a === "online" ? p.inStockOnline : p.storesInStock.includes(a)))
  ) {
    return false;
  }
  for (const [key, values] of Object.entries(f.attrs)) {
    if (skip === `attr:${key}`) continue;
    if (!any(values, (v) => (p.attributes[key] ?? []).includes(v))) return false;
  }
  return true;
}

/** Products matching every selected filter. */
export function applyFilters(
  products: readonly ListingProduct[],
  filters: ListingFilters,
  now: number,
): ListingProduct[] {
  return products.filter((p) => matches(p, filters, now));
}

// --------------------------------------------------------------- facets

export interface FacetOption {
  value: string;
  label: string;
  count: number;
  selected: boolean;
  /** Colour swatch for colour-family options. */
  swatch?: string;
}

export interface Facet {
  key: string;
  label: string;
  type: "list" | "swatch" | "size" | "toggle";
  options: FacetOption[];
}

const COLOR_SWATCHES: Record<string, string> = {
  black: "#1c1b1a",
  white: "#f6f3ec",
  neutral: "#d8c9ae",
  brown: "#7a5a3c",
  grey: "#8f8c87",
  blue: "#2e3a63",
  green: "#4f6b4f",
  red: "#7c2530",
  pink: "#e3c3bd",
  yellow: "#ecdca0",
  orange: "#b4603f",
  purple: "#5b3a55",
  multi: "conic-gradient(#b4603f, #ecdca0, #4f6b4f, #2e3a63, #b4603f)",
};

const titleCase = (s: string) => s.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export interface FacetContext {
  /** Sub-categories offered as a facet (department and search scopes). */
  categories?: Array<{ slug: string; name: string }>;
  /** Attribute keys offered for this scope, e.g. a category's `facets`. */
  attributeKeys: readonly string[];
  stores: Array<{ id: string; name: string }>;
  /** Hide the sale toggle on scopes that are already sale-only. */
  saleScope?: boolean;
}

function countBy(
  products: ListingProduct[],
  values: (p: ListingProduct) => string[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const p of products)
    for (const v of new Set(values(p))) counts.set(v, (counts.get(v) ?? 0) + 1);
  return counts;
}

/** Facets for a scope; each counts products matching all *other* active filters. */
export function computeFacets(
  scope: readonly ListingProduct[],
  filters: ListingFilters,
  context: FacetContext,
  now: number,
): Facet[] {
  const without = (key: FacetKey) => scope.filter((p) => matches(p, filters, now, key));
  const facets: Facet[] = [];

  if (context.categories && context.categories.length > 1) {
    const counts = countBy(without("category"), (p) => [p.categoryPath[1] ?? ""]);
    facets.push({
      key: "category",
      label: "Category",
      type: "list",
      options: context.categories
        .map((c) => ({
          value: c.slug,
          label: c.name,
          count: counts.get(c.slug) ?? 0,
          selected: filters.category.includes(c.slug),
        }))
        .filter((o) => o.count > 0 || o.selected),
    });
  }

  const sizeCounts = countBy(without("size"), (p) => p.sizesInStock);
  facets.push({
    key: "size",
    label: "Size",
    type: "size",
    options: [...sizeCounts.entries()]
      .sort(([a], [b]) => compareSizes(a, b))
      .map(([value, count]) => ({
        value,
        label: value.replace("x", " × "),
        count,
        selected: filters.size.includes(value),
      })),
  });

  const fitCounts = countBy(without("fit"), (p) => p.fitFamilies);
  if (fitCounts.size > 1 || filters.fit.length > 0) {
    facets.push({
      key: "fit",
      label: "Fit family",
      type: "list",
      options: ["regular", "petite", "tall"]
        .filter((f) => fitCounts.has(f) || filters.fit.includes(f))
        .map((f) => ({
          value: f,
          label: FIT_LABELS[f] ?? titleCase(f),
          count: fitCounts.get(f) ?? 0,
          selected: filters.fit.includes(f),
        })),
    });
  }

  const colorCounts = countBy(without("color"), (p) => p.colors.map((c) => c.family));
  facets.push({
    key: "color",
    label: "Colour",
    type: "swatch",
    options: Object.keys(COLOR_SWATCHES)
      .filter((c) => colorCounts.has(c) || filters.color.includes(c))
      .map((c) => ({
        value: c,
        label: titleCase(c),
        count: colorCounts.get(c) ?? 0,
        selected: filters.color.includes(c),
        swatch: COLOR_SWATCHES[c],
      })),
  });

  const priceScope = without("price");
  facets.push({
    key: "price",
    label: "Price",
    type: "list",
    options: PRICE_RANGES.map((r) => ({
      value: r.value,
      label: r.label,
      count: priceScope.filter((p) => p.price >= r.min && p.price < r.max).length,
      selected: filters.price.includes(r.value),
    })).filter((o) => o.count > 0 || o.selected),
  });

  for (const key of context.attributeKeys) {
    const counts = countBy(without(`attr:${key}`), (p) => p.attributes[key] ?? []);
    const selected = filters.attrs[key] ?? [];
    if (counts.size === 0 && selected.length === 0) continue;
    facets.push({
      key,
      label: ATTRIBUTE_LABELS[key] ?? titleCase(key),
      type: "list",
      options: [...new Set([...counts.keys(), ...selected])].sort().map((v) => ({
        value: v,
        label: titleCase(v),
        count: counts.get(v) ?? 0,
        selected: selected.includes(v),
      })),
    });
  }

  const availabilityScope = without("availability");
  facets.push({
    key: "availability",
    label: "Availability",
    type: "list",
    options: [
      {
        value: "online",
        label: "In stock online",
        count: availabilityScope.filter((p) => p.inStockOnline).length,
        selected: filters.availability.includes("online"),
      },
      ...context.stores.map((s) => ({
        value: s.id,
        label: `In store: ${s.name.replace(/^Texora /, "")}`,
        count: availabilityScope.filter((p) => p.storesInStock.includes(s.id)).length,
        selected: filters.availability.includes(s.id),
      })),
    ],
  });

  const toggles: FacetOption[] = [];
  if (!context.saleScope) {
    toggles.push({
      value: "sale",
      label: "On sale",
      count: without("sale").filter(onSale).length,
      selected: filters.sale,
    });
  }
  toggles.push({
    value: "new",
    label: "New arrivals",
    count: without("new").filter((p) => isNew(p, now)).length,
    selected: filters.new,
  });
  facets.push({ key: "toggles", label: "Highlights", type: "toggle", options: toggles });

  return facets;
}

// --------------------------------------------------------- sort & paging

/** Products in the chosen sort order. */
export function sortProducts(
  products: readonly ListingProduct[],
  sort: SortKey,
  pinned: readonly string[] = [],
  merch: { boosted?: readonly string[]; buried?: readonly string[] } = {},
): ListingProduct[] {
  const sorted = [...products];
  const by: Record<SortKey, (a: ListingProduct, b: ListingProduct) => number> = {
    featured: (a, b) => a.salesRank - b.salesRank,
    best_sellers: (a, b) => a.salesRank - b.salesRank,
    newest: (a, b) => b.createdAt - a.createdAt,
    price_asc: (a, b) => a.price - b.price,
    price_desc: (a, b) => b.price - a.price,
    top_rated: (a, b) => b.ratingAvg - a.ratingAvg || b.ratingCount - a.ratingCount,
  };
  sorted.sort((a, b) => by[sort](a, b) || a.id.localeCompare(b.id));
  const boosted = new Set(merch.boosted ?? []);
  const buried = new Set(merch.buried ?? []);
  if (sort !== "featured" || (pinned.length === 0 && boosted.size === 0 && buried.size === 0)) {
    return sorted;
  }
  // Merchandising, featured sort only: pinned products lead in pin order,
  // then boosted ones, then the rest; buried products go last.
  const pinnedSet = new Set(pinned);
  const head = pinned
    .map((id) => sorted.find((p) => p.id === id))
    .filter((p): p is ListingProduct => p !== undefined);
  const rest = sorted.filter((p) => !pinnedSet.has(p.id));
  return [
    ...head,
    ...rest.filter((p) => boosted.has(p.id) && !buried.has(p.id)),
    ...rest.filter((p) => !boosted.has(p.id) && !buried.has(p.id)),
    ...rest.filter((p) => buried.has(p.id)),
  ];
}

/** Cumulative paging: page N shows the first N × PAGE_SIZE results ("Load more"). */
export function pageOf<T>(
  items: readonly T[],
  page: number,
  size = PAGE_SIZE,
): { items: T[]; shown: number; total: number; hasMore: boolean } {
  const shown = Math.min(items.length, page * size);
  return {
    items: items.slice(0, shown),
    shown,
    total: items.length,
    hasMore: shown < items.length,
  };
}

/** Human labels for active filter chips. */
export function describeActiveFilters(
  filters: ListingFilters,
  facets: readonly Facet[],
): Array<{ key: string; value: string; label: string }> {
  const labelFor = (key: string, value: string) =>
    facets.find((f) => f.key === key)?.options.find((o) => o.value === value)?.label ??
    titleCase(value);
  const chips: Array<{ key: string; value: string; label: string }> = [];
  for (const key of ["category", "size", "fit", "color", "price", "availability"] as const) {
    for (const value of filters[key]) chips.push({ key, value, label: labelFor(key, value) });
  }
  for (const [key, values] of Object.entries(filters.attrs)) {
    for (const value of values)
      chips.push({
        key,
        value,
        label: `${ATTRIBUTE_LABELS[key] ?? titleCase(key)}: ${titleCase(value)}`,
      });
  }
  if (filters.sale) chips.push({ key: "sale", value: "1", label: "On sale" });
  if (filters.new) chips.push({ key: "new", value: "1", label: "New arrivals" });
  return chips;
}

/** Returns filters with one value toggled (or a boolean flipped). */
export function toggleFilter(filters: ListingFilters, key: string, value: string): ListingFilters {
  const flip = (values: string[]) =>
    values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
  if (key === "sale") return { ...filters, sale: !filters.sale };
  if (key === "new") return { ...filters, new: !filters.new };
  if (
    key === "category" ||
    key === "size" ||
    key === "fit" ||
    key === "color" ||
    key === "price" ||
    key === "availability"
  ) {
    return { ...filters, [key]: flip(filters[key]) };
  }
  const next = flip(filters.attrs[key] ?? []);
  const attrs = { ...filters.attrs };
  if (next.length > 0) attrs[key] = next;
  else delete attrs[key];
  return { ...filters, attrs };
}

/** Whether a facet option is active in a filter set (used to restyle staged selections). */
export function isFilterSelected(filters: ListingFilters, key: string, value: string): boolean {
  if (key === "toggles")
    return value === "sale" ? filters.sale : value === "new" ? filters.new : false;
  if (
    key === "category" ||
    key === "size" ||
    key === "fit" ||
    key === "color" ||
    key === "price" ||
    key === "availability"
  ) {
    return filters[key].includes(value);
  }
  return (filters.attrs[key] ?? []).includes(value);
}
