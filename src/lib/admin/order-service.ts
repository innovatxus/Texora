import "server-only";
import { randomUUID } from "node:crypto";
import { FieldPath, FieldValue } from "firebase-admin/firestore";
import { ActionError } from "@/lib/actions/run-action";
import { writeAuditLog } from "@/lib/audit/log";
import { hasPermission } from "@/lib/auth/rbac";
import type { Session } from "@/lib/auth/session";
import { getStoreSettings } from "@/lib/data/admin-records";
import { parseSnapshot } from "@/lib/data/firestore";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { applyLoyaltyChange } from "@/lib/loyalty/tiers";
import { allocateRefund, checkRefund, statusAfterRefund } from "@/lib/orders/refund-policy";
import { cardPaymentsEnabled, stripeProvider } from "@/lib/payments/provider";
import { pointsFor } from "@/lib/pricing/rewards";
import { ONLINE_LOCATION, orderSchema, type Order } from "@/lib/validation";
import { invalidate } from "./revalidate";
import { logger } from "@/lib/observability/logger";

const actorOf = (s: Session) => ({ uid: s.uid, role: s.role });
const orders = () => getFirebaseAdmin().db.collection("orders");

async function loadOrder(orderId: string): Promise<Order> {
  const order = parseSnapshot(orderSchema, await orders().doc(orderId).get());
  if (!order) throw new ActionError("not_found", "Order not found");
  return order;
}

/**
 * Refunds part or all of an order. Card money goes back through the
 * payment provider first (outside the transaction, with an idempotency key);
 * the transaction then re-checks the amount, restores gift card and rewards
 * balances, reverses earned loyalty points proportionally, records the
 * refund and writes the audit log.
 */
export async function refundOrder(
  actor: Session,
  orderId: string,
  amount: number,
  reason: string,
  options: {
    bypassLimit?: boolean;
    refundId?: string;
    /** Paid as store credit (a gift card issued by the caller), not back to the payment. */
    storeCredit?: boolean;
  } = {},
): Promise<{ refundId: string; manual: number }> {
  const { db } = getFirebaseAdmin();
  const settings = await getStoreSettings();
  const limits = {
    unlimited: options.bypassLimit === true || hasPermission(actor.role, "orders.refund_unlimited"),
    limit: settings.refundLimits.customer_service,
  };
  const order = await loadOrder(orderId);
  const check = checkRefund(order, amount, limits);
  if (!check.ok) throw new ActionError(check.code, check.message);

  const refundId = options.refundId ?? randomUUID();
  const split = options.storeCredit
    ? { card: 0, giftCard: 0, rewards: 0, manual: 0 }
    : allocateRefund(order, amount);
  let cardRef: string | null = null;
  if (split.card > 0) {
    const intent = order.payments.find((p) => p.provider === "stripe" && p.status !== "failed");
    if (!intent || !cardPaymentsEnabled()) {
      throw new ActionError("conflict", "Card refunds are unavailable right now");
    }
    cardRef = (await stripeProvider.refund({ ref: intent.ref, amount: split.card })).ref;
  }

  const now = new Date();
  await db.runTransaction(async (tx) => {
    const ref = orders().doc(orderId);
    const fresh = parseSnapshot(orderSchema, await tx.get(ref));
    if (!fresh) throw new ActionError("not_found", "Order not found");
    if (fresh.refunds.some((r) => r.id === refundId)) return; // Already recorded.
    const recheck = checkRefund(fresh, amount, limits);
    if (!recheck.ok) throw new ActionError(recheck.code, recheck.message);

    // Reads before writes.
    const giftPayment = fresh.payments.find((p) => p.provider === "gift_card");
    const giftCardSnap =
      split.giftCard > 0 && giftPayment
        ? await tx.get(
            db
              .collection("giftCards")
              .where(FieldPath.documentId(), ">=", giftPayment.ref)
              .where(FieldPath.documentId(), "<", `${giftPayment.ref}`)
              .limit(1),
          )
        : null;
    const userRef = fresh.userId ? db.collection("users").doc(fresh.userId) : null;
    const user = userRef ? await tx.get(userRef) : null;

    const giftCardDoc = giftCardSnap?.docs[0];
    if (giftCardDoc) {
      tx.update(giftCardDoc.ref, {
        balance: FieldValue.increment(split.giftCard),
        status: "active",
      });
    }
    const loyalty = user?.get("loyalty") as { points: number; periodSpend: number } | undefined;
    if (userRef && loyalty) {
      // Give back redeemed rewards; take back points earned on the refunded share.
      const share = amount / fresh.totals.total;
      const earnedBack = fresh.loyaltyCreditedAt
        ? Math.round(fresh.loyaltyPointsEarned * share)
        : 0;
      const spendBack = fresh.loyaltyCreditedAt
        ? Math.round((fresh.totals.subtotal - fresh.totals.discount) * share)
        : 0;
      const next = applyLoyaltyChange(
        loyalty,
        { points: pointsFor(split.rewards) - earnedBack, spend: -spendBack },
        settings.loyalty.tierThresholds,
      );
      if (split.rewards > 0 || earnedBack > 0) {
        tx.update(userRef, {
          "loyalty.points": next.points,
          "loyalty.periodSpend": next.periodSpend,
          "loyalty.tier": next.tier,
        });
        tx.create(userRef.collection("loyaltyLedger").doc(), {
          type: "refund",
          points: pointsFor(split.rewards) - earnedBack,
          orderId,
          orderNumber: fresh.number,
          balance: next.points,
          at: now,
        });
      }
    }

    const status = statusAfterRefund(fresh, amount);
    tx.update(ref, {
      refunds: FieldValue.arrayUnion({
        id: refundId,
        amount,
        reason,
        by: actorOf(actor),
        at: now,
        ...(cardRef ? { providerRef: cardRef } : {}),
        ...(split.manual > 0 ? { manual: split.manual } : {}),
        ...(options.storeCredit ? { storeCredit: true } : {}),
      }),
      status,
      statusHistory: FieldValue.arrayUnion({ status, at: now, by: actorOf(actor), note: reason }),
      updatedAt: now,
    });
    await writeAuditLog(
      {
        actor,
        action: "orders.refund",
        target: { type: "order", id: orderId },
        before: { status: fresh.status, refunded: fresh.refunds.reduce((s, r) => s + r.amount, 0) },
        after: { status, refundAmount: amount, split, reason },
      },
      tx,
    );
  });
  // Refunds happen in the back office, so the analytics event is server-side (no personal data).
  logger.info("analytics.refund", {
    transaction_id: order.number,
    currency: "USD",
    value: amount / 100,
  });
  return { refundId, manual: split.manual };
}

