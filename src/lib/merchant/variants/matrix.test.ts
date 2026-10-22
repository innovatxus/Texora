import {
  attributeProblems,
  CATEGORY_PRODUCT_CONFIG,
  compositionProblem,
  formatComposition,
} from "@/config/product-attributes";
import { ATTRIBUTE_LABELS } from "@/lib/catalog/listing";
import {
  applyBulk,
  buildMatrix,
  combinations,
  dedupeSkus,
  filterRows,
  matrixProblems,
  onlineStock,
  suggestSku,
  variantKey,
  type MatrixDefaults,
  type MatrixOptions,
  type MatrixRow,
} from "./matrix";

const defaults: MatrixDefaults = {
  skuPrefix: "MRU-DRS1",
  price: 14800,
  compareAtPrice: null,
  weightGrams: 400,
  lowStockThreshold: 3,
};

const options = (over: Partial<MatrixOptions> = {}): MatrixOptions => ({
  colors: ["navy", "sand", "black"],
  fits: ["regular", "petite"],
  sizes: ["XS", "S", "M", "L", "XL", "XXL"],
  excluded: new Set(),
  ...over,
});

const build = (o: MatrixOptions, previous: MatrixRow[] = [], parked: MatrixRow[] = []) =>
  buildMatrix(o, previous, parked, defaults);

describe("generate", () => {
  it("creates every colour × fit × size in order (3 × 2 × 6 = 36)", () => {
    const { rows, added, kept, removed } = build(options());
    expect(rows).toHaveLength(36);
    expect([added, kept, removed]).toEqual([36, 0, 0]);
    expect(rows[0]).toMatchObject({ color: "navy", fit: "regular", size: "XS", price: 14800 });
    expect(rows[6]).toMatchObject({ color: "navy", fit: "petite", size: "XS" });
    expect(rows[12]).toMatchObject({ color: "sand", fit: "regular", size: "XS" });
  });

  it("suggests readable SKUs and keeps them unique", () => {
    expect(suggestSku("mru drs1", "Navy Blue", "regular", "XS")).toBe("MRU-DRS1-NAVY-BLUE-R-XS");
    expect(suggestSku("", "é cru", "plus", "28x30")).toBe("E-CRU-W-28X30");
    const { rows } = build(options());
    expect(new Set(rows.map((r) => r.sku)).size).toBe(rows.length);
  });

  it("leaves out combinations the merchant doesn't make", () => {
    const excluded = new Set([
      variantKey("black", "petite", "XXL"),
      variantKey("black", "petite", "XL"),
    ]);
    const { rows } = build(options({ excluded }));
    expect(rows).toHaveLength(34);
    expect(rows.some((r) => r.key === variantKey("black", "petite", "XXL"))).toBe(false);
  });

  it("returns nothing when any option is empty", () => {
    expect(combinations(options({ colors: [] }))).toEqual([]);
    expect(combinations(options({ sizes: [] }))).toEqual([]);
  });
});

describe("merge when options change", () => {
  /** A matrix where the merchant has entered prices and stock. */
  function edited(): MatrixRow[] {
    return build(options()).rows.map((r, i) => ({
      ...r,
      price: 10000 + i,
      stock: { loc1: i },
      barcode: `BC${i}`,
    }));
  }

  it("keeps entered prices and stock when a size is added", () => {
    const before = edited();
    const after = build(options({ sizes: ["XS", "S", "M", "L", "XL", "XXL", "3XL"] }), before);
    expect(after.rows).toHaveLength(42);
    expect([after.added, after.kept, after.removed]).toEqual([6, 36, 0]);
    for (const row of before) {
      expect(after.rows.find((r) => r.key === row.key)).toEqual(row);
    }
    expect(after.rows.find((r) => r.size === "3XL")).toMatchObject({ price: 14800, stock: {} });
  });

  it("parks removed rows and restores them, values intact, when re-added", () => {
    const before = edited();
    const removed = build(options({ colors: ["navy", "sand"] }), before);
    expect([removed.added, removed.kept, removed.removed]).toEqual([0, 24, 12]);
    expect(removed.parked).toHaveLength(12);

    const back = build(options(), removed.rows, removed.parked);
    expect(back.rows).toHaveLength(36);
    expect(back.parked).toHaveLength(0);
    for (const row of before) {
      expect(back.rows.find((r) => r.key === row.key)).toEqual(row);
    }
  });

  it("keeps values through fit changes and reorders rows with the colours", () => {
    const before = edited();
    const navyRegularXs = before[0];
    const after = build(options({ colors: ["black", "navy", "sand"], fits: ["regular"] }), before);
    expect(after.rows).toHaveLength(18);
    expect(after.rows[0]?.color).toBe("black");
    expect(after.rows.find((r) => r.key === navyRegularXs?.key)).toEqual(navyRegularXs);
    expect(after.removed).toBe(18);
  });

  it("drops a row when its combination is excluded, and restores it when included again", () => {
    const before = edited();
    const key = variantKey("sand", "regular", "M");
    const original = before.find((r) => r.key === key);
    const excluded = build(options({ excluded: new Set([key]) }), before);
    expect(excluded.rows.some((r) => r.key === key)).toBe(false);
    const included = build(options(), excluded.rows, excluded.parked);
    expect(included.rows.find((r) => r.key === key)).toEqual(original);
  });

  it("is stable: rebuilding with the same options changes nothing", () => {
    const before = edited();
    const again = build(options(), before);
    expect(again.rows).toEqual(before);
    expect([again.added, again.removed]).toEqual([0, 0]);
  });
});

