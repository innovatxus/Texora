/**
 * A merchant's view of an order: only their own lines, their part's status
 * and total, and the ship-to address; never payment details or other
 * merchants' items. Pure, so the scoping is unit tested.
 */
import type { Order, OrderLine } from "@/lib/validation/commerce";

export type MerchantOrderStatus =
  "to_ship" | "partly_shipped" | "shipped" | "delivered" | "cancelled";

export const MERCHANT_ORDER_STATUS_LABELS: Readonly<Record<MerchantOrderStatus, string>> = {
  to_ship: "To ship",
  partly_shipped: "Partly shipped",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export interface MerchantOrderView {
  id: string;
  number: string;
  placedAt: Date;
  status: MerchantOrderStatus;
  lines: OrderLine[];
  items: number;
  /** Sum of the merchant's line totals (after discounts), in cents. */
  total: number;
  shippingAddress: Order["shippingAddress"];
  deliveryMethod: Order["delivery"]["method"];
  /** Parcels holding any of the merchant's items. */
  shipments: Order["shipments"];
  /** The merchant's SKUs not yet in a parcel. */
  unshipped: string[];
}

/** The merchant's part of an order, or null when none of its lines are theirs. */
export function merchantOrderView(order: Order, vendorId: string): MerchantOrderView | null {
  const lines = order.lines.filter((l) => l.vendorId === vendorId);
  if (lines.length === 0) return null;
  const own = new Set(lines.map((l) => l.sku));
  const shipments = order.shipments.filter((s) => s.skus.some((sku) => own.has(sku)));
  const shippedSkus = new Set(shipments.flatMap((s) => s.skus));
  const unshipped = lines.map((l) => l.sku).filter((sku) => !shippedSkus.has(sku));

  let status: MerchantOrderStatus;
  if (order.status === "cancelled" || order.status === "refunded") status = "cancelled";
  else if (unshipped.length === lines.length) status = "to_ship";
  else if (unshipped.length > 0) status = "partly_shipped";
  else status = shipments.every((s) => s.status === "delivered") ? "delivered" : "shipped";

  return {
    id: order.id,
    number: order.number,
    placedAt: order.placedAt,
    status,
    lines,
    items: lines.reduce((n, l) => n + l.quantity, 0),
    total: lines.reduce((sum, l) => sum + l.lineTotal, 0),
    shippingAddress: order.shippingAddress,
    deliveryMethod: order.delivery.method,
    shipments,
    unshipped,
  };
}

/** The order status once a merchant's parcel is added: shipped when every line is in a parcel. */
export function statusAfterShipment(
  order: Pick<Order, "lines" | "shipments">,
  newSkus: readonly string[],
): "shipped" | "partially_shipped" {
  const shipped = new Set([...order.shipments.flatMap((s) => s.skus), ...newSkus]);
  return order.lines.every((l) => shipped.has(l.sku)) ? "shipped" : "partially_shipped";
}
