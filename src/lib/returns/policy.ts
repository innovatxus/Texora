import { deliveredAt } from "@/lib/orders/tracking";
import type { Order, Return } from "@/lib/validation";

/** Items can be returned within this many days of delivery. */
export const RETURN_WINDOW_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Return reasons and their labels, in the order shown on the form. */
export const RETURN_REASONS = [
  { value: "too_small", label: "Too small" },
  { value: "too_large", label: "Too large" },
  { value: "not_as_described", label: "Not as described" },
  { value: "damaged", label: "Arrived damaged or faulty" },
  { value: "changed_mind", label: "Changed my mind" },
  { value: "other", label: "Other" },
] as const satisfies ReadonlyArray<{ value: Return["lines"][number]["reason"]; label: string }>;

type ReturnableOrder = Pick<
  Order,
  "status" | "statusHistory" | "shipments" | "placedAt" | "lines" | "delivery"
>;
type ExistingReturn = Pick<Return, "status" | "lines">;

export interface ReturnableLine {
  sku: string;
  /** Units that can still be returned. */
  available: number;
  /** Why the line can't be returned, when available is 0. */
  blockedBy?: "final_sale" | "already_returned";
}

export type ReturnEligibility =
  | { eligible: true; deadline: Date; lines: ReturnableLine[] }
  | {
      eligible: false;
      reason: "not_shipped" | "cancelled" | "window_closed" | "nothing_returnable";
      deadline?: Date;
    };

/**
 * The return window runs from delivery. Before a delivery is confirmed it
 * runs from the latest estimated delivery date, so a late scan never
 * shortens it.
 */
export function returnDeadline(order: ReturnableOrder): Date {
  const from = deliveredAt(order) ?? order.delivery.estimatedTo;
  return new Date(from.getTime() + RETURN_WINDOW_DAYS * DAY_MS);
}

/** Units of each SKU already on a return that hasn't been denied. */
export function returnedQuantities(returns: readonly ExistingReturn[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const r of returns) {
    if (r.status === "denied") continue;
    for (const l of r.lines) counts.set(l.sku, (counts.get(l.sku) ?? 0) + l.quantity);
  }
  return counts;
}

/** Which items in an order can still be returned, and until when. */
export function returnEligibility(
  order: ReturnableOrder,
  returns: readonly ExistingReturn[],
  now: Date,
): ReturnEligibility {
  if (order.status === "cancelled" || order.status === "refunded") {
    return { eligible: false, reason: "cancelled" };
  }
  if (!["partially_shipped", "shipped", "delivered", "partially_refunded"].includes(order.status)) {
    return { eligible: false, reason: "not_shipped" };
  }
  const deadline = returnDeadline(order);
  if (now.getTime() > deadline.getTime()) {
    return { eligible: false, reason: "window_closed", deadline };
  }

  const returned = returnedQuantities(returns);
  const lines: ReturnableLine[] = order.lines.map((line) => {
    if (line.finalSale) return { sku: line.sku, available: 0, blockedBy: "final_sale" };
    const available = Math.max(0, line.quantity - (returned.get(line.sku) ?? 0));
    return available > 0
      ? { sku: line.sku, available }
      : { sku: line.sku, available: 0, blockedBy: "already_returned" };
  });
  if (lines.every((l) => l.available === 0)) {
    return { eligible: false, reason: "nothing_returnable", deadline };
  }
  return { eligible: true, deadline, lines };
}

/**
 * Refund for returned units: what the customer actually paid per unit
 * (after discounts), rounded down so a set of partial returns never
 * exceeds the line total. Shipping is not refunded.
 */
export function refundEstimate(
  order: Pick<Order, "lines">,
  items: ReadonlyArray<{ sku: string; quantity: number }>,
): number {
  return items.reduce((sum, item) => {
    const line = order.lines.find((l) => l.sku === item.sku);
    if (!line) return sum;
    return sum + Math.floor((line.lineTotal * item.quantity) / line.quantity);
  }, 0);
}

/** Customer-facing wording for each return status. */
export const RETURN_STATUS_LABELS: Record<Return["status"], string> = {
  requested: "Requested",
  approved: "Ready to send",
  denied: "Not accepted",
  in_transit: "On its way to us",
  received: "Received",
  inspected: "Checked",
  refunded: "Refunded",
  closed: "Closed",
};

/** Why an order can't be returned, in customer-facing words. */
export const INELIGIBLE_MESSAGES: Record<
  Extract<ReturnEligibility, { eligible: false }>["reason"],
  string
> = {
  not_shipped: "You can start a return once your order has shipped.",
  cancelled: "This order was cancelled, so there's nothing to return.",
  window_closed: `The ${RETURN_WINDOW_DAYS}-day return window for this order has closed.`,
  nothing_returnable: "Everything in this order has been returned or is final sale.",
};

const RETURN_STEPS = [
  { key: "approved", label: "Return started", statuses: ["requested", "approved"] },
  { key: "in_transit", label: "On its way to us", statuses: ["in_transit"] },
  { key: "received", label: "Received and checked", statuses: ["received", "inspected"] },
  { key: "refunded", label: "Refunded", statuses: ["refunded", "closed"] },
] as const;

/** Customer-facing progress of a return (denied returns have none). */
export function returnTimeline(
  record: Pick<Return, "status" | "statusHistory">,
): Array<{ key: string; label: string; state: "done" | "current" | "upcoming"; at?: Date }> {
  const progress = RETURN_STEPS.findIndex((s) =>
    (s.statuses as readonly string[]).includes(record.status),
  );
  return RETURN_STEPS.map((step, i) => {
    const at = record.statusHistory.find((h) =>
      (step.statuses as readonly string[]).includes(h.status),
    )?.at;
    const state =
      i < progress || (i === progress && i === RETURN_STEPS.length - 1)
        ? "done"
        : i === progress
          ? "current"
          : "upcoming";
    return { key: step.key, label: step.label, state, ...(at && i <= progress ? { at } : {}) };
  });
}
