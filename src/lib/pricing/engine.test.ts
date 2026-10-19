import {
  audienceMatches,
  checkCode,
  priceOrder,
  selectPromotions,
  type PricingInput,
  type PricingLine,
  type PricingPromotion,
} from "./engine";

const line = (
  sku: string,
  unitPrice: number,
  quantity = 1,
  extra: Partial<PricingLine> = {},
): PricingLine => ({
  sku,
  productId: `p-${sku}`,
  categoryKeys: ["women", "women/dresses"],
  unitPrice,
  quantity,
  ...extra,
});

const promo = (id: string, extra: Partial<PricingPromotion>): PricingPromotion => ({
  id,
  name: id,
  type: "percent",
  value: 10,
  conditions: {},
  automatic: true,
  stackable: false,
  priority: 10,
  audience: "everyone",
  ...extra,
});

const base: Omit<PricingInput, "lines"> = {
  promotions: [],
  customer: { signedIn: false },
  shipping: {
    method: "standard",
    rates: { standard: 800, express: 2000 },
    freeShippingThreshold: 15000,
  },
  taxRate: 0,
};

describe("priceOrder basics", () => {
  it("sums lines and charges standard shipping under the threshold", () => {
    const r = priceOrder({ ...base, lines: [line("a", 4000, 2), line("b", 3000)] });
    expect(r).toMatchObject({
      subtotal: 11000,
      discount: 0,
      shipping: 800,
      total: 11800,
      freeShippingRemaining: 4000,
    });
  });

  it("ships free at the threshold, but express always costs", () => {
    expect(priceOrder({ ...base, lines: [line("a", 15000)] }).shipping).toBe(0);
    expect(
      priceOrder({
        ...base,
        shipping: { ...base.shipping, method: "express" },
        lines: [line("a", 15000)],
      }).shipping,
    ).toBe(2000);
  });

  it("taxes discounted goods plus shipping, rounding to the cent", () => {
    const r = priceOrder({ ...base, taxRate: 0.08875, lines: [line("a", 9999)] });
    expect(r.tax).toBe(Math.round((9999 + 800) * 0.08875));
    expect(r.total).toBe(9999 + 800 + r.tax);
  });

  it("applies gift cards then rewards, never below zero", () => {
    const r = priceOrder({
      ...base,
      lines: [line("a", 16000)],
      giftCardBalance: 10000,
      rewardsValue: 10000,
    });
    expect(r).toMatchObject({ giftCard: 10000, rewards: 6000, total: 0 });
  });

  it("prices an empty bag at zero", () => {
    expect(priceOrder({ ...base, lines: [] })).toMatchObject({
      subtotal: 0,
      shipping: 0,
      total: 0,
    });
  });
});

