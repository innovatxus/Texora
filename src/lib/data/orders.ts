import "server-only";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { orderSchema, type Order } from "@/lib/validation";
import { paginate, parseSnapshot, type Page, type PageRequest } from "./firestore";

const orders = () => getFirebaseAdmin().db.collection("orders");

export async function getOrder(id: string): Promise<Order | null> {
  return parseSnapshot(orderSchema, await orders().doc(id).get());
}

export async function getOrderByNumberAndEmail(
  number: string,
  email: string,
): Promise<Order | null> {
  const snapshot = await orders()
    .where("email", "==", email.trim().toLowerCase())
    .where("number", "==", number.trim().toUpperCase())
    .limit(1)
    .get();
  const doc = snapshot.docs[0];
  return doc ? parseSnapshot(orderSchema, doc) : null;
}

export async function listOrdersForUser(uid: string, page: PageRequest): Promise<Page<Order>> {
  return paginate(
    orders().where("userId", "==", uid),
    [{ field: "placedAt", direction: "desc" }],
    page,
    (s) => parseSnapshot(orderSchema, s),
  );
}
