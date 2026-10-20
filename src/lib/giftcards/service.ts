import "server-only";
import { createElement } from "react";
import { brand } from "@/config/brand";
import { ActionError } from "@/lib/actions/run-action";
import type { Session } from "@/lib/auth/session";
import { hashGiftCardCode } from "@/lib/data/promotions";
import { sendEmail } from "@/lib/email/send";
import { GiftCardEmail, GiftCardReceiptEmail } from "@/lib/email/templates/GiftCard";
import { clientEnv } from "@/lib/env/client";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { logger } from "@/lib/observability/logger";
import { signToken } from "@/lib/orders/token";
import { cardPaymentsEnabled, stripeProvider } from "@/lib/payments/provider";
import { giftCardPurchaseSchema, type GiftCardPurchase } from "@/lib/validation";
import { parseSnapshot } from "@/lib/data/firestore";
import { businessDate, GIFT_CARD_VALID_YEARS } from "./codes";
import { generateGiftCardCode } from "./generate";

const purchases = () => getFirebaseAdmin().db.collection("giftCardPurchases");

const longDate = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});
const formatDay = (yyyyMmDd: string) => longDate.format(new Date(`${yyyyMmDd}T12:00:00Z`));

export interface GiftCardPurchaseInput {
  amount: number;
  purchaserEmail: string;
  senderName: string;
  recipientName: string;
  recipientEmail: string;
  message?: string | undefined;
  deliverOn: string;
  idempotencyKey: string;
}

/** Signed link to a gift card purchase's status page. */
export function purchasePageUrl(purchaseId: string): string {
  const url = new URL(`/gift-cards/purchase/${purchaseId}`, clientEnv.NEXT_PUBLIC_SITE_URL);
  url.searchParams.set("t", signToken("gift-card-purchase", purchaseId));
  return url.toString();
}

/** A gift card purchase by id. */
export async function getGiftCardPurchase(id: string): Promise<GiftCardPurchase | null> {
  return parseSnapshot(giftCardPurchaseSchema, await purchases().doc(id).get());
}

/**
 * Records an e-gift card purchase and opens a card payment for it. The card
 * is only issued once the payment provider confirms payment (webhook) and
 * the delivery date arrives.
 */
export async function createGiftCardPurchase(
  input: GiftCardPurchaseInput,
  session: Session | null,
): Promise<{ purchaseId: string; clientSecret: string; token: string }> {
  if (!cardPaymentsEnabled()) {
    throw new ActionError(
      "conflict",
      "Gift cards can only be bought by card, and card payments are unavailable right now.",
    );
  }
  // The idempotency key is the document id, so a double submit reuses the same purchase.
  const ref = purchases().doc(`gcp-${input.idempotencyKey}`);
  const existing = await ref.get();
  if (!existing.exists) {
    await ref.create({
      amount: input.amount,
      currency: "USD",
      purchaserEmail: input.purchaserEmail,
      senderName: input.senderName,
      recipientName: input.recipientName,
      recipientEmail: input.recipientEmail,
      ...(input.message ? { message: input.message } : {}),
      deliverOn: input.deliverOn,
      status: "pending_payment",
      userId: session && session.role !== "guest" ? session.uid : null,
      createdAt: new Date(),
    });
  } else if (existing.get("status") !== "pending_payment") {
    throw new ActionError("conflict", "This gift card has already been paid for");
  }

  const amount = Number((existing.exists ? existing.get("amount") : input.amount) as number);
  const intent = await stripeProvider.createPayment({
    amount,
    currency: "USD",
    email: input.purchaserEmail,
    metadata: { giftCardPurchaseId: ref.id },
    idempotencyKey: `gift-card-${ref.id}`,
  });
  await ref.update({ paymentRef: intent.ref });
  return {
    purchaseId: ref.id,
    clientSecret: intent.clientSecret,
    token: signToken("gift-card-purchase", ref.id),
  };
}