describe("promotion types", () => {
  it("percent off, excluding sale items when asked", () => {
    const r = priceOrder({
      ...base,
      promotions: [promo("p15", { value: 15, conditions: { excludeSale: true } })],
      lines: [line("full", 10000), line("sale", 6000, 1, { compareAtPrice: 9000 })],
    });
    expect(r.discount).toBe(1500);
    expect(r.lines.find((l) => l.sku === "sale")?.discount).toBe(0);
  });

  it("fixed amount, allocated across lines without losing a cent", () => {
    const r = priceOrder({
      ...base,
      promotions: [promo("f", { type: "fixed", value: 1001 })],
      lines: [line("a", 3333), line("b", 3333), line("c", 3334)],
    });
    expect(r.discount).toBe(1001);
    expect(r.lines.reduce((s, l) => s + l.discount, 0)).toBe(1001);
  });

  it("tiered picks the highest tier reached", () => {
    const tiered = promo("t", {
      type: "tiered",
      value: 0,
      tiers: [
        { minSubtotal: 20000, value: 2500 },
        { minSubtotal: 35000, value: 6000 },
      ],
    });
    expect(priceOrder({ ...base, promotions: [tiered], lines: [line("a", 19999)] }).discount).toBe(
      0,
    );
    expect(priceOrder({ ...base, promotions: [tiered], lines: [line("a", 25000)] }).discount).toBe(
      2500,
    );
    expect(priceOrder({ ...base, promotions: [tiered], lines: [line("a", 40000)] }).discount).toBe(
      6000,
    );
  });

  it("bogo discounts every second eligible unit, cheapest first", () => {
    const bogo = promo("b", {
      type: "bogo",
      value: 50,
      conditions: { categoryKeys: ["women/jeans"] },
    });
    const jeans = { categoryKeys: ["women", "women/jeans"] };
    const r = priceOrder({
      ...base,
      promotions: [bogo],
      lines: [line("j1", 12000, 1, jeans), line("j2", 10000, 2, jeans), line("dress", 20000)],
    });
    // 3 jeans units → 1 discounted: the cheapest (10000) at 50%.
    expect(r.discount).toBe(5000);
    expect(r.lines.find((l) => l.sku === "dress")?.discount).toBe(0);
  });

  it("free shipping promotions zero shipping", () => {
    const r = priceOrder({
      ...base,
      promotions: [promo("fs", { type: "free_shipping", value: 0 })],
      lines: [line("a", 1000)],
    });
    expect(r.shipping).toBe(0);
    expect(r.applied[0]).toMatchObject({ id: "fs", freeShipping: true });
  });

  it("respects minimum subtotals and product conditions", () => {
    const min = promo("m", { conditions: { minSubtotal: 10000 } });
    expect(priceOrder({ ...base, promotions: [min], lines: [line("a", 9000)] }).discount).toBe(0);
    const only = promo("o", { conditions: { productIds: ["p-b"] } });
    expect(
      priceOrder({ ...base, promotions: [only], lines: [line("a", 9000), line("b", 1000)] })
        .discount,
    ).toBe(100);
  });
});

describe("stacking and audiences", () => {
  it("applies all stackable promotions plus the single best non-stackable one", () => {
    const r = priceOrder({
      ...base,
      lines: [line("a", 10000)],
      promotions: [
        promo("ten", { value: 10 }),
        promo("twenty", { value: 20 }),
        promo("ship", { type: "free_shipping", value: 0, stackable: true }),
      ],
    });
    expect(r.applied.map((a) => a.id).sort()).toEqual(["ship", "twenty"]);
    expect(r.discount).toBe(2000);
    expect(r.shipping).toBe(0);
  });

  it("targets promotions by audience", () => {
    expect(audienceMatches("guest", { signedIn: false })).toBe(true);
    expect(audienceMatches("member", { signedIn: true })).toBe(false);
    expect(audienceMatches("member", { signedIn: true, tier: "core" })).toBe(true);
    expect(audienceMatches("icon", { signedIn: true, tier: "enthusiast" })).toBe(false);
    const iconOnly = promo("icon", { audience: "icon" });
    expect(selectPromotions([iconOnly], [], { signedIn: true, tier: "icon" })).toEqual([]);
  });
});

describe("checkCode", () => {
  const lines = [line("a", 10000)];
  it("accepts an eligible code", () => {
    expect(
      checkCode(promo("c", { automatic: false, code: "WELCOME15" }), [], lines, {
        signedIn: false,
      }),
    ).toBeNull();
  });

  it("rejects a second non-stackable code", () => {
    const first = promo("c1", { automatic: false, code: "A" });
    expect(
      checkCode(promo("c2", { automatic: false, code: "B" }), [first], lines, { signedIn: false }),
    ).toBe("not_combinable");
  });

  it("explains when the bag doesn't qualify", () => {
    const big = promo("c", { automatic: false, code: "BIG", conditions: { minSubtotal: 50000 } });
    expect(checkCode(big, [], lines, { signedIn: false })).toBe("not_eligible");
  });
});
