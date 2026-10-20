import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { ActionError } from "@/lib/actions/run-action";
import { writeAuditLog } from "@/lib/audit/log";
import type { Session } from "@/lib/auth/session";
import { parseSnapshot } from "@/lib/data/firestore";
import { getOrder } from "@/lib/data/orders";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { issueStoreCredit } from "@/lib/giftcards/service";
import { returnSchema } from "@/lib/validation";
import { refundOrder } from "./order-service";
import { invalidate } from "./revalidate";

const actorOf = (s: Session) => ({ uid: s.uid, role: s.role });
const returns = () => getFirebaseAdmin().db.collection("returns");

/** Approves or denies a return that was requested outside the automatic policy. */
export async function decideReturn(
  actor: Session,
  returnId: string,
  decision: "approved" | "denied",
  note: string,
): Promise<void> {
  const { db } = getFirebaseAdmin();
  const now = new Date();
  await db.runTransaction(async (tx) => {
    const ref = returns().doc(returnId);
    const record = parseSnapshot(returnSchema, await tx.get(ref));
    if (!record) throw new ActionError("not_found", "Return not found");
    if (record.status !== "requested") {
      throw new ActionError("conflict", "This return has already been decided");
    }
    tx.update(ref, {
      status: decision,
      statusHistory: FieldValue.arrayUnion({ status: decision, at: now, by: actorOf(actor) }),
      ...(note ? { staffNote: note } : {}),
    });
    await writeAuditLog(
      {
        actor,
        action: `returns.${decision === "approved" ? "approve" : "deny"}`,
        target: { type: "return", id: returnId },
        before: { status: record.status },
        after: { status: decision, note },
      },
      tx,
    );
  });
}

/**
 * The parcel has arrived and been checked. Resellable units go back into
 * stock at the receiving location; damaged ones don't.
 */
export async function receiveReturn(
  actor: Session,
  returnId: string,
  input: { conditions: Record<string, "resellable" | "damaged">; location: string },
): Promise<void> {
  const { db } = getFirebaseAdmin();
  const now = new Date();
  await db.runTransaction(async (tx) => {
    const ref = returns().doc(returnId);
    const record = parseSnapshot(returnSchema, await tx.get(ref));
    if (!record) throw new ActionError("not_found", "Return not found");
    if (!["approved", "in_transit"].includes(record.status)) {
      throw new ActionError("conflict", "This return isn't waiting to be received");
    }
    const lines = record.lines.map((l) => ({
      ...l,
      condition: input.conditions[l.sku] ?? "resellable",
    }));
    for (const line of lines) {
      if (line.condition !== "resellable") continue;
      tx.update(db.collection("variants").doc(line.sku), {
        [`stockByLocation.${input.location}`]: FieldValue.increment(line.quantity),
        updatedAt: now,
      });
    }
    tx.update(ref, {
      lines,
      status: "inspected",
      receivedAt: now,
      receivedAtLocation: input.location,
      statusHistory: FieldValue.arrayUnion(
        { status: "received", at: now, by: actorOf(actor) },
        { status: "inspected", at: now, by: actorOf(actor) },
      ),
    });
    await writeAuditLog(
      {
        actor,
        action: "returns.receive",
        target: { type: "return", id: returnId },
        before: { status: record.status },
        after: {
          status: "inspected",
          location: input.location,
          restocked: lines.filter((l) => l.condition === "resellable").map((l) => l.sku),
        },
      },
      tx,
    );
  });
  invalidate("inventory");
}

/**
 * Refunds a received return: back to the original payment (through the
 * order refund, so limits and loyalty reversal apply) or as store credit
 * on a new gift card. Safe to retry: the refund id is tied to the return.
 */
export async function refundReturn(
  actor: Session,
  returnId: string,
  amount?: number,
): Promise<{ amount: number; storeCreditLast4?: string }> {
  const record = parseSnapshot(returnSchema, await returns().doc(returnId).get());
  if (!record) throw new ActionError("not_found", "Return not found");
  if (!["received", "inspected"].includes(record.status)) {
    throw new ActionError("conflict", "Receive and inspect the return before refunding it");
  }
  const order = await getOrder(record.orderId);
  if (!order) throw new ActionError("not_found", "Order not found");
  const value = amount ?? record.refundEstimate;

  await refundOrder(actor, order.id, value, `Return ${record.number}`, {
    refundId: `return-${record.id}`,
    storeCredit: record.refundTo === "store_credit",
  });
  let storeCreditLast4: string | undefined;
  if (record.refundTo === "store_credit") {
    const credit = await issueStoreCredit({
      amount: value,
      email: record.email,
      firstName: order.shippingAddress.firstName,
      reference: `return ${record.number}`,
      issuedBy: actorOf(actor),
    });
    storeCreditLast4 = credit.last4;
  }

  const now = new Date();
  await returns()
    .doc(returnId)
    .update({
      status: "refunded",
      refundAmount: value,
      statusHistory: FieldValue.arrayUnion({ status: "refunded", at: now, by: actorOf(actor) }),
    });
  await writeAuditLog({
    actor,
    action: "returns.refund",
    target: { type: "return", id: returnId },
    before: { status: record.status },
    after: { status: "refunded", amount: value, refundTo: record.refundTo },
  });
  return { amount: value, ...(storeCreditLast4 ? { storeCreditLast4 } : {}) };
}
