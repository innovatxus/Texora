import "server-only";
import { paginate, parseSnapshot, type Page } from "@/lib/data/firestore";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import {
  ORDER_STATUSES,
  RETURN_STATUSES,
  orderSchema,
  returnSchema,
  type Order,
  type OrderStatus,
  type Return,
} from "@/lib/validation";

const PAGE = 25;
const db = () => getFirebaseAdmin().db;

export interface OrderSearch {
  q?: string | undefined;
  status?: string | undefined;
  cursor?: string | undefined;
}

/**
 * Orders for the back office list. A query that looks like an order number
 * or an email is an exact lookup; otherwise the list is filtered by status,
 * newest first.
 */
export async function searchOrders({ q, status, cursor }: OrderSearch): Promise<Page<Order>> {
  const parse = (s: FirebaseFirestore.DocumentSnapshot) => parseSnapshot(orderSchema, s);
  const term = q?.trim();
  if (term) {
    const number = /^(TX-?)?\d{6,12}$/i.test(term)
      ? `TX-${term.toUpperCase().replace(/^TX-?/, "")}`
      : null;
    const query = number
      ? db().collection("orders").where("number", "==", number)
      : db().collection("orders").where("email", "==", term.toLowerCase());
    const snap = await query.limit(50).get();
    const items = snap.docs
      .map(parse)
      .filter((o): o is Order => o !== null)
      .sort((a, b) => b.placedAt.getTime() - a.placedAt.getTime());
    return { items, nextCursor: null };
  }
  let base: FirebaseFirestore.Query = db().collection("orders");
  if (status && (ORDER_STATUSES as readonly string[]).includes(status)) {
    base = base.where("status", "==", status as OrderStatus);
  }
  return paginate(
    base,
    [{ field: "placedAt", direction: "desc" }],
    { limit: PAGE, cursor: cursor ?? null },
    parse,
  );
}

/** Orders waiting to ship, oldest first, for the fulfilment queue. */
export async function listOrdersToShip(): Promise<Order[]> {
  const snap = await db()
    .collection("orders")
    .where("status", "in", ["placed", "processing", "partially_shipped"])
    .orderBy("placedAt", "asc")
    .limit(100)
    .get();
  return snap.docs.map((d) => parseSnapshot(orderSchema, d)).filter((o): o is Order => o !== null);
}

/** Returns for the back office queue, optionally by status, newest first. */
export async function listReturns(status?: string, cursor?: string): Promise<Page<Return>> {
  let base: FirebaseFirestore.Query = db().collection("returns");
  if (status && (RETURN_STATUSES as readonly string[]).includes(status)) {
    base = base.where("status", "==", status);
  }
  return paginate(
    base,
    [{ field: "createdAt", direction: "desc" }],
    { limit: PAGE, cursor: cursor ?? null },
    (s) => parseSnapshot(returnSchema, s),
  );
}
