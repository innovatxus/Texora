import "server-only";
import { createElement } from "react";
import { brand } from "@/config/brand";
import { getOrder } from "@/lib/data/orders";
import { sendEmail } from "@/lib/email/send";
import { MerchantNewOrderEmail } from "@/lib/email/templates/MerchantOrder";
import { OrderConfirmationEmail } from "@/lib/email/templates/OrderConfirmation";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { clientEnv } from "@/lib/env/client";
import { orderAccessToken } from "./token";

const dateFormat = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
});

/** Sends (or re-sends) the order confirmation email. */
export async function sendOrderConfirmation(orderId: string): Promise<void> {
  const order = await getOrder(orderId);
  if (!order) throw new Error(`Order ${orderId} not found`);

  const address = order.shippingAddress ?? order.billingAddress;
  const delivery = `${order.delivery.method === "express" ? "Express" : "Standard"} delivery, arriving ${dateFormat.format(order.delivery.estimatedFrom)} – ${dateFormat.format(order.delivery.estimatedTo)}`;
  const paymentNote = order.payments.some((p) => p.provider === "cod")
    ? "Pay on delivery"
    : order.payments.some((p) => p.provider === "stripe")
      ? "Card"
      : "Gift card / rewards";

  const url = new URL(`/order-confirmation/${order.id}`, clientEnv.NEXT_PUBLIC_SITE_URL);
  url.searchParams.set("t", orderAccessToken(order.id));

  await sendEmail({
    to: order.email,
    subject: `Your ${brand.name} order ${order.number}`,
    kind: "order_confirmation",
    ref: order.id,
    template: createElement(OrderConfirmationEmail, {
      brandName: brand.name,
      orderNumber: order.number,
      firstName: address.firstName,
      orderUrl: url.toString(),
      lines: order.lines.map((l) => ({
        name: l.name,
        detail: `${l.colorName} · Size ${l.size.replace("x", " × ")}`,
        quantity: l.quantity,
        lineTotal: l.lineTotal,
      })),
      totals: order.totals,
      delivery,
      paymentNote,
    }),
  });
}

/**
 * Tells each merchant with lines in the order what to ship (only their own
 * items; no payment details). Sent once the order is placed or paid.
 */
export async function notifyMerchantsOfOrder(orderId: string): Promise<void> {
  const order = await getOrder(orderId);
  if (!order || order.vendorIds.length === 0) return;
  const { db } = getFirebaseAdmin();
  for (const vendorId of order.vendorIds) {
    const merchant = await db.collection("merchants").doc(vendorId).get();
    const email = merchant.get("email") as string | undefined;
    if (!email) continue;
    const lines = order.lines.filter((l) => l.vendorId === vendorId);
    const items = lines.reduce((n, l) => n + l.quantity, 0);
    await sendEmail({
      to: email,
      subject: `New order ${order.number}: ${items} item${items === 1 ? "" : "s"} to ship`,
      kind: "merchant_new_order",
      ref: order.id,
      template: createElement(MerchantNewOrderEmail, {
        brandName: brand.name,
        orderNumber: order.number,
        lines: lines.map((l) => ({
          name: l.name,
          detail: `${l.colorName} · Size ${l.size.replace("x", " × ")} · Qty ${l.quantity}`,
        })),
        link: new URL(`/merchant/orders/${order.id}`, clientEnv.NEXT_PUBLIC_SITE_URL).toString(),
      }),
    });
  }
}
