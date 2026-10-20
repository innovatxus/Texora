import { describe, expect, it } from "vitest";
import type { Order } from "@/lib/validation";
import { allocateRefund, checkRefund, refundableAmount, statusAfterRefund } from "./refund-policy";

const by = { uid: "u", role: "customer_service" as const };
const order = (
  payments: Order["payments"],
  refunds: number[] = [],
  status: Order["status"] = "delivered",
  total = 30_000,
) => ({
  status,
  totals: { subtotal: total, discount: 0, shipping: 0, tax: 0, giftCard: 0, rewards: 0, total },
  payments,
  refunds: refunds.map((amount, i) => ({ id: `r${i}`, amount, reason: "", by, at: new Date() })),
});

const card = (amount: number) =>
  ({ provider: "stripe", ref: "pi", amount, status: "captured" }) as const;
const gift = (amount: number) =>
  ({ provider: "gift_card", ref: "gc", amount, status: "captured" }) as const;

describe("checkRefund", () => {
  const limits = { unlimited: false, limit: 25_000 };

  it("allows refunds within the limit and what's left", () => {
    expect(checkRefund(order([card(30_000)]), 10_000, limits)).toEqual({ ok: true });
  });

  it("counts earlier refunds toward the agent's limit", () => {
    expect(checkRefund(order([card(30_000)], [20_000]), 6_000, limits)).toMatchObject({
      ok: false,
      code: "limit_exceeded",
    });
  });

  it("lets unlimited roles go past the limit", () => {
    expect(
      checkRefund(order([card(30_000)], [20_000]), 10_000, { unlimited: true, limit: 25_000 }),
    ).toEqual({ ok: true });
  });

  it("never refunds more than was paid", () => {
    expect(
      checkRefund(order([card(30_000)], [25_000]), 6_000, { unlimited: true, limit: 0 }),
    ).toMatchObject({ ok: false, code: "conflict" });
  });

  it("rejects zero, fractions and unpaid or cancelled orders", () => {
    expect(checkRefund(order([card(30_000)]), 0, limits).ok).toBe(false);
    expect(checkRefund(order([card(30_000)]), 10.5, limits).ok).toBe(false);
    expect(checkRefund(order([], [], "pending_payment"), 100, limits).ok).toBe(false);
  });
});

describe("allocateRefund", () => {
  it("refunds the card first, then the gift card", () => {
    expect(allocateRefund(order([card(20_000), gift(10_000)]), 25_000)).toEqual({
      card: 20_000,
      giftCard: 5_000,
      rewards: 0,
      manual: 0,
    });
  });

  it("skips sources used by earlier refunds", () => {
    expect(allocateRefund(order([card(20_000), gift(10_000)], [20_000]), 5_000)).toEqual({
      card: 0,
      giftCard: 5_000,
      rewards: 0,
      manual: 0,
    });
  });

  it("marks cash on delivery as a manual refund", () => {
    const cod = { provider: "cod", ref: "TX", amount: 30_000, status: "captured" } as const;
    expect(allocateRefund(order([cod]), 30_000)).toMatchObject({ card: 0, manual: 30_000 });
  });
});

describe("refundableAmount and statusAfterRefund", () => {
  it("tracks partial and full refunds", () => {
    const o = order([card(30_000)], [10_000]);
    expect(refundableAmount(o)).toBe(20_000);
    expect(statusAfterRefund(o, 5_000)).toBe("partially_refunded");
    expect(statusAfterRefund(o, 20_000)).toBe("refunded");
  });
});
