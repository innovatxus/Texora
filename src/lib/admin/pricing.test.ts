import { describe, expect, it } from "vitest";
import { percentOff, priceRangeFor } from "./pricing";

describe("priceRangeFor", () => {
  it("spans the variant prices", () => {
    expect(priceRangeFor([{ price: 5_000 }, { price: 7_000 }])).toEqual({ min: 5_000, max: 7_000 });
  });

  it("includes compare-at prices only for real markdowns", () => {
    expect(
      priceRangeFor([
        { price: 4_000, compareAtPrice: 6_000 },
        { price: 5_000, compareAtPrice: 5_000 },
        { price: 5_500 },
      ]),
    ).toEqual({ min: 4_000, max: 5_500, compareAtMin: 6_000, compareAtMax: 6_000 });
  });

  it("is zero for a product without variants", () => {
    expect(priceRangeFor([])).toEqual({ min: 0, max: 0 });
  });
});

describe("percentOff", () => {
  it("rounds down and ignores non-markdowns", () => {
    expect(percentOff(6_999, 10_000)).toBe(30);
    expect(percentOff(10_000, 10_000)).toBe(0);
    expect(percentOff(12_000, 10_000)).toBe(0);
  });
});
