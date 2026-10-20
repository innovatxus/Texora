import { describe, expect, it } from "vitest";
import { deliveredAt, isTrackable, trackingTimeline } from "./tracking";

const day = (n: number) => new Date(Date.UTC(2026, 9, n, 12));

const base = {
  status: "placed" as const,
  placedAt: day(1),
  statusHistory: [{ status: "placed" as const, at: day(1) }],
  shipments: [],
};

const states = (order: Parameters<typeof trackingTimeline>[0]) =>
  trackingTimeline(order).map((s) => s.state);

describe("trackingTimeline", () => {
  it("marks a new order as placed with the rest upcoming", () => {
    const steps = trackingTimeline(base);
    expect(steps.map((s) => s.state)).toEqual(["current", "upcoming", "upcoming", "upcoming"]);
    expect(steps[0]?.at).toEqual(day(1));
    expect(steps[1]?.at).toBeUndefined();
  });

  it("completes skipped steps and dates the shipment", () => {
    const steps = trackingTimeline({
      ...base,
      status: "shipped",
      statusHistory: [...base.statusHistory, { status: "shipped", at: day(3) }],
      shipments: [
        {
          id: "s1",
          carrier: "UPS",
          trackingNumber: "1Z",
          skus: ["a"],
          status: "in_transit",
          shippedAt: day(2),
        },
      ],
    });
    expect(steps.map((s) => s.state)).toEqual(["done", "done", "current", "upcoming"]);
    // The earliest evidence of shipping wins.
    expect(steps[2]?.at).toEqual(day(2));
  });

  it("shows every step done once delivered", () => {
    expect(
      states({
        ...base,
        status: "delivered",
        statusHistory: [...base.statusHistory, { status: "delivered", at: day(5) }],
      }),
    ).toEqual(["done", "done", "done", "done"]);
  });

  it("keeps delivery progress after a partial refund", () => {
    expect(states({ ...base, status: "partially_refunded" })).toEqual([
      "done",
      "done",
      "done",
      "done",
    ]);
  });

  it("has nothing to track for cancelled or unpaid orders", () => {
    expect(isTrackable("cancelled")).toBe(false);
    expect(isTrackable("pending_payment")).toBe(false);
    expect(states({ ...base, status: "cancelled" })).toEqual([
      "upcoming",
      "upcoming",
      "upcoming",
      "upcoming",
    ]);
  });
});

describe("deliveredAt", () => {
  const shipment = (deliveredOn?: number) => ({
    id: `s${deliveredOn ?? 0}`,
    carrier: "UPS",
    trackingNumber: "1Z",
    skus: [],
    status: "delivered" as const,
    ...(deliveredOn ? { deliveredAt: day(deliveredOn) } : {}),
  });

  it("uses the last shipment to arrive", () => {
    expect(deliveredAt({ ...base, shipments: [shipment(4), shipment(6)] })).toEqual(day(6));
  });

  it("falls back to the delivered status while a shipment is still out", () => {
    expect(
      deliveredAt({
        ...base,
        shipments: [shipment(4), shipment()],
        statusHistory: [{ status: "delivered", at: day(7) }],
      }),
    ).toEqual(day(7));
  });
});
