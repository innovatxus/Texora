import { describe, expect, it } from "vitest";
import { addDays, businessDate, GIFT_CARD_CODE_PATTERN } from "./codes";
import { generateGiftCardCode } from "./generate";

describe("generateGiftCardCode", () => {
  it("produces readable codes without ambiguous characters", () => {
    for (let i = 0; i < 50; i += 1) {
      const code = generateGiftCardCode();
      expect(code).toMatch(GIFT_CARD_CODE_PATTERN);
      expect(code.slice(5)).not.toMatch(/[01OI]/);
    }
  });

  it("does not repeat", () => {
    const codes = new Set(Array.from({ length: 200 }, generateGiftCardCode));
    expect(codes.size).toBe(200);
  });
});

describe("businessDate", () => {
  it("uses New York's calendar date", () => {
    // 02:00 UTC on the 20th is still the 19th in New York.
    expect(businessDate(new Date(Date.UTC(2026, 9, 20, 2)))).toBe("2026-10-19");
    expect(businessDate(new Date(Date.UTC(2026, 9, 20, 12)))).toBe("2026-10-20");
  });
});

describe("addDays", () => {
  it("crosses month ends", () => {
    expect(addDays("2026-10-30", 3)).toBe("2026-11-02");
    expect(addDays("2026-10-19", 0)).toBe("2026-10-19");
  });
});