describe("bulk edit and filters", () => {
  it("applies price, stock and flags only to the selected rows", () => {
    const { rows } = build(options());
    const navy = filterRows(rows, { color: "navy" });
    expect(navy).toHaveLength(12);
    const selected = new Set(navy.map((r) => r.key));
    const next = applyBulk(rows, selected, {
      price: 12000,
      stock: { locationId: "loc1", quantity: 5 },
      backorder: true,
    });
    expect(
      next
        .filter((r) => r.color === "navy")
        .every((r) => r.price === 12000 && r.stock.loc1 === 5 && r.backorder),
    ).toBe(true);
    expect(
      next.filter((r) => r.color !== "navy").every((r) => r.price === 14800 && !r.stock.loc1),
    ).toBe(true);
    // Stock at other locations is untouched.
    const twice = applyBulk(next, selected, { stock: { locationId: "loc2", quantity: 2 } });
    expect(twice.find((r) => r.color === "navy")?.stock).toEqual({ loc1: 5, loc2: 2 });
  });

  it("filters by colour, fit and size together", () => {
    const { rows } = build(options());
    expect(filterRows(rows, { color: "sand", fit: "petite", size: "M" })).toHaveLength(1);
    expect(filterRows(rows, {})).toHaveLength(36);
  });

  it("dedupes repeated SKUs", () => {
    const { rows } = build(options({ colors: ["navy"], fits: ["regular"], sizes: ["S", "M"] }));
    const same = rows.map((r) => ({ ...r, sku: "X" }));
    expect(dedupeSkus(same).map((r) => r.sku)).toEqual(["X", "X-2"]);
  });
});

describe("stock and publish checks", () => {
  it("counts only ship-from locations as online stock", () => {
    expect(onlineStock({ wh: 4, store: 10, gone: 3 }, ["wh", "gone"])).toBe(7);
    expect(onlineStock({ wh: -2 }, ["wh"])).toBe(0);
  });

  it("explains what blocks publishing", () => {
    const { rows } = build(options({ colors: ["navy"], fits: ["regular"], sizes: ["S", "M"] }));
    const unpriced = rows.map((r, i) => (i === 0 ? { ...r, price: null } : r));
    expect(matrixProblems(unpriced, ["wh"]).map((p) => p.message)).toEqual([
      "Price every variant you make (1 missing)",
      "Add stock or allow backorder on at least one variant",
    ]);
    const stocked = rows.map((r) => ({ ...r, stock: { wh: 2 } }));
    expect(matrixProblems(stocked, ["wh"])).toEqual([]);
    expect(matrixProblems(stocked, [])[0]?.message).toBe(
      "Add stock or allow backorder on at least one variant",
    );
    const badCompare = stocked.map((r) => ({ ...r, compareAtPrice: r.price }));
    expect(matrixProblems(badCompare, ["wh"])[0]?.message).toBe(
      "Compare-at must be higher than the price",
    );
    expect(matrixProblems([], ["wh"])[0]?.message).toBe("Add at least one colour, fit and size");
  });
});

describe("category attributes", () => {
  it("only uses storefront filter keys for category-specific attributes", () => {
    const filterKeys = new Set(Object.keys(ATTRIBUTE_LABELS));
    for (const config of CATEGORY_PRODUCT_CONFIG) {
      for (const def of config.attributes.filter((d) => d.required)) {
        expect(filterKeys.has(def.key), `${config.categoryKey}.${def.key}`).toBe(true);
      }
    }
  });

  it("reports missing and unknown values", () => {
    expect(attributeProblems("women/dresses", { length: "midi" })).toEqual([
      { key: "sleeve", message: "Fill in the required attribute: Sleeve" },
    ]);
    expect(
      attributeProblems("women/dresses", { length: "ankle", sleeve: "short" })[0]?.message,
    ).toBe("Choose length from the list");
    expect(attributeProblems("women", {})[0]?.message).toBe("Choose a specific category");
  });

  it("checks composition adds up to 100", () => {
    expect(
      compositionProblem([
        { material: "linen", percent: 55 },
        { material: "cotton", percent: 45 },
      ]),
    ).toBeNull();
    expect(compositionProblem([{ material: "linen", percent: 90 }])).toBe(
      "Total 90% — composition must add up to 100%",
    );
    expect(compositionProblem([{ material: "kryptonite", percent: 100 }])).toBe(
      "Choose each material from the list",
    );
    expect(compositionProblem([])).toBe("Add the fabric composition");
    expect(
      formatComposition([
        { material: "cotton", percent: 45 },
        { material: "linen", percent: 55 },
      ]),
    ).toBe("55% linen, 45% cotton");
  });
});
