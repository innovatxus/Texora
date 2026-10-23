import { CURRENCY } from "@/config/locale";
import "server-only";
import { FieldValue, type DocumentReference } from "firebase-admin/firestore";
import { ActionError } from "@/lib/actions/run-action";
import type { Session } from "@/lib/auth/session";
import { priceBag } from "@/lib/bag/price-bag";
import { isAvailableLine } from "@/lib/bag/types";
import { getStoreSettings } from "@/lib/data/admin-records";
import { hashGiftCardCode } from "@/lib/data/promotions";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { logger } from "@/lib/observability/logger";
import { cardPaymentsEnabled, paymobProvider } from "@/lib/payments/provider";
import { brand } from "@/config/brand";
import { clientEnv } from "@/lib/env/client";
import { creditOrderPoints } from "@/lib/loyalty/credit";
import { pointsForOrder } from "@/lib/loyalty/tiers";
import { pointsFor } from "@/lib/pricing/rewards";
import { estimateDelivery } from "@/lib/catalog/variant-selection";
import { ONLINE_LOCATION, type OrderLine } from "@/lib/validation";
import type { PlaceOrderInput } from "./checkout-schema";
import { notifyMerchantsOfOrder, sendOrderConfirmation } from "./notifications";
import { orderAccessToken } from "./token";

export interface PlacedOrder {
  orderId: string;
  number: string;
  status: "placed" | "pending_payment";
  accessToken: string;
  payment:
    | {
        kind: "card";
        /** Paymob's hosted checkout (cards, Meeza, wallets); returns to the confirmation page. */
        checkoutUrl: string;
      }
    | { kind: "cod" | "none" };
}

const RESERVATION_MS = 15 * 60 * 1000;
const ORDER_NUMBER_START = 100_000;

/**
 * Places an order: re-prices on the server, then in one transaction checks
 * and decrements stock (reserving it for card payments), debits gift card
 * and rewards, counts promo usage, numbers the order and writes it with
 * snapshotted lines. Repeating the same idempotency key returns the same order.
 */
