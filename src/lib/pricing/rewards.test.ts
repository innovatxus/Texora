import { pointsFor, redemptionOptions } from "./rewards";
import { DEFAULT_TAX_RATE, taxRateFor } from "./tax";

describe("rewards", () => {
  it("offers EGP 50 steps the balance can cover", () => {
    expect(redemptionOptions(2350)).toEqual([5000, 10000, 15000, 20000]);
    expect(redemptionOptions(499)).toEqual([]);
    expect(redemptionOptions(100000, 3)).toEqual([5000, 10000, 15000]);
  });

  it("converts value to points", () => {
    expect(pointsFor(5000)).toBe(500);
  });
});

describe("tax", () => {
  it("applies 14% VAT in every governorate", () => {
    expect(taxRateFor("C")).toBe(0.14);
    expect(taxRateFor("ASN")).toBe(0.14);
    expect(taxRateFor(undefined)).toBe(DEFAULT_TAX_RATE);
  });
});
