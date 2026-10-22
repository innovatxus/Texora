import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { creditOrderPoints } from "@/lib/loyalty/credit";
import { logger } from "@/lib/observability/logger";
import { notifyMerchantsOfOrder, sendOrderConfirmation } from "./notifications";

interface PaymentRecord {
  provider: string;
  ref: string;
  amount: number;
  status: string;
}

/**
 * Applies a provider's verdict to a pending order. Success captures the
 * payment and drops the stock reservations; failure cancels the order and
 * returns the reserved stock. Safe to call more than once per event.
 */
export async function settleCardPayment(
  orderId: string,
  intentRef: string,
  outcome: "succeeded" | "failed",
): Promise<"settled" | "ignored"> {
  const { db } = getFirebaseAdmin();
  const orderRef = db.collection("orders").doc(orderId);

  const settled = await db.runTransaction(async (tx) => {
    const order = await tx.get(orderRef);
    if (!order.exists || order.get("status") !== "pending_payment") return false;
    const reservations = await tx.get(
      db.collection("inventoryReservations").where("orderId", "==", orderId),
    );
    const now = new Date();
    const payments = ((order.get("payments") as PaymentRecord[] | undefined) ?? []).map((p) =>
      p.provider === "stripe" && p.ref === intentRef
        ? { ...p, status: outcome === "succeeded" ? "captured" : "failed" }
        : p,
    );

    if (outcome === "failed") {
      for (const r of reservations.docs) {
        tx.update(db.collection("variants").doc(String(r.get("sku"))), {
          [`stockByLocation.${String(r.get("location"))}`]: FieldValue.increment(
            Number(r.get("quantity")),
          ),
        });
      }
    }
    for (const r of reservations.docs) tx.delete(r.ref);

    const status = outcome === "succeeded" ? "placed" : "cancelled";
    tx.update(orderRef, {
      status,
      payments,
      statusHistory: FieldValue.arrayUnion({
        status,
        at: now,
        note: outcome === "failed" ? "Payment failed" : "Payment received",
      }),
      updatedAt: now,
    });
    return true;
  });

  if (settled && outcome === "succeeded") {
    await Promise.all([
      sendOrderConfirmation(orderId).catch((error: unknown) =>
        logger.error("order.confirmation_email_failed", { orderId, error }),
      ),
      notifyMerchantsOfOrder(orderId).catch((error: unknown) =>
        logger.error("order.merchant_email_failed", { orderId, error }),
      ),
      creditOrderPoints(orderId).catch((error: unknown) =>
        logger.error("loyalty.credit_failed", { orderId, error }),
      ),
    ]);
  }
  return settled ? "settled" : "ignored";
}

/**
 * Releases reservations older than 15 minutes whose payment never completed:
 * stock goes back on sale and the order is cancelled.
 */
export async function releaseExpiredReservations(now = new Date()): Promise<number> {
  const { db } = getFirebaseAdmin();
  const expired = await db
    .collection("inventoryReservations")
    .where("expiresAt", "<=", now)
    .limit(200)
    .get();
  const orderIds = [...new Set(expired.docs.map((d) => String(d.get("orderId"))))];
  let released = 0;
  for (const orderId of orderIds) {
    const order = await db.collection("orders").doc(orderId).get();
    const ref =
      ((order.get("payments") as PaymentRecord[] | undefined) ?? []).find(
        (p) => p.provider === "stripe",
      )?.ref ?? "";
    if ((await settleCardPayment(orderId, ref, "failed")) === "settled") released += 1;
  }
  return released;
}
