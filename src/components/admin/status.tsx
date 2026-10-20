import { STATUS_LABELS } from "@/lib/orders/tracking";
import { RETURN_STATUS_LABELS } from "@/lib/returns/policy";
import type { OrderStatus, Return } from "@/lib/validation";
import { StatusPill } from "./ui";

const ORDER_TONES: Record<OrderStatus, "neutral" | "success" | "warning" | "danger"> = {
  pending_payment: "warning",
  placed: "neutral",
  processing: "neutral",
  partially_shipped: "warning",
  shipped: "success",
  delivered: "success",
  cancelled: "danger",
  partially_refunded: "warning",
  refunded: "danger",
};

/** Order status as a coloured pill. */
export function OrderStatusPill({ status }: { status: OrderStatus }) {
  return <StatusPill tone={ORDER_TONES[status]}>{STATUS_LABELS[status]}</StatusPill>;
}

const RETURN_TONES: Record<Return["status"], "neutral" | "success" | "warning" | "danger"> = {
  requested: "warning",
  approved: "neutral",
  denied: "danger",
  in_transit: "neutral",
  received: "warning",
  inspected: "warning",
  refunded: "success",
  closed: "neutral",
};

/** Return status as a coloured pill (staff wording). */
export function ReturnStatusPill({ status }: { status: Return["status"] }) {
  return (
    <StatusPill tone={RETURN_TONES[status]}>
      {status === "approved" ? "Approved" : RETURN_STATUS_LABELS[status]}
    </StatusPill>
  );
}

const dateTime = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
const dateOnly = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

/** "Oct 19, 3:04 PM" in the server's time zone. */
export const formatDateTime = (d: Date) => dateTime.format(d);
/** "Oct 19, 2026". */
export const formatDate = (d: Date) => dateOnly.format(d);
