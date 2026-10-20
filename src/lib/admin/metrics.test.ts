import { describe, expect, it } from "vitest";
import type { OrderLine } from "@/lib/validation";
import { summariseSales, type MetricsOrder } from "./metrics";

const now = new Date(Date.UTC(2026, 9, 19, 15));
const day = (offset: number) => new Date(now.getTime() - offset * 86_400_000);

const line = (productId: string, quantity: number, lineTotal: number): OrderLine => ({
  sku: `${productId}-m`,
  productId,
  name: productId.toUpperCase(),
  colorName: "Ink",
  size: "M",
  fitFamily: "regular",
  imageUrl: "/x.svg",
  unitPrice: lineTotal / quantity,
  quantity,
  discount: 0,
  lineTotal,
  finalSale: false,
});

const order = (
  status: MetricsOrder["status"],
  offset: number,
  total: number,
  lines: OrderLine[],
  refunds: number[] = [],
): MetricsOrder => ({
  status,
  placedAt: day(offset),
  totals: { subtotal: total, discount: 0, shipping: 0, tax: 0, giftCard: 0, rewards: 0, total },
  lines,
  refunds: refunds.map((amount, i) => ({
    id: `r${i}`,
    amount,
    reason: "",
    by: { uid: "u", role: "admin" },
    at: day(0),
  })),
});

describe("summariseSales", () => {
  const orders = [
    order("placed", 0, 10_000, [line("a", 2, 10_000)]),
    order("delivered", 3, 30_000, [line("b", 1, 30_000)], [5_000]),
    order("cancelled", 1, 99_000, [line("c", 9, 99_000)]),
    order("pending_payment", 1, 50_000, [line("c", 5, 50_000)]),
    order("shipped", 45, 70_000, [line("d", 1, 70_000)]),
  ];
  const summary = summariseSales(orders, now, 30);

  it("counts paid orders in the window, net of refunds", () => {
    expect(summary.orders).toBe(2);
    expect(summary.revenue).toBe(35_000);
    expect(summary.refunded).toBe(5_000);
    expect(summary.averageOrderValue).toBe(17_500);
  });

  it("has one point per day, oldest first, ending today", () => {
    expect(summary.daily).toHaveLength(30);
    expect(summary.daily.at(-1)).toEqual({ date: "2026-10-19", revenue: 10_000, orders: 1 });
    expect(summary.daily.at(-4)).toEqual({ date: "2026-10-16", revenue: 25_000, orders: 1 });
  });

  it("ranks products by units sold", () => {
    expect(summary.topProducts.map((p) => p.productId)).toEqual(["a", "b"]);
  });

  it("is all zeros without orders", () => {
    const empty = summariseSales([], now, 7);
    expect(empty).toMatchObject({ revenue: 0, orders: 0, averageOrderValue: 0 });
    expect(empty.daily).toHaveLength(7);
  });
});
