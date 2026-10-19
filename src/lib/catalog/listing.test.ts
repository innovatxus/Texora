import {
  applyFilters,
  computeFacets,
  countActiveFilters,
  describeActiveFilters,
  EMPTY_FILTERS,
  isFilterSelected,
  pageOf,
  parseListingQuery,
  sortProducts,
  toggleFilter,
  toSearchParams,
} from "./listing";
import type { ListingProduct } from "./listing-types";

const NOW = Date.parse("2026-10-19T00:00:00Z");
const DAY = 86_400_000;

function product(id: string, overrides: Partial<ListingProduct> = {}): ListingProduct {
  return {
    id,
    slug: id,
    name: id,
    department: "women",
    categoryPath: ["women", "dresses"],
    attributes: { material: ["linen"] },
    fitFamilies: ["regular"],
    defaultFit: "regular",
    sizeType: "alpha",
    colors: [
      {
        code: "navy",
        name: "Navy",
        family: "blue",
        swatch: "#000",
        image: { url: "", alt: "" },
        sizes: [],
      },
    ],
    price: 9000,
    maxPrice: 9000,
    badges: [],
    ratingAvg: 4,
    ratingCount: 10,
    salesRank: 1,
    createdAt: NOW - 100 * DAY,
    sizesInStock: ["S", "M"],
    inStockOnline: true,
    storesInStock: [],
    ...overrides,
  };
}

const catalog = [
  product("a", {
    price: 4000,
    salesRank: 3,
    sizesInStock: ["S"],
    fitFamilies: ["regular", "petite"],
  }),
  product("b", {
    price: 12000,
    compareAtPrice: 16000,
    salesRank: 1,
    attributes: { material: ["silk"] },
    colors: [
      {
        code: "black",
        name: "Black",
        family: "black",
        swatch: "#000",
        image: { url: "", alt: "" },
        sizes: [],
      },
    ],
    createdAt: NOW - 5 * DAY,
  }),
  product("c", {
    price: 30000,
    salesRank: 2,
    categoryPath: ["women", "outerwear"],
    storesInStock: ["soho"],
    sizesInStock: ["L"],
  }),
  product("d", { price: 9000, salesRank: 4, inStockOnline: false, sizesInStock: [] }),
];

const context = {
  categories: [
    { slug: "dresses", name: "Dresses" },
    { slug: "outerwear", name: "Coats & jackets" },
  ],
  attributeKeys: ["material"],
  stores: [{ id: "soho", name: "Texora SoHo" }],
};

const ids = (ps: ListingProduct[]) => ps.map((p) => p.id).sort();

describe("parseListingQuery", () => {
  it("reads repeated and comma-separated values, sort and page", () => {
    const q = parseListingQuery({
      size: ["S", "M,L"],
      color: "blue",
      sort: "price_asc",
      page: "3",
      material: "linen",
    });
    expect(q.filters.size).toEqual(["S", "M", "L"]);
    expect(q.filters.color).toEqual(["blue"]);
    expect(q.filters.attrs).toEqual({ material: ["linen"] });
    expect(q.sort).toBe("price_asc");
    expect(q.page).toBe(3);
  });

  it("ignores malformed values instead of throwing", () => {
    const q = parseListingQuery({ sort: "cheapest", page: "-4", price: "1-2", sale: "yes" });
    expect(q.sort).toBe("featured");
    expect(q.page).toBe(1);
    expect(q.filters.price).toEqual([]);
    expect(q.filters.sale).toBe(false);
  });

  it("round-trips through the URL", () => {
    const q = parseListingQuery({
      size: ["M", "S"],
      material: "silk",
      sale: "1",
      sort: "newest",
      page: "2",
    });
    const again = parseListingQuery(
      Object.fromEntries(
        [...toSearchParams(q).entries()].reduce(
          (m, [k, v]) => m.set(k, [...(m.get(k) ?? []), v]),
          new Map<string, string[]>(),
        ),
      ),
    );
    expect(again).toEqual(q);
  });
});

