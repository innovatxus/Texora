import { describe, expect, it } from "vitest";
import { applyLoyaltyChange, pointsForOrder, tierFor, tierProgress } from "./tiers";

const thresholds = { enthusiast: 50_000, icon: 150_000 };

describe("tierFor", () => {
  it("assigns tiers at their thresholds", () => {
    expect(tierFor(0, thresholds)).toBe("core");
    expect(tierFor(49_999, thresholds)).toBe("core");
    expect(tierFor(50_000, thresholds)).toBe("enthusiast");
    expect(tierFor(150_000, thresholds)).toBe("icon");
  });
});

describe("pointsForOrder", () => {
  it("earns per whole dollar of merchandise", () => {
    expect(pointsForOrder(12_999, 10, "core")).toBe(1290);
  });

  it("multiplies for higher tiers, rounding down", () => {
    expect(pointsForOrder(10_100, 10, "enthusiast")).toBe(1262);
    expect(pointsForOrder(10_000, 10, "icon")).toBe(1500);
  });

  it("earns nothing on a zero or negative amount", () => {
    expect(pointsForOrder(0, 10, "icon")).toBe(0);
    expect(pointsForOrder(-500, 10, "core")).toBe(0);
  });
});

describe("tierProgress", () => {
  it("measures progress within the current band", () => {
    expect(tierProgress(25_000, thresholds)).toEqual({
      tier: "core",
      next: "enthusiast",
      remaining: 25_000,
      ratio: 0.5,
    });
    expect(tierProgress(100_000, thresholds)).toMatchObject({
      tier: "enthusiast",
      next: "icon",
      remaining: 50_000,
      ratio: 0.5,
    });
  });

  it("is complete at the top tier", () => {
    expect(tierProgress(200_000, thresholds)).toEqual({
      tier: "icon",
      next: null,
      remaining: 0,
      ratio: 1,
    });
  });
});

describe("applyLoyaltyChange", () => {
  it("adds points and can lift the tier", () => {
    expect(
      applyLoyaltyChange(
        { points: 100, periodSpend: 45_000 },
        { points: 100, spend: 10_000 },
        thresholds,
      ),
    ).toEqual({ points: 200, periodSpend: 55_000, tier: "enthusiast" });
  });

  it("reverses a refund without going negative", () => {
    expect(
      applyLoyaltyChange(
        { points: 50, periodSpend: 52_000 },
        { points: -100, spend: -10_000 },
        thresholds,
      ),
    ).toEqual({ points: 0, periodSpend: 42_000, tier: "core" });
  });
});
