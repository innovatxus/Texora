import "server-only";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { returnSchema, type Return } from "@/lib/validation";
import { parseSnapshot } from "./firestore";

const returns = () => getFirebaseAdmin().db.collection("returns");

/** A return by id. */
export async function getReturn(id: string): Promise<Return | null> {
  return parseSnapshot(returnSchema, await returns().doc(id).get());
}

/** Returns for one order, oldest first. */
export async function listReturnsForOrder(orderId: string): Promise<Return[]> {
  const snapshot = await returns().where("orderId", "==", orderId).get();
  return snapshot.docs
    .map((d) => parseSnapshot(returnSchema, d))
    .filter((r): r is Return => r !== null)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}