describe("applyFilters", () => {
  it("ORs values within a group", () => {
    expect(ids(applyFilters(catalog, { ...EMPTY_FILTERS, size: ["S", "L"] }, NOW))).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("ANDs across groups", () => {
    expect(
      ids(
        applyFilters(catalog, { ...EMPTY_FILTERS, size: ["S", "L"], category: ["dresses"] }, NOW),
      ),
    ).toEqual(["a", "b"]);
  });

  it("filters price ranges, sale, new, availability and attributes", () => {
    expect(ids(applyFilters(catalog, { ...EMPTY_FILTERS, price: ["0-50", "250-"] }, NOW))).toEqual([
      "a",
      "c",
    ]);
    expect(ids(applyFilters(catalog, { ...EMPTY_FILTERS, sale: true }, NOW))).toEqual(["b"]);
    expect(ids(applyFilters(catalog, { ...EMPTY_FILTERS, new: true }, NOW))).toEqual(["b"]);
    expect(ids(applyFilters(catalog, { ...EMPTY_FILTERS, availability: ["soho"] }, NOW))).toEqual([
      "c",
    ]);
    expect(
      ids(applyFilters(catalog, { ...EMPTY_FILTERS, attrs: { material: ["silk"] } }, NOW)),
    ).toEqual(["b"]);
    expect(ids(applyFilters(catalog, { ...EMPTY_FILTERS, fit: ["petite"] }, NOW))).toEqual(["a"]);
  });
});

describe("computeFacets", () => {
  const facet = (facets: ReturnType<typeof computeFacets>, key: string) =>
    facets.find((f) => f.key === key);

  it("counts each facet with the other filters applied, not its own", () => {
    const facets = computeFacets(
      catalog,
      { ...EMPTY_FILTERS, size: ["S"], category: ["dresses"] },
      context,
      NOW,
    );
    // Size counts ignore the size filter but respect category.
    expect(facet(facets, "size")?.options.map((o) => [o.value, o.count, o.selected])).toEqual([
      ["S", 2, true],
      ["M", 1, false],
    ]);
    // Category counts ignore category but respect size.
    expect(facet(facets, "category")?.options.map((o) => [o.value, o.count])).toEqual([
      ["dresses", 2],
    ]);
  });

  it("orders sizes by the size run", () => {
    const facets = computeFacets(catalog, EMPTY_FILTERS, context, NOW);
    expect(facet(facets, "size")?.options.map((o) => o.value)).toEqual(["S", "M", "L"]);
  });

  it("offers colour swatches, stores and highlights", () => {
    const facets = computeFacets(catalog, EMPTY_FILTERS, context, NOW);
    expect(facet(facets, "color")?.options.map((o) => o.value)).toEqual(["black", "blue"]);
    expect(facet(facets, "availability")?.options).toEqual([
      { value: "online", label: "In stock online", count: 3, selected: false },
      { value: "soho", label: "In store: SoHo", count: 1, selected: false },
    ]);
    expect(facet(facets, "toggles")?.options.map((o) => [o.value, o.count])).toEqual([
      ["sale", 1],
      ["new", 1],
    ]);
  });

  it("drops the sale toggle on sale-only scopes", () => {
    const facets = computeFacets(catalog, EMPTY_FILTERS, { ...context, saleScope: true }, NOW);
    expect(facet(facets, "toggles")?.options.map((o) => o.value)).toEqual(["new"]);
  });
});

describe("sorting and paging", () => {
  it("sorts by each key with a stable tiebreak", () => {
    expect(sortProducts(catalog, "price_asc").map((p) => p.id)).toEqual(["a", "d", "b", "c"]);
    expect(sortProducts(catalog, "featured").map((p) => p.id)).toEqual(["b", "c", "a", "d"]);
    expect(sortProducts(catalog, "newest")[0]?.id).toBe("b");
  });

  it("puts pinned products first in the featured sort only", () => {
    expect(sortProducts(catalog, "featured", ["d", "a"]).map((p) => p.id)).toEqual([
      "d",
      "a",
      "b",
      "c",
    ]);
    expect(sortProducts(catalog, "price_desc", ["d"])[0]?.id).toBe("c");
  });

  it("pages cumulatively for load more", () => {
    const items = Array.from({ length: 50 }, (_, i) => i);
    expect(pageOf(items, 1)).toMatchObject({ shown: 24, total: 50, hasMore: true });
    expect(pageOf(items, 3)).toMatchObject({ shown: 50, hasMore: false });
  });
});

describe("filter helpers", () => {
  it("toggles values and booleans", () => {
    let f = toggleFilter(EMPTY_FILTERS, "size", "M");
    f = toggleFilter(f, "material", "linen");
    f = toggleFilter(f, "sale", "1");
    expect(f).toMatchObject({ size: ["M"], attrs: { material: ["linen"] }, sale: true });
    expect(countActiveFilters(f)).toBe(3);
    f = toggleFilter(f, "material", "linen");
    expect(f.attrs).toEqual({});
  });

  it("describes active filters as readable chips", () => {
    const filters = { ...EMPTY_FILTERS, color: ["blue"], attrs: { material: ["silk"] }, new: true };
    const chips = describeActiveFilters(filters, computeFacets(catalog, filters, context, NOW));
    expect(chips.map((c) => c.label)).toEqual(["Blue", "Material: Silk", "New arrivals"]);
  });

  it("reports whether an option is selected", () => {
    const f = { ...EMPTY_FILTERS, size: ["M"], attrs: { material: ["silk"] }, sale: true };
    expect(isFilterSelected(f, "size", "M")).toBe(true);
    expect(isFilterSelected(f, "size", "L")).toBe(false);
    expect(isFilterSelected(f, "material", "silk")).toBe(true);
    expect(isFilterSelected(f, "toggles", "sale")).toBe(true);
    expect(isFilterSelected(f, "toggles", "new")).toBe(false);
  });
});
