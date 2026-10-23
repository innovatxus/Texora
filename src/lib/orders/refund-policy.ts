import { formatMoney } from "@/lib/format/money";
import type { Order } from "@/lib/validation";

type RefundOrder = Pick<Order, "totals" | "refunds" | "payments" | "status">;

/** Money already refunded on an order (cents). */
export function refundedTotal(order: Pick<Order, "refunds">): number {
  return order.refunds.reduce((sum, r) => sum + r.amount, 0);
}

/** What can still be refunded. */
export function refundableAmount(order: RefundOrder): number {
  return Math.max(0, order.totals.total - refundedTotal(order));
}

export type RefundCheck =
  { ok: true } | { ok: false; code: "conflict" | "limit_exceeded"; message: string };

/**
 * Whether a refund may go ahead: the amount must be positive and within
 * what's left, and staff without `orders.refund_unlimited` may only bring an
 * order's refunds up to the configured limit.
 */
export function checkRefund(
  order: RefundOrder,
  amount: number,
  options: { unlimited: boolean; limit: number },
): RefundCheck {
  if (["pending_payment", "cancelled"].includes(order.status)) {
    return { ok: false, code: "conflict", message: "This order can't be refunded" };
  }
  if (!Number.isInteger(amount) || amount <= 0) {
    return { ok: false, code: "conflict", message: "Enter an amount above zero" };
  }
  if (amount > refundableAmount(order)) {
    return { ok: false, code: "conflict", message: "That's more than is left to refund" };
  }
  if (!options.unlimited && refundedTotal(order) + amount > options.limit) {
    return {
      ok: false,
      code: "limit_exceeded",
      message: `Refunds above ${formatMoney(options.limit)} per order need an admin`,
    };
  }
  return { ok: true };
}

/**
 * How a refund is paid back: card first (up to what was captured and not yet
 * refunded), then gift card, then rewards; anything left (cash on delivery)
 * is paid manually and recorded as such.
 */
export function allocateRefund(
  order: Pick<Order, "payments" | "refunds">,
  amount: number,
): { card: number; giftCard: number; rewards: number; manual: number } {
  const captured = (provider: string) =>
    order.payments
      .filter(
        (p) => p.provider === provider && (p.status === "captured" || p.status === "refunded"),
      )
      .reduce((sum, p) => sum + p.amount, 0);
  let alreadyRefunded = refundedTotal(order);
  let left = amount;
  const take = (available: number) => {
    // Earlier refunds used up sources in the same order.
    const usedBefore = Math.min(available, alreadyRefunded);
    alreadyRefunded -= usedBefore;
    const portion = Math.min(left, available - usedBefore);
    left -= portion;
    return portion;
  };
  const card = take(captured("paymob"));
  const giftCard = take(captured("gift_card"));
  const rewards = take(captured("rewards"));
  return { card, giftCard, rewards, manual: left };
}

/** Status after a refund: fully refunded once nothing is left. */
export function statusAfterRefund(order: RefundOrder, amount: number): Order["status"] {
  return refundedTotal(order) + amount >= order.totals.total ? "refunded" : "partially_refunded";
}
