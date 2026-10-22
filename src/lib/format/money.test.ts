import { centsToInput, formatMoney, parseDollars, percentOff } from "./money";

describe("formatMoney", () => {
  it("formats cents as currency", () => {
    expect(formatMoney(12800)).toBe("$128.00");
    expect(formatMoney(8960)).toBe("$89.60");
    expect(formatMoney(0)).toBe("$0.00");
    expect(formatMoney(123456)).toBe("$1,234.56");
  });
});

describe("percentOff", () => {
  it("rounds to a whole percentage", () => {
    expect(percentOff(6900, 9800)).toBe(30);
    expect(percentOff(8960, 12800)).toBe(30);
  });

  it("is zero when there is no saving", () => {
    expect(percentOff(9800, 9800)).toBe(0);
    expect(percentOff(9900, 9800)).toBe(0);
    expect(percentOff(100, 0)).toBe(0);
  });
});

describe("parseDollars", () => {
  it.each([
    ["148", 14800],
    ["148.5", 14850],
    ["148.05", 14805],
    ["$1,048.00", 104800],
    [" 0.99 ", 99],
  ])("%s → %s cents", (input, cents) => {
    expect(parseDollars(input)).toBe(cents);
  });

  it.each(["", "abc", "-5", "1.234", "1.2.3"])("rejects %s", (input) => {
    expect(parseDollars(input)).toBeNull();
  });

  it("formats cents for inputs", () => {
    expect(centsToInput(14800)).toBe("148.00");
    expect(centsToInput(null)).toBe("");
  });
});