/** Applies the provider's verdict. Paid purchases due today are delivered at once. */
export async function settleGiftCardPurchase(
  purchaseId: string,
  outcome: "succeeded" | "failed",
  now = new Date(),
): Promise<"settled" | "ignored"> {
  const { db } = getFirebaseAdmin();
  const ref = purchases().doc(purchaseId);
  const settled = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists || snap.get("status") !== "pending_payment") return false;
    tx.update(
      ref,
      outcome === "succeeded" ? { status: "paid", paidAt: now } : { status: "cancelled" },
    );
    return true;
  });
  if (!settled) return "ignored";
  if (outcome === "succeeded") {
    const purchase = await getGiftCardPurchase(purchaseId);
    if (purchase) {
      await sendEmail({
        to: purchase.purchaserEmail,
        subject: `Your ${brand.name} e-gift card is confirmed`,
        kind: "gift_card_receipt",
        ref: purchaseId,
        template: createElement(GiftCardReceiptEmail, {
          brandName: brand.name,
          amount: purchase.amount,
          recipientName: purchase.recipientName,
          recipientEmail: purchase.recipientEmail,
          deliverOn: formatDay(purchase.deliverOn),
          statusUrl: purchasePageUrl(purchaseId),
        }),
      }).catch((error: unknown) => logger.error("giftcards.receipt_failed", { purchaseId, error }));
      if (purchase.deliverOn <= businessDate(now)) await deliverGiftCard(purchaseId, now);
    }
  }
  return "settled";
}

/**
 * Issues the card and emails its code to the recipient. The code exists
 * only in memory and in that email: we store its hash. If the email fails,
 * the card is disabled and the purchase goes back to "paid" so the next
 * run issues a fresh code.
 */
export async function deliverGiftCard(purchaseId: string, now = new Date()): Promise<boolean> {
  const { db } = getFirebaseAdmin();
  const ref = purchases().doc(purchaseId);
  const code = generateGiftCardCode();
  const cardId = hashGiftCardCode(code);
  const expiresAt = new Date(now);
  expiresAt.setUTCFullYear(expiresAt.getUTCFullYear() + GIFT_CARD_VALID_YEARS);

  const purchase = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists || snap.get("status") !== "paid") return null;
    const amount = Number(snap.get("amount"));
    tx.create(db.collection("giftCards").doc(cardId), {
      last4: code.slice(-4),
      currency: "USD",
      initialBalance: amount,
      balance: amount,
      recipientEmail: snap.get("recipientEmail"),
      status: "active",
      expiresAt,
      createdAt: now,
    });
    tx.update(ref, { status: "delivered", giftCardId: cardId, deliveredAt: now });
    return {
      amount,
      recipientName: String(snap.get("recipientName")),
      recipientEmail: String(snap.get("recipientEmail")),
      senderName: String(snap.get("senderName")),
      message: snap.get("message") as string | undefined,
    };
  });
  if (!purchase) return false;

  try {
    await sendEmail({
      to: purchase.recipientEmail,
      subject: `${purchase.senderName} sent you a ${brand.name} gift card`,
      kind: "gift_card",
      ref: purchaseId,
      template: createElement(GiftCardEmail, {
        brandName: brand.name,
        recipientName: purchase.recipientName,
        senderName: purchase.senderName,
        ...(purchase.message ? { message: purchase.message } : {}),
        amount: purchase.amount,
        code,
        expiresOn: longDate.format(expiresAt),
        shopUrl: clientEnv.NEXT_PUBLIC_SITE_URL,
      }),
    });
    return true;
  } catch (error) {
    logger.error("giftcards.delivery_failed", { purchaseId, error });
    const batch = db.batch();
    batch.update(db.collection("giftCards").doc(cardId), { status: "disabled" });
    batch.update(ref, { status: "paid" });
    await batch.commit();
    return false;
  }
}

/** Delivers paid gift cards whose delivery date has arrived. */
export async function deliverScheduledGiftCards(now = new Date()): Promise<number> {
  const due = await purchases()
    .where("status", "==", "paid")
    .where("deliverOn", "<=", businessDate(now))
    .limit(100)
    .get();
  let delivered = 0;
  for (const doc of due.docs) {
    if (await deliverGiftCard(doc.id, now)) delivered += 1;
  }
  return delivered;
}
