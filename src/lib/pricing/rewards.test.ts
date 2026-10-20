import { pointsFor, redemptionOptions } from "./rewards";
import { DEFAULT_TAX_RATE, taxRateFor } from "./tax";

describe("rewards", () => {
  it("offers $5 steps the balance can cover", () => {
    expect(redemptionOptions(2350)).toEqual([500, 1000, 1500, 2000]);
    expect(redemptionOptions(499)).toEqual([]);
    expect(redemptionOptions(100000, 3)).toEqual([500, 1000, 1500]);
  });

  it("converts value to points", () => {
    expect(pointsFor(1500)).toBe(1500);
  });
});

describe("tax", () => {
  it("uses state rates, zero-tax states and a default", () => {
    expect(taxRateFor("ny")).toBeCloseTo(0.0853);
    expect(taxRateFor("OR")).toBe(0);
    expect(taxRateFor(undefined)).toBe(DEFAULT_TAX_RATE);
    expect(taxRateFor("ZZ")).toBe(DEFAULT_TAX_RATE);
  });
});
