import { describe, expect, it } from "vitest";
import type { OrderLine } from "@/lib/validation";
import {
  refundEstimate,
  returnDeadline,
  returnEligibility,
  returnedQuantities,
  returnTimeline,
} from "./policy";

const day = (n: number) => new Date(Date.UTC(2026, 9, 1, 12) + n * 86_400_000);

const line = (sku: string, quantity: number, lineTotal: number, finalSale = false): OrderLine => ({
  sku,
  productId: `p-${sku}`,
  name: sku,
  colorName: "Ink",
  size: "M",
  fitFamily: "regular",
  imageUrl: "/x.svg",
  unitPrice: lineTotal / quantity,
  quantity,
  discount: 0,
  lineTotal,
  finalSale,
});

const delivered = {
  status: "delivered" as const,
  placedAt: day(0),
  statusHistory: [
    { status: "placed" as const, at: day(0) },
    { status: "delivered" as const, at: day(4) },
  ],
  shipments: [],
  delivery: { method: "standard" as const, cost: 0, estimatedFrom: day(3), estimatedTo: day(6) },
  lines: [line("a", 2, 10000), line("b", 1, 4999), line("c", 1, 2500, true)],
};

describe("returnDeadline", () => {
  it("runs 14 days from delivery", () => {
    expect(returnDeadline(delivered)).toEqual(day(18));
  });

  it("runs from the latest estimate before delivery is confirmed", () => {
    expect(returnDeadline({ ...delivered, status: "shipped", statusHistory: [] })).toEqual(day(20));
  });
});

describe("returnEligibility", () => {
  it("offers every non-final-sale unit inside the window", () => {
    const result = returnEligibility(delivered, [], day(10));
    expect(result).toMatchObject({
      eligible: true,
      lines: [
        { sku: "a", available: 2 },
        { sku: "b", available: 1 },
        { sku: "c", available: 0, blockedBy: "final_sale" },
      ],
    });
  });

  it("subtracts units already on a return, ignoring denied ones", () => {
    const result = returnEligibility(
      delivered,
      [
        { status: "approved", lines: [{ sku: "a", quantity: 1, reason: "too_small" }] },
        { status: "denied", lines: [{ sku: "b", quantity: 1, reason: "other" }] },
      ],
      day(10),
    );
    expect(result.eligible && result.lines.map((l) => l.available)).toEqual([1, 1, 0]);
  });

  it("closes after the window", () => {
    expect(returnEligibility(delivered, [], day(19))).toMatchObject({
      eligible: false,
      reason: "window_closed",
    });
  });

  it("waits until the order has shipped", () => {
    expect(returnEligibility({ ...delivered, status: "processing" }, [], day(1))).toMatchObject({
      eligible: false,
      reason: "not_shipped",
    });
  });

  it("refuses cancelled orders", () => {
    expect(returnEligibility({ ...delivered, status: "cancelled" }, [], day(1))).toMatchObject({
      eligible: false,
      reason: "cancelled",
    });
  });

  it("reports when everything has already been returned", () => {
    const all = [
      {
        status: "refunded" as const,
        lines: [
          { sku: "a", quantity: 2, reason: "too_small" as const },
          { sku: "b", quantity: 1, reason: "other" as const },
        ],
      },
    ];
    expect(returnEligibility(delivered, all, day(10))).toMatchObject({
      eligible: false,
      reason: "nothing_returnable",
    });
  });
});

describe("returnedQuantities", () => {
  it("sums across returns", () => {
    const counts = returnedQuantities([
      { status: "requested", lines: [{ sku: "a", quantity: 1, reason: "other" }] },
      { status: "received", lines: [{ sku: "a", quantity: 1, reason: "other" }] },
    ]);
    expect(counts.get("a")).toBe(2);
  });
});

describe("refundEstimate", () => {
  it("refunds the discounted unit price, never more than the line", () => {
    const order = { lines: [line("a", 3, 10000)] };
    expect(refundEstimate(order, [{ sku: "a", quantity: 1 }])).toBe(3333);
    expect(refundEstimate(order, [{ sku: "a", quantity: 3 }])).toBe(10000);
  });

  it("ignores unknown SKUs", () => {
    expect(refundEstimate({ lines: [] }, [{ sku: "zz", quantity: 1 }])).toBe(0);
  });
});

describe("returnTimeline", () => {
  it("starts with the return approved", () => {
    const steps = returnTimeline({
      status: "approved",
      statusHistory: [
        { status: "requested", at: day(1) },
        { status: "approved", at: day(1) },
      ],
    });
    expect(steps.map((s) => s.state)).toEqual(["current", "upcoming", "upcoming", "upcoming"]);
    expect(steps[0]?.at).toEqual(day(1));
  });

  it("completes every step once refunded", () => {
    const steps = returnTimeline({ status: "refunded", statusHistory: [] });
    expect(steps.map((s) => s.state)).toEqual(["done", "done", "done", "done"]);
  });

  it("treats inspection as part of receiving", () => {
    expect(returnTimeline({ status: "inspected", statusHistory: [] })[2]?.state).toBe("current");
  });
});