export async function placeOrder(
  input: PlaceOrderInput,
  session: Session | null,
): Promise<PlacedOrder> {
  const { db } = getFirebaseAdmin();
  const idempotencyRef = db.collection("idempotency").doc(input.idempotencyKey);
  const existing = await idempotencyRef.get();
  if (existing.exists) return existing.get("result") as PlacedOrder;

  const settings = await getStoreSettings();
  const bag = await priceBag({
    lines: input.lines,
    promoCodes: input.promoCodes,
    shippingMethod: input.delivery.method,
    region: input.shippingAddress.region,
    ...(input.giftCardCode ? { giftCardCode: input.giftCardCode } : {}),
    ...(input.rewardsValue ? { rewardsValue: input.rewardsValue } : {}),
  });

  const lines = bag.lines.filter(isAvailableLine);
  if (lines.length !== input.lines.length || lines.some((l) => l.issue !== null)) {
    throw new ActionError(
      "conflict",
      "Your bag has changed: some items are no longer available in that quantity. Please review it.",
    );
  }
  if (bag.rewards === null && (input.rewardsValue ?? 0) > 0) {
    throw new ActionError("forbidden", "Sign in as a rewards member to use rewards");
  }

  const total = bag.totals.total;
  const paymentMethod = total === 0 ? "none" : input.paymentMethod;
  if (paymentMethod === "none" && total > 0)
    throw new ActionError("conflict", "Choose a payment method");
  if (paymentMethod === "card" && !cardPaymentsEnabled())
    throw new ActionError("conflict", "Card payments are unavailable right now");
  if (paymentMethod === "cod" && !settings.features.cashOnDelivery)
    throw new ActionError("conflict", "Cash on delivery is unavailable");

  const location = ONLINE_LOCATION;
  const orderRef = db.collection("orders").doc();
  const now = new Date();
  const window = estimateDelivery(
    input.delivery.method === "express" ? "express" : "standard",
    now,
  );
  const actor =
    session && session.role !== "guest" ? { uid: session.uid, role: session.role } : undefined;

  // Marketplace lines snapshot their merchant and shop name at purchase time.
  const productSnaps = await db.getAll(
    ...[...new Set(lines.map((l) => l.productId))].map((id) => db.collection("products").doc(id)),
  );
  const sellers = new Map(
    productSnaps
      .filter((s) => s.exists && s.get("vendorId"))
      .map((s) => [
        s.id,
        {
          vendorId: s.get("vendorId") as string,
          shopId: s.get("shopId") as string,
          shopName: (s.get("shop.name") as string | undefined) ?? "",
        },
      ]),
  );

  const orderLines: OrderLine[] = lines.map((l) => ({
    sku: l.sku,
    productId: l.productId,
    name: l.name,
    colorName: l.colorName,
    size: l.size,
    fitFamily: l.fitFamily as OrderLine["fitFamily"],
    imageUrl: l.image,
    unitPrice: l.unitPrice,
    ...(l.compareAtPrice !== undefined ? { compareAtPrice: l.compareAtPrice } : {}),
    quantity: l.quantity,
    discount: l.discount ?? 0,
    lineTotal: l.lineTotal ?? l.unitPrice * l.quantity,
    finalSale: l.finalSale,
    ...(sellers.get(l.productId) ?? {}),
  }));
  const vendorIds = [...new Set(orderLines.flatMap((l) => (l.vendorId ? [l.vendorId] : [])))];

  const status = paymentMethod === "card" ? "pending_payment" : "placed";
  const merchandise = bag.totals.subtotal - bag.totals.discount;

  const number = await db.runTransaction(async (tx) => {
    // Reads first (Firestore transactions require all reads before writes).
    const variantRefs = lines.map((l) => db.collection("variants").doc(l.sku));
    const variantSnaps = await tx.getAll(...variantRefs);
    const counterRef = db.collection("counters").doc("orders");
    const counter = await tx.get(counterRef);
    const giftCardRef =
      input.giftCardCode && bag.totals.giftCard > 0
        ? db.collection("giftCards").doc(hashGiftCardCode(input.giftCardCode))
        : null;
    const giftCard = giftCardRef ? await tx.get(giftCardRef) : null;
    const userRef = actor ? db.collection("users").doc(actor.uid) : null;
    const user = userRef && bag.totals.rewards > 0 ? await tx.get(userRef) : null;
    const codeRefs = bag.applied
      .filter((a) => a.code)
      .map((a) => db.collection("promoCodes").doc(a.code as string));

    variantSnaps.forEach((snap, i) => {
      const line = lines[i];
      const stock = (snap.get(`stockByLocation.${location}`) as number | undefined) ?? 0;
      if (!line || stock < line.quantity) {
        throw new ActionError(
          "conflict",
          `${line?.name ?? "An item"} just sold out in that size. Please review your bag.`,
        );
      }
    });
    if (
      giftCard &&
      (!giftCard.exists || (giftCard.get("balance") as number) < bag.totals.giftCard)
    ) {
      throw new ActionError("conflict", "Your gift card balance has changed. Please re-apply it.");
    }
    if (
      user &&
      ((user.get("loyalty.points") as number | undefined) ?? 0) < pointsFor(bag.totals.rewards)
    ) {
      throw new ActionError("conflict", "Your rewards balance has changed. Please choose again.");
    }

    // Writes.
    const next = ((counter.get("value") as number | undefined) ?? ORDER_NUMBER_START) + 1;
    tx.set(counterRef, { value: next }, { merge: true });
    lines.forEach((line, i) => {
      const ref = variantRefs[i] as DocumentReference;
      tx.update(ref, {
        [`stockByLocation.${location}`]: FieldValue.increment(-line.quantity),
        updatedAt: now,
      });
      if (status === "pending_payment") {
        tx.create(db.collection("inventoryReservations").doc(), {
          sku: line.sku,
          location,
          quantity: line.quantity,
          cartId: orderRef.id,
          orderId: orderRef.id,
          expiresAt: new Date(now.getTime() + RESERVATION_MS),
          createdAt: now,
        });
      }
    });
    if (giftCardRef)
      tx.update(giftCardRef, { balance: FieldValue.increment(-bag.totals.giftCard) });
    if (userRef && bag.totals.rewards > 0) {
      tx.update(userRef, {
        "loyalty.points": FieldValue.increment(-pointsFor(bag.totals.rewards)),
      });
    }
    for (const ref of codeRefs) tx.update(ref, { usedCount: FieldValue.increment(1) });

    const orderNumber = `TX-${next}`;
    tx.create(orderRef, {
      number: orderNumber,
      vendorIds,
      userId: actor?.uid ?? null,
      email: input.email,
      status,
      currency: CURRENCY,
      lines: orderLines,
      totals: bag.totals,
      shippingAddress: input.shippingAddress,
      billingAddress: input.billingAddress,
      delivery: {
        method: input.delivery.method,
        cost: bag.totals.shipping,
        estimatedFrom: window.from,
        estimatedTo: window.to,
      },
      promoCodes: bag.applied.filter((a) => a.code).map((a) => a.code as string),
      payments: [
        ...(bag.totals.giftCard > 0
          ? [
              {
                provider: "gift_card",
                ref: hashGiftCardCode(input.giftCardCode ?? "").slice(0, 12),
                amount: bag.totals.giftCard,
                status: "captured",
              },
            ]
          : []),
        ...(bag.totals.rewards > 0
          ? [
              {
                provider: "rewards",
                ref: actor?.uid ?? "",
                amount: bag.totals.rewards,
                status: "captured",
              },
            ]
          : []),
        ...(paymentMethod === "cod"
          ? [{ provider: "cod", ref: orderNumber, amount: total, status: "pending" }]
          : []),
      ],
      shipments: [],
      refunds: [],
      statusHistory: [{ status, at: now, ...(actor ? { by: actor } : {}) }],
      notes: [],
      idempotencyKey: input.idempotencyKey,
      loyaltyPointsEarned: bag.rewards
        ? pointsForOrder(merchandise, settings.loyalty.pointsPerCurrencyUnit, bag.rewards.tier)
        : 0,
      placedAt: now,
      updatedAt: now,
    });
    return orderNumber;
  });

  let payment: PlacedOrder["payment"] = { kind: paymentMethod === "cod" ? "cod" : "none" };
  if (paymentMethod === "card") {
    const billing = input.billingAddress;
    const returnUrl = new URL(`/order-confirmation/${orderRef.id}`, clientEnv.NEXT_PUBLIC_SITE_URL);
    returnUrl.searchParams.set("t", orderAccessToken(orderRef.id));
    const intent = await paymobProvider.createPayment({
      amount: total,
      currency: CURRENCY,
      payer: {
        email: input.email,
        firstName: billing.firstName,
        lastName: billing.lastName,
        phone: billing.phone,
        city: billing.city,
        street: billing.line1,
        region: billing.region,
      },
      subject: { kind: "order", id: orderRef.id },
      returnUrl: returnUrl.toString(),
      description: `${brand.name} order ${number}`,
    });
    await orderRef.update({
      payments: FieldValue.arrayUnion({
        provider: "paymob",
        ref: intent.ref,
        amount: total,
        status: "pending",
      }),
    });
    payment = { kind: "card", checkoutUrl: intent.checkoutUrl };
  }

  const result: PlacedOrder = {
    orderId: orderRef.id,
    number,
    status,
    accessToken: orderAccessToken(orderRef.id),
    payment,
  };
  // The checkout link is handed to this tab only; a retry returns the order without it.
  await idempotencyRef.set({
    result: { ...result, payment: { kind: payment.kind } },
    createdAt: now,
  });

  if (status === "placed") {
    await Promise.all([
      sendOrderConfirmation(orderRef.id).catch((error: unknown) =>
        logger.error("order.confirmation_email_failed", { orderId: orderRef.id, error }),
      ),
      notifyMerchantsOfOrder(orderRef.id).catch((error: unknown) =>
        logger.error("order.merchant_email_failed", { orderId: orderRef.id, error }),
      ),
      creditOrderPoints(orderRef.id).catch((error: unknown) =>
        logger.error("loyalty.credit_failed", { orderId: orderRef.id, error }),
      ),
    ]);
  }
  return result;
}
