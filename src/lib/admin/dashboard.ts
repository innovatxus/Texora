import "server-only";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { parseSnapshot } from "@/lib/data/firestore";
import { ONLINE_LOCATION, orderSchema, type Order } from "@/lib/validation";

const DAY_MS = 86_400_000;

/** Orders placed in the last `days` days, newest first. */
export async function listRecentOrders(days: number, now = new Date()): Promise<Order[]> {
  const snapshot = await getFirebaseAdmin()
    .db.collection("orders")
    .where("placedAt", ">=", new Date(now.getTime() - days * DAY_MS))
    .orderBy("placedAt", "desc")
    .get();
  return snapshot.docs.map((d) => parseSnapshot(orderSchema, d)).filter((o): o is Order => !!o);
}

export interface LowStockRow {
  sku: string;
  productId: string;
  productName: string;
  size: string;
  color: string;
  online: number;
  threshold: number;
}

/**
 * Online-sellable SKUs at or below their low-stock threshold, emptiest
 * first. Firestore can't compare two fields, so this reads only the fields
 * it needs from every variant (a few thousand at most) and filters here.
 */
export async function listLowStock(limit = 10): Promise<LowStockRow[]> {
  const { db } = getFirebaseAdmin();
  const variants = await db
    .collection("variants")
    .select("productId", "size", "color", "lowStockThreshold", "availableOnline", "stockByLocation")
    .get();
  const low = variants.docs
    .map((d) => ({
      sku: d.id,
      productId: String(d.get("productId")),
      size: String(d.get("size")),
      color: String(d.get("color")),
      online: Number(d.get(`stockByLocation.${ONLINE_LOCATION}`) ?? 0),
      threshold: Number(d.get("lowStockThreshold") ?? 0),
      sellable: d.get("availableOnline") !== false,
    }))
    .filter((v) => v.sellable && v.online <= v.threshold)
    .sort((a, b) => a.online - b.online || a.sku.localeCompare(b.sku))
    .slice(0, limit);
  if (low.length === 0) return [];
  const products = await db.getAll(
    ...[...new Set(low.map((v) => v.productId))].map((id) => db.collection("products").doc(id)),
  );
  const names = new Map(products.map((p) => [p.id, String(p.get("name") ?? p.id)]));
  return low.map(({ sellable: _s, ...v }) => ({
    ...v,
    productName: names.get(v.productId) ?? v.productId,
  }));
}

export interface QueueCounts {
  returnsToProcess: number;
  reviewsPending: number;
  priceRequestsPending: number;
  contactRequestsOpen: number;
  ordersToShip: number;
}

/** Work waiting for staff, for the dashboard tiles. */
export async function getQueueCounts(): Promise<QueueCounts> {
  const { db } = getFirebaseAdmin();
  const count = async (q: FirebaseFirestore.Query) => (await q.count().get()).data().count;
  const [
    returnsToProcess,
    reviewsPending,
    priceRequestsPending,
    contactRequestsOpen,
    ordersToShip,
  ] = await Promise.all([
    count(
      db
        .collection("returns")
        .where("status", "in", ["requested", "approved", "in_transit", "received", "inspected"]),
    ),
    count(db.collection("reviews").where("status", "==", "pending")),
    count(db.collection("priceChangeRequests").where("status", "==", "pending")),
    count(db.collection("contactRequests").where("status", "==", "open")),
    count(db.collection("orders").where("status", "in", ["placed", "processing"])),
  ]);
  return {
    returnsToProcess,
    reviewsPending,
    priceRequestsPending,
    contactRequestsOpen,
    ordersToShip,
  };
}
