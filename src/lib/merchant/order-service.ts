import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { createElement } from "react";
import { brand } from "@/config/brand";
import type { CARRIERS } from "@/config/merchant";
import { ActionError } from "@/lib/actions/run-action";
import { writeAuditLog } from "@/lib/audit/log";
import { paginate, parseSnapshot, type Page, type PageRequest } from "@/lib/data/firestore";
import { getOrder } from "@/lib/data/orders";
import { sendEmail } from "@/lib/email/send";
import { MerchantShippedEmail } from "@/lib/email/templates/MerchantOrder";
import { clientEnv } from "@/lib/env/client";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { logger } from "@/lib/observability/logger";
import { orderAccessToken } from "@/lib/orders/token";
import { orderSchema } from "@/lib/validation/commerce";
import { merchantOrderView, statusAfterShipment, type MerchantOrderView } from "./orders";
import type { MerchantActor } from "./shop-service";

const orders = () => getFirebaseAdmin().db.collection("orders");

/**
 * The merchant's orders, newest first, cursor-paginated. Scoped on the
 * server by `vendorIds` (never a client filter); unpaid card orders are left
 * out until payment succeeds.
 */
export async function listMerchantOrders(
  vendorId: string,
  page: PageRequest,
): Promise<Page<MerchantOrderView>> {
  const base = orders().where("vendorIds", "array-contains", vendorId);
  const result = await paginate(base, [{ field: "placedAt", direction: "desc" }], page, (d) => {
    const order = parseSnapshot(orderSchema, d);
    if (!order || order.status === "pending_payment") return null;
    return merchantOrderView(order, vendorId);
  });
  return result;
}

/** One order as the merchant sees it; null (shown as not found) when it has none of their lines. */
export async function getMerchantOrder(
  vendorId: string,
  orderId: string,
): Promise<MerchantOrderView | null> {
  const order = await getOrder(orderId);
  if (!order || order.status === "pending_payment" || !order.vendorIds.includes(vendorId))
    return null;
  return merchantOrderView(order, vendorId);
}

/**
 * Marks the merchant's unshipped items as shipped: one parcel holding only
 * their SKUs (D-069). The order becomes "shipped" once every line, from every
 * seller, is in a parcel. The customer is emailed the tracking details.
 */
export async function markShipped(
  actor: MerchantActor,
  orderId: string,
  shipment: { carrier: (typeof CARRIERS)[number]; trackingNumber: string },
  now = new Date(),
): Promise<MerchantOrderView> {
  const ref = orders().doc(orderId);
  const result = await getFirebaseAdmin().db.runTransaction(async (tx) => {
    const order = parseSnapshot(orderSchema, await tx.get(ref));
    const view = order ? merchantOrderView(order, actor.vendorId) : null;
    if (!order || !view || !order.vendorIds.includes(actor.vendorId)) {
      throw new ActionError("not_found", "We couldn't find that order.");
    }
    if (!["placed", "processing", "partially_shipped"].includes(order.status)) {
      throw new ActionError("conflict", "This order isn't waiting to ship.");
    }
    if (view.unshipped.length === 0)
      throw new ActionError("conflict", "Everything in this order is already shipped.");
    const status = statusAfterShipment(order, view.unshipped);
    const by = { uid: actor.session.uid, role: actor.session.role };
    tx.update(ref, {
      shipments: FieldValue.arrayUnion({
        id: `${orderId}-s${order.shipments.length + 1}`,
        carrier: shipment.carrier,
        trackingNumber: shipment.trackingNumber,
        skus: view.unshipped,
        status: "in_transit",
        shippedAt: now,
      }),
      status,
      statusHistory: FieldValue.arrayUnion({
        status,
        at: now,
        by,
        note: `Shipped by ${view.lines[0]?.shopName ?? "merchant"}`,
      }),
      updatedAt: now,
    });
    await writeAuditLog(
      {
        actor: actor.session,
        action: "orders.merchant_ship",
        target: { type: "order", id: orderId },
        before: { status: order.status },
        after: {
          status,
          carrier: shipment.carrier,
          trackingNumber: shipment.trackingNumber,
          skus: view.unshipped,
        },
      },
      tx,
    );
    return { order, shopName: view.lines[0]?.shopName ?? "the shop" };
  });

  try {
    const url = new URL(`/orders/${orderId}`, clientEnv.NEXT_PUBLIC_SITE_URL);
    url.searchParams.set("t", orderAccessToken(orderId));
    await sendEmail({
      to: result.order.email,
      subject: `Part of your ${brand.name} order ${result.order.number} has shipped`,
      kind: "merchant_shipped",
      ref: orderId,
      template: createElement(MerchantShippedEmail, {
        brandName: brand.name,
        orderNumber: result.order.number,
        shopName: result.shopName,
        carrier: shipment.carrier,
        trackingNumber: shipment.trackingNumber,
        link: url.toString(),
      }),
    });
  } catch (error) {
    logger.error("merchant.shipped_email_failed", { orderId, error });
  }
  const view = await getMerchantOrder(actor.vendorId, orderId);
  if (!view) throw new ActionError("not_found", "We couldn't find that order.");
  return view;
}
