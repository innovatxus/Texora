import { compareSizes } from "./sizes";

const sorted = (sizes: string[]) => [...sizes].sort(compareSizes);

describe("compareSizes", () => {
  it("orders alpha sizes by the size run", () => {
    expect(sorted(["L", "M", "S", "XL", "XS", "XXL", "XXS"])).toEqual([
      "XXS",
      "XS",
      "S",
      "M",
      "L",
      "XL",
      "XXL",
    ]);
  });

  it("orders numeric sizes with 00 first", () => {
    expect(sorted(["10", "2", "00", "0", "16", "4"])).toEqual(["00", "0", "2", "4", "10", "16"]);
  });

  it("orders waist × inseam by waist then inseam", () => {
    expect(sorted(["30x32", "28x32", "30x30", "28x30", "36x30"])).toEqual([
      "28x30",
      "28x32",
      "30x30",
      "30x32",
      "36x30",
    ]);
  });
});
