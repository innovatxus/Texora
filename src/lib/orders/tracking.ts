import type { Order, OrderStatus } from "@/lib/validation";

export type TrackingStepKey = "placed" | "processing" | "shipped" | "delivered";

export interface TrackingStep {
  key: TrackingStepKey;
  label: string;
  state: "done" | "current" | "upcoming";
  at?: Date;
}

type TrackableOrder = Pick<Order, "status" | "statusHistory" | "shipments" | "placedAt">;

const STEPS: ReadonlyArray<{ key: TrackingStepKey; label: string }> = [
  { key: "placed", label: "Order placed" },
  { key: "processing", label: "Preparing" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
];

/** How far along the four customer-facing steps each status is (−1: not started). */
const PROGRESS: Record<OrderStatus, number> = {
  pending_payment: -1,
  placed: 0,
  processing: 1,
  partially_shipped: 2,
  shipped: 2,
  delivered: 3,
  cancelled: -1,
  partially_refunded: 3,
  refunded: 3,
};

/** Customer-facing wording for each order status. */
export const STATUS_LABELS: Record<OrderStatus, string> = {
  pending_payment: "Awaiting payment",
  placed: "Order placed",
  processing: "Preparing your order",
  partially_shipped: "Partly shipped",
  shipped: "On its way",
  delivered: "Delivered",
  cancelled: "Cancelled",
  partially_refunded: "Partly refunded",
  refunded: "Refunded",
};

function firstAt(order: TrackableOrder, statuses: readonly OrderStatus[]): Date | undefined {
  return order.statusHistory.find((h) => statuses.includes(h.status))?.at;
}

function earliest(dates: Array<Date | undefined>): Date | undefined {
  return dates
    .filter((d): d is Date => d instanceof Date)
    .sort((a, b) => a.getTime() - b.getTime())[0];
}

/** When the whole order arrived: the last shipment delivered, or the "delivered" status time. */
export function deliveredAt(order: TrackableOrder): Date | undefined {
  const shipments = order.shipments;
  if (shipments.length > 0 && shipments.every((s) => s.deliveredAt)) {
    return shipments.map((s) => s.deliveredAt as Date).sort((a, b) => b.getTime() - a.getTime())[0];
  }
  return firstAt(order, ["delivered"]);
}

/**
 * The customer-facing progress of an order. Steps are completed from the
 * status history and shipments, so a skipped status (e.g. straight from
 * placed to shipped) still shows the earlier steps as done.
 */
export function trackingTimeline(order: TrackableOrder): TrackingStep[] {
  const progress = PROGRESS[order.status];
  const at: Record<TrackingStepKey, Date | undefined> = {
    placed: firstAt(order, ["placed"]) ?? (progress >= 0 ? order.placedAt : undefined),
    processing: firstAt(order, ["processing"]),
    shipped: earliest([
      firstAt(order, ["partially_shipped", "shipped"]),
      ...order.shipments.map((s) => s.shippedAt),
    ]),
    delivered: deliveredAt(order),
  };
  return STEPS.map((step, i) => ({
    ...step,
    state: i < progress ? "done" : i === progress ? (i === 3 ? "done" : "current") : "upcoming",
    ...(i <= progress && at[step.key] ? { at: at[step.key] } : {}),
  }));
}

/** Cancelled and unpaid orders have no delivery progress to show. */
export function isTrackable(status: OrderStatus): boolean {
  return PROGRESS[status] >= 0;
}
