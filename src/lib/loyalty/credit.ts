import "server-only";
import { getStoreSettings } from "@/lib/data/admin-records";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { applyLoyaltyChange } from "./tiers";

const CREDITABLE = new Set(["placed", "processing", "partially_shipped", "shipped", "delivered"]);

/**
 * Adds an order's earned points to the member's balance once its payment is
 * secured (placed with pay-on-delivery, or card payment settled). The
 * order's merchandise total counts toward the member's tier. Idempotent:
 * `loyaltyCreditedAt` marks the order as done.
 */
export async function creditOrderPoints(orderId: string): Promise<number> {
  const { db } = getFirebaseAdmin();
  const settings = await getStoreSettings();
  const orderRef = db.collection("orders").doc(orderId);

  return db.runTransaction(async (tx) => {
    const order = await tx.get(orderRef);
    const userId = order.get("userId") as string | null | undefined;
    const points = Number(order.get("loyaltyPointsEarned") ?? 0);
    if (
      !order.exists ||
      !userId ||
      points <= 0 ||
      order.get("loyaltyCreditedAt") ||
      !CREDITABLE.has(String(order.get("status")))
    ) {
      return 0;
    }
    const userRef = db.collection("users").doc(userId);
    const user = await tx.get(userRef);
    const loyalty = user.get("loyalty") as { points: number; periodSpend: number } | undefined;
    if (!loyalty) return 0;

    const totals = order.get("totals") as { subtotal: number; discount: number };
    const next = applyLoyaltyChange(
      loyalty,
      { points, spend: totals.subtotal - totals.discount },
      settings.loyalty.tierThresholds,
    );
    const now = new Date();
    tx.update(userRef, {
      "loyalty.points": next.points,
      "loyalty.periodSpend": next.periodSpend,
      "loyalty.tier": next.tier,
      updatedAt: now,
    });
    tx.create(userRef.collection("loyaltyLedger").doc(), {
      type: "earn",
      points,
      orderId,
      orderNumber: order.get("number"),
      balance: next.points,
      at: now,
    });
    tx.update(orderRef, { loyaltyCreditedAt: now });
    return points;
  });
}