const CANCELLABLE = new Set<Order["status"]>(["pending_payment", "placed", "processing"]);

/**
 * Cancels an order that hasn't shipped: refunds anything already collected,
 * puts the stock back (and drops unpaid reservations) and records why.
 */
export async function cancelOrder(actor: Session, orderId: string, reason: string): Promise<void> {
  const { db } = getFirebaseAdmin();
  const order = await loadOrder(orderId);
  if (!CANCELLABLE.has(order.status)) {
    throw new ActionError("conflict", "Only orders that haven't shipped can be cancelled");
  }
  const collected = order.payments
    .filter((p) => p.status === "captured")
    .reduce((sum, p) => sum + p.amount, 0);
  if (collected > 0 && order.status !== "pending_payment") {
    await refundOrder(actor, orderId, collected, `Cancelled: ${reason}`, { bypassLimit: true });
  }

  const now = new Date();
  await db.runTransaction(async (tx) => {
    const ref = orders().doc(orderId);
    const snap = await tx.get(ref);
    const status = snap.get("status") as Order["status"];
    if (!["pending_payment", "placed", "processing", "refunded"].includes(status)) {
      throw new ActionError("conflict", "This order can no longer be cancelled");
    }
    const reservations = await tx.get(
      db.collection("inventoryReservations").where("orderId", "==", orderId),
    );
    for (const line of order.lines) {
      tx.update(db.collection("variants").doc(line.sku), {
        [`stockByLocation.${ONLINE_LOCATION}`]: FieldValue.increment(line.quantity),
        updatedAt: now,
      });
    }
    for (const r of reservations.docs) tx.delete(r.ref);
    tx.update(ref, {
      status: "cancelled",
      statusHistory: FieldValue.arrayUnion({
        status: "cancelled",
        at: now,
        by: actorOf(actor),
        note: reason,
      }),
      updatedAt: now,
    });
    await writeAuditLog(
      {
        actor,
        action: "orders.cancel",
        target: { type: "order", id: orderId },
        before: { status: order.status },
        after: { status: "cancelled", reason },
      },
      tx,
    );
  });
  invalidate("inventory");
}

/** Adds an internal note to an order (never shown to the customer). */
export async function addOrderNote(actor: Session, orderId: string, text: string): Promise<void> {
  await loadOrder(orderId);
  await orders()
    .doc(orderId)
    .update({
      notes: FieldValue.arrayUnion({ text, by: actorOf(actor), at: new Date() }),
      updatedAt: new Date(),
    });
  await writeAuditLog({
    actor,
    action: "orders.add_note",
    target: { type: "order", id: orderId },
    after: { text },
  });
}

