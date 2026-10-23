import { LOCALE, TIME_ZONE } from "@/config/locale";
import "server-only";
import { randomInt } from "node:crypto";
import { createElement } from "react";
import { brand } from "@/config/brand";
import { ActionError } from "@/lib/actions/run-action";
import { getStore } from "@/lib/data/catalog-structure";
import { getReturn } from "@/lib/data/returns";
import { sendEmail } from "@/lib/email/send";
import { ReturnInstructionsEmail } from "@/lib/email/templates/ReturnInstructions";
import { clientEnv } from "@/lib/env/client";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { logger } from "@/lib/observability/logger";
import { orderAccessToken } from "@/lib/orders/token";
import type { Order, Return } from "@/lib/validation";
import { refundEstimate, returnEligibility } from "./policy";

export interface ReturnRequest {
  lines: Array<{
    sku: string;
    quantity: number;
    reason: Return["lines"][number]["reason"];
    comment?: string | undefined;
  }>;
  method: "mail" | "store";
  storeId?: string | undefined;
  refundTo: "original" | "store_credit";
}

const dateFormat = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  month: "long",
  day: "numeric",
  year: "numeric",
});

/** Signed link to a return's page. */
export function returnPageUrl(orderId: string, returnId: string): string {
  const url = new URL(`/orders/${orderId}/returns/${returnId}`, clientEnv.NEXT_PUBLIC_SITE_URL);
  url.searchParams.set("t", orderAccessToken(orderId));
  return url.toString();
}

/**
 * Creates a return for an order the caller is authorised to see. Requests
 * inside the policy (window, quantities, not final sale) are approved
 * straight away with a prepaid label or drop-off QR code; staff receive,
 * inspect and refund them in the back office.
 */
export async function requestReturn(
  order: Order,
  request: ReturnRequest,
  now = new Date(),
): Promise<{ returnId: string; number: string }> {
  const { db } = getFirebaseAdmin();

  // Merge repeated SKUs so quantities are checked against the total.
  const merged = new Map<string, ReturnRequest["lines"][number]>();
  for (const line of request.lines) {
    const existing = merged.get(line.sku);
    merged.set(
      line.sku,
      existing ? { ...existing, quantity: existing.quantity + line.quantity } : line,
    );
  }
  const lines = [...merged.values()];

  if (request.method === "store") {
    const store = request.storeId ? await getStore(request.storeId) : null;
    if (!store || store.status !== "open" || !store.services.includes("returns")) {
      throw new ActionError("conflict", "Choose a store that accepts returns");
    }
  }

  const result = await db.runTransaction(async (tx) => {
    // Read existing returns inside the transaction so two tabs can't both return the same units.
    const existingSnap = await tx.get(db.collection("returns").where("orderId", "==", order.id));
    const existing = existingSnap.docs.map((d) => ({
      status: d.get("status") as Return["status"],
      lines: d.get("lines") as Return["lines"],
    }));
    const eligibility = returnEligibility(order, existing, now);
    if (!eligibility.eligible) {
      throw new ActionError(
        "conflict",
        eligibility.reason === "window_closed"
          ? "The 30-day return window for this order has closed"
          : eligibility.reason === "not_shipped"
            ? "You can start a return once your order has shipped"
            : eligibility.reason === "cancelled"
              ? "This order was cancelled"
              : "Everything in this order has already been returned",
      );
    }
    for (const line of lines) {
      const available = eligibility.lines.find((l) => l.sku === line.sku)?.available ?? 0;
      if (line.quantity > available) {
        throw new ActionError(
          "conflict",
          available === 0
            ? "One of the items can't be returned"
            : "You've chosen more items than can be returned",
        );
      }
    }

    const sequence = existingSnap.size + 1;
    const ref = db.collection("returns").doc(`${order.id}-r${sequence}`);
    const number = `${order.number}-R${sequence}`;
    const doc = {
      number,
      orderId: order.id,
      orderNumber: order.number,
      userId: order.userId,
      email: order.email,
      lines: lines.map((l) => ({
        sku: l.sku,
        quantity: l.quantity,
        reason: l.reason,
        ...(l.comment ? { comment: l.comment } : {}),
      })),
      method: request.method,
      ...(request.method === "store" && request.storeId ? { storeId: request.storeId } : {}),
      refundTo: request.refundTo,
      status: "approved",
      ...(request.method === "mail"
        ? {
            label: {
              carrier: "Prepaid return",
              trackingNumber: `TXR${String(randomInt(10 ** 9, 10 ** 10))}`,
              code: number,
            },
          }
        : {}),
      refundEstimate: refundEstimate(order, lines),
      statusHistory: [
        { status: "requested", at: now },
        { status: "approved", at: now },
      ],
      createdAt: now,
    };
    // create() fails if a concurrent request took this sequence number; the transaction retries.
    tx.create(ref, doc);
    return { returnId: ref.id, number };
  });

  await sendReturnInstructions(result.returnId).catch((error: unknown) =>
    logger.error("returns.email_failed", { returnId: result.returnId, error }),
  );
  return result;
}

/** Emails (or re-sends) the return instructions with the QR code. */
export async function sendReturnInstructions(returnId: string): Promise<void> {
  const record = await getReturn(returnId);
  if (!record) throw new Error(`Return ${returnId} not found`);
  const { db } = getFirebaseAdmin();
  const [orderSnap, store] = await Promise.all([
    db.collection("orders").doc(record.orderId).get(),
    record.storeId ? getStore(record.storeId) : null,
  ]);
  const orderLines = (orderSnap.get("lines") as Order["lines"] | undefined) ?? [];
  const qrUrl = new URL(`/api/returns/${record.id}/qr`, clientEnv.NEXT_PUBLIC_SITE_URL);
  qrUrl.searchParams.set("t", orderAccessToken(record.orderId));
  const deadline = new Date(record.createdAt.getTime() + 14 * 24 * 60 * 60 * 1000);

  await sendEmail({
    to: record.email,
    subject: `Your ${brand.name} return ${record.number}`,
    kind: "return_instructions",
    ref: record.id,
    template: createElement(ReturnInstructionsEmail, {
      brandName: brand.name,
      returnNumber: record.number,
      orderNumber: record.orderNumber,
      returnUrl: returnPageUrl(record.orderId, record.id),
      method: record.method,
      ...(store ? { storeName: store.name } : {}),
      qrImageUrl: qrUrl.toString(),
      lines: record.lines.map((l) => {
        const line = orderLines.find((o) => o.sku === l.sku);
        return {
          name: line?.name ?? l.sku,
          detail: line ? `${line.colorName} · Size ${line.size.replace("x", " × ")}` : "",
          quantity: l.quantity,
        };
      }),
      refundEstimate: record.refundEstimate,
      refundTo: record.refundTo,
      deadline: dateFormat.format(deadline),
    }),
  });
}
