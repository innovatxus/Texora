import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { ActionError } from "@/lib/actions/run-action";
import { writeAuditLog } from "@/lib/audit/log";
import type { Session } from "@/lib/auth/session";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { ONLINE_LOCATION } from "@/lib/validation";
import { invalidate } from "./revalidate";

/** Why stock changed. Shown in the adjustment history and audit log. */
export const ADJUSTMENT_REASONS = [
  { value: "received", label: "Stock received" },
  { value: "cycle_count", label: "Cycle count correction" },
  { value: "damaged", label: "Damaged" },
  { value: "lost", label: "Lost or stolen" },
  { value: "return_restock", label: "Return restocked" },
  { value: "transfer", label: "Transfer between locations" },
  { value: "correction", label: "Other correction" },
] as const;
export type AdjustmentReason = (typeof ADJUSTMENT_REASONS)[number]["value"];

export interface InventoryRow {
  sku: string;
  productId: string;
  productName: string;
  color: string;
  fitFamily: string;
  size: string;
  threshold: number;
  stock: Record<string, number>;
}

/**
 * Stock for every SKU with its product name. Reads only the fields it
 * needs; at a few thousand SKUs that is one fast query, filtered here.
 */
export async function listInventory(filter: {
  q?: string | undefined;
  lowOnly?: boolean;
}): Promise<InventoryRow[]> {
  const { db } = getFirebaseAdmin();
  const [variants, products] = await Promise.all([
    db
      .collection("variants")
      .select("productId", "color", "fitFamily", "size", "lowStockThreshold", "stockByLocation")
      .get(),
    db.collection("products").select("name").get(),
  ]);
  const names = new Map(products.docs.map((p) => [p.id, String(p.get("name"))]));
  const q = filter.q?.trim().toLowerCase();
  return variants.docs
    .map((d) => ({
      sku: d.id,
      productId: String(d.get("productId")),
      productName: names.get(String(d.get("productId"))) ?? String(d.get("productId")),
      color: String(d.get("color")),
      fitFamily: String(d.get("fitFamily")),
      size: String(d.get("size")),
      threshold: Number(d.get("lowStockThreshold") ?? 0),
      stock: (d.get("stockByLocation") as Record<string, number> | undefined) ?? {},
    }))
    .filter(
      (r) =>
        (!q || r.sku.toLowerCase().includes(q) || r.productName.toLowerCase().includes(q)) &&
        (!filter.lowOnly || (r.stock[ONLINE_LOCATION] ?? 0) <= r.threshold),
    )
    .sort((a, b) => a.sku.localeCompare(b.sku));
}

/**
 * Adds or removes stock at one location. Stock never goes below zero; each
 * change is recorded with its reason in `inventoryAdjustments` and the audit log.
 */
export async function adjustStock(
  actor: Session,
  input: {
    sku: string;
    location: string;
    delta: number;
    reason: AdjustmentReason;
    note?: string | undefined;
  },
): Promise<{ before: number; after: number }> {
  const { db } = getFirebaseAdmin();
  if (input.delta === 0) throw new ActionError("conflict", "Enter a change other than zero");
  const result = await db.runTransaction(async (tx) => {
    const ref = db.collection("variants").doc(input.sku);
    const snap = await tx.get(ref);
    if (!snap.exists) throw new ActionError("not_found", "SKU not found");
    const before = Number(snap.get(`stockByLocation.${input.location}`) ?? 0);
    const after = before + input.delta;
    if (after < 0) {
      throw new ActionError("conflict", `Only ${before} in stock at that location`);
    }
    const now = new Date();
    tx.update(ref, {
      [`stockByLocation.${input.location}`]: FieldValue.increment(input.delta),
      updatedAt: now,
    });
    tx.create(db.collection("inventoryAdjustments").doc(), {
      sku: input.sku,
      productId: snap.get("productId"),
      location: input.location,
      delta: input.delta,
      before,
      after,
      reason: input.reason,
      ...(input.note ? { note: input.note } : {}),
      by: { uid: actor.uid, role: actor.role },
      at: now,
    });
    await writeAuditLog(
      {
        actor,
        action: "inventory.adjust",
        target: { type: "variant", id: input.sku },
        before: { location: input.location, stock: before },
        after: { location: input.location, stock: after, reason: input.reason },
      },
      tx,
    );
    return { before, after };
  });
  invalidate("inventory");
  return result;
}

/** Recent adjustments for one SKU, newest first. */
export async function listAdjustments(sku: string, limit = 20) {
  const snap = await getFirebaseAdmin()
    .db.collection("inventoryAdjustments")
    .where("sku", "==", sku)
    .orderBy("at", "desc")
    .limit(limit)
    .get();
  return snap.docs.map((d) => ({
    id: d.id,
    location: String(d.get("location")),
    delta: Number(d.get("delta")),
    after: Number(d.get("after")),
    reason: String(d.get("reason")) as AdjustmentReason,
    note: d.get("note") as string | undefined,
    at: (d.get("at") as FirebaseFirestore.Timestamp).toDate(),
  }));
}
