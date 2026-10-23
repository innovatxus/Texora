import {
  estimateDelivery,
  findVariant,
  fitLabel,
  fitsForColor,
  sizeOptions,
  stockMessage,
  storeAvailability,
  summariseReviews,
  type PdpVariant,
} from "./variant-selection";

const v = (
  sku: string,
  color: string,
  fitFamily: string,
  size: string,
  online: number,
  stores: Record<string, number> = {},
): PdpVariant => ({
  sku,
  color,
  fitFamily,
  size,
  price: 9000,
  online,
  stores,
  lowStockThreshold: 3,
});

const variants = [
  v("1", "navy", "regular", "M", 10, { soho: 2 }),
  v("2", "navy", "regular", "S", 0, { soho: 0, austin: 4 }),
  v("3", "navy", "regular", "XL", 2),
  v("4", "navy", "petite", "S", 5),
  v("5", "ivory", "regular", "M", 1),
];

describe("size selection", () => {
  it("lists sizes for a colour and fit in size-run order with stock", () => {
    expect(sizeOptions(variants, "navy", "regular").map((s) => [s.size, s.inStock])).toEqual([
      ["S", false],
      ["M", true],
      ["XL", true],
    ]);
  });

  it("finds the exact variant", () => {
    expect(findVariant(variants, "navy", "petite", "S")?.sku).toBe("4");
    expect(findVariant(variants, "navy", "petite", null)).toBeUndefined();
  });

  it("offers only fits that exist for the colour", () => {
    expect(fitsForColor(variants, "navy", ["regular", "petite", "tall"])).toEqual([
      "regular",
      "petite",
    ]);
    expect(fitsForColor(variants, "ivory", ["regular", "petite", "tall"])).toEqual(["regular"]);
  });
});

describe("stock and stores", () => {
  it("messages low and out of stock", () => {
    expect(stockMessage(variants[0])).toEqual({ kind: "in_stock" });
    expect(stockMessage(variants[2])).toEqual({ kind: "low", remaining: 2 });
    expect(stockMessage(variants[1])).toEqual({ kind: "out_of_stock" });
    expect(stockMessage(undefined)).toBeNull();
  });

  it("orders stores by stock", () => {
    expect(storeAvailability(variants[1], ["soho", "austin", "chicago"])).toEqual([
      { storeId: "austin", quantity: 4 },
      { storeId: "chicago", quantity: 0 },
      { storeId: "soho", quantity: 0 },
    ]);
  });
});

describe("estimateDelivery", () => {
  it("counts delivery days in Greater Cairo from a weekday morning", () => {
    // Monday 19 Oct 2026, 10:00
    const { from, to } = estimateDelivery("standard", new Date(2026, 9, 19, 10));
    expect(from.toDateString()).toBe(new Date(2026, 9, 20).toDateString()); // Tue
    expect(to.toDateString()).toBe(new Date(2026, 9, 22).toDateString()); // Thu
  });

  it("takes longer outside Greater Cairo and skips Fridays", () => {
    const { from, to } = estimateDelivery("standard", new Date(2026, 9, 19, 10), "rest_of_egypt");
    expect(from.toDateString()).toBe(new Date(2026, 9, 22).toDateString()); // Thu
    expect(to.toDateString()).toBe(new Date(2026, 9, 25).toDateString()); // Sun, Fri skipped
  });

  it("dispatches next delivery day after the cutoff and on Fridays", () => {
    const thursday = estimateDelivery("express", new Date(2026, 9, 22, 16)); // Thu 16:00 → dispatch Sat
    expect(thursday.from.toDateString()).toBe(new Date(2026, 9, 25).toDateString()); // Sun
    const friday = estimateDelivery("express", new Date(2026, 9, 23, 9));
    expect(friday.from.toDateString()).toBe(new Date(2026, 9, 25).toDateString());
  });
});

describe("review summary", () => {
  it("aggregates ratings, distribution, fit and recommendations", () => {
    const summary = summariseReviews([
      { rating: 5, fit: 0 },
      { rating: 4, fit: -2 },
      { rating: 2 },
      { rating: 5, fit: 0 },
    ]);
    expect(summary).toEqual({
      average: 4,
      count: 4,
      distribution: [0, 1, 0, 1, 2],
      fit: -0.33,
      recommendPercent: 75,
    });
    expect(fitLabel(summary.fit)).toBe("Runs slightly small");
  });

  it("handles products without reviews", () => {
    expect(summariseReviews([])).toMatchObject({ average: 0, count: 0, fit: null });
    expect(fitLabel(null)).toBeNull();
    expect(fitLabel(0.05)).toBe("True to size");
  });
});