/** Fulfilment: the warehouse has started picking the order. */
export async function markProcessing(actor: Session, orderId: string): Promise<void> {
  await transition(actor, orderId, ["placed"], "processing", "orders.mark_processing");
}

/**
 * Fulfilment: records a parcel with its carrier and tracking number. The
 * order is shipped once every SKU is in a parcel, partly shipped before that.
 */
export async function addShipment(
  actor: Session,
  orderId: string,
  shipment: { carrier: string; trackingNumber: string; skus: string[] },
): Promise<void> {
  const { db } = getFirebaseAdmin();
  const now = new Date();
  await db.runTransaction(async (tx) => {
    const ref = orders().doc(orderId);
    const order = parseSnapshot(orderSchema, await tx.get(ref));
    if (!order) throw new ActionError("not_found", "Order not found");
    if (!["placed", "processing", "partially_shipped"].includes(order.status)) {
      throw new ActionError("conflict", "This order isn't waiting to ship");
    }
    const skus = shipment.skus.length > 0 ? shipment.skus : order.lines.map((l) => l.sku);
    if (skus.some((s) => !order.lines.some((l) => l.sku === s))) {
      throw new ActionError("conflict", "That parcel includes items that aren't in the order");
    }
    const shipped = new Set([...order.shipments.flatMap((s) => s.skus), ...skus]);
    const status = order.lines.every((l) => shipped.has(l.sku)) ? "shipped" : "partially_shipped";
    tx.update(ref, {
      shipments: FieldValue.arrayUnion({
        id: `${orderId}-s${order.shipments.length + 1}`,
        carrier: shipment.carrier,
        trackingNumber: shipment.trackingNumber,
        skus,
        status: "in_transit",
        shippedAt: now,
      }),
      status,
      statusHistory: FieldValue.arrayUnion({ status, at: now, by: actorOf(actor) }),
      updatedAt: now,
    });
    await writeAuditLog(
      {
        actor,
        action: "orders.ship",
        target: { type: "order", id: orderId },
        before: { status: order.status },
        after: { status, carrier: shipment.carrier, trackingNumber: shipment.trackingNumber, skus },
      },
      tx,
    );
  });
}

/** Fulfilment: every parcel has arrived. */
export async function markDelivered(actor: Session, orderId: string): Promise<void> {
  const { db } = getFirebaseAdmin();
  const now = new Date();
  await db.runTransaction(async (tx) => {
    const ref = orders().doc(orderId);
    const order = parseSnapshot(orderSchema, await tx.get(ref));
    if (!order) throw new ActionError("not_found", "Order not found");
    if (order.status !== "shipped") {
      throw new ActionError("conflict", "Only shipped orders can be marked delivered");
    }
    tx.update(ref, {
      shipments: order.shipments.map((s) => ({
        ...s,
        status: "delivered",
        deliveredAt: s.deliveredAt ?? now,
      })),
      status: "delivered",
      payments: order.payments.map((p) =>
        p.provider === "cod" && p.status === "pending" ? { ...p, status: "captured" } : p,
      ),
      statusHistory: FieldValue.arrayUnion({ status: "delivered", at: now, by: actorOf(actor) }),
      updatedAt: now,
    });
    await writeAuditLog(
      {
        actor,
        action: "orders.deliver",
        target: { type: "order", id: orderId },
        before: { status: order.status },
        after: { status: "delivered" },
      },
      tx,
    );
  });
}

async function transition(
  actor: Session,
  orderId: string,
  from: Order["status"][],
  to: Order["status"],
  action: string,
): Promise<void> {
  const { db } = getFirebaseAdmin();
  const now = new Date();
  await db.runTransaction(async (tx) => {
    const ref = orders().doc(orderId);
    const snap = await tx.get(ref);
    if (!snap.exists) throw new ActionError("not_found", "Order not found");
    const status = snap.get("status") as Order["status"];
    if (!from.includes(status)) {
      throw new ActionError(
        "conflict",
        `Orders that are ${status.replace(/_/g, " ")} can't do that`,
      );
    }
    tx.update(ref, {
      status: to,
      statusHistory: FieldValue.arrayUnion({ status: to, at: now, by: actorOf(actor) }),
      updatedAt: now,
    });
    await writeAuditLog(
      {
        actor,
        action,
        target: { type: "order", id: orderId },
        before: { status },
        after: { status: to },
      },
      tx,
    );
  });
}
