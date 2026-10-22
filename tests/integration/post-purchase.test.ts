import { describe, expect, it, vi } from "vitest";

// Guest context: no session cookie.
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }),
  headers: async () => new Headers(),
}));

const { getFirebaseAdmin } = await import("@/lib/firebase/admin");
const { getOrder, getOrderByNumberAndEmail } = await import("@/lib/data/orders");
const { listReturnsForOrder } = await import("@/lib/data/returns");
const { requestReturn } = await import("@/lib/returns/request-return");
const { creditOrderPoints } = await import("@/lib/loyalty/credit");
const { processAlerts, cancelAlerts } = await import("@/lib/notifications/process");
const { settleGiftCardPurchase, deliverScheduledGiftCards } =
  await import("@/lib/giftcards/service");
const { getGiftCardByCode } = await import("@/lib/data/promotions");
const { generateSeed } = await import("../fixtures/seed/generate");

const seed = generateSeed();
const { db } = getFirebaseAdmin();

async function outbox(kind: string, ref: string) {
  const snap = await db
    .collection("emailOutbox")
    .where("kind", "==", kind)
    .where("ref", "==", ref)
    .get();
  return snap.docs.map((d) => d.data());
}

describe("order lookup", () => {
  it("needs both the number and the email", async () => {
    const order = seed.orders[0];
    if (!order) throw new Error("seed has no orders");
    expect((await getOrderByNumberAndEmail(order.number, seed.demoOrderEmail))?.id).toBe(order.id);
    expect(await getOrderByNumberAndEmail(order.number, "someone@else.test")).toBeNull();
    // Case and spacing in what people type don't matter.
    expect(
      (await getOrderByNumberAndEmail(` ${order.number.toLowerCase()} `, "GUEST@texora.test"))?.id,
    ).toBe(order.id);
  });
});

describe("returns", () => {
  it("approves a return inside the policy, with a label and an email", async () => {
    const order = await getOrder("seed-order-delivered");
    if (!order) throw new Error("seed order missing");
    const line = order.lines.find((l) => !l.finalSale && l.quantity >= 2);
    if (!line) throw new Error("expected a multi-unit line");

    const created = await requestReturn(order, {
      lines: [{ sku: line.sku, quantity: 1, reason: "too_small" }],
      method: "mail",
      refundTo: "original",
    });
    expect(created.number).toBe(`${order.number}-R1`);

    const [record] = await listReturnsForOrder(order.id);
    expect(record).toMatchObject({
      status: "approved",
      method: "mail",
      email: order.email,
      refundEstimate: Math.floor(line.lineTotal / line.quantity),
    });
    expect(record?.label?.code).toBe(created.number);
    expect(await outbox("return_instructions", created.returnId)).toHaveLength(1);
  });

  it("won't return more units than were bought", async () => {
    const order = await getOrder("seed-order-delivered");
    const line = order?.lines.find((l) => !l.finalSale && l.quantity >= 2);
    if (!order || !line) throw new Error("seed order missing");
    // One unit is already on the return above.
    await expect(
      requestReturn(order, {
        lines: [{ sku: line.sku, quantity: line.quantity, reason: "too_small" }],
        method: "mail",
        refundTo: "original",
      }),
    ).rejects.toMatchObject({ code: "conflict" });
  });

  it("refuses final-sale items", async () => {
    const order = await getOrder("seed-order-delivered");
    const finalSale = order?.lines.find((l) => l.finalSale);
    if (!order || !finalSale) return; // The seed may not include a final-sale item.
    await expect(
      requestReturn(order, {
        lines: [{ sku: finalSale.sku, quantity: 1, reason: "other" }],
        method: "mail",
        refundTo: "original",
      }),
    ).rejects.toMatchObject({ code: "conflict" });
  });

  it("waits until an order has shipped", async () => {
    const order = await getOrder("seed-order-placed");
    const line = order?.lines[0];
    if (!order || !line) throw new Error("seed order missing");
    await expect(
      requestReturn(order, {
        lines: [{ sku: line.sku, quantity: 1, reason: "changed_mind" }],
        method: "mail",
        refundTo: "original",
      }),
    ).rejects.toMatchObject({ code: "conflict" });
  });

  it("needs a store that takes returns for in-store drop-off", async () => {
    const order = await getOrder("seed-order-shipped");
    const line = order?.lines[0];
    if (!order || !line) throw new Error("seed order missing");
    await expect(
      requestReturn(order, {
        lines: [{ sku: line.sku, quantity: 1, reason: "too_large" }],
        method: "store",
        storeId: "nowhere",
        refundTo: "store_credit",
      }),
    ).rejects.toMatchObject({ code: "conflict" });

    const created = await requestReturn(order, {
      lines: [{ sku: line.sku, quantity: 1, reason: "too_large" }],
      method: "store",
      storeId: "soho",
      refundTo: "store_credit",
    });
    const [record] = await listReturnsForOrder(order.id);
    expect(record).toMatchObject({ id: created.returnId, storeId: "soho", method: "store" });
    expect(record?.label).toBeUndefined();
  });
});

describe("loyalty", () => {
  it("credits an order's points once and recalculates the tier", async () => {
    const uid = "seed-loyalty_member";
    const before = (await db.collection("users").doc(uid).get()).get("loyalty") as {
      points: number;
      periodSpend: number;
    };
    const template = seed.orders[0];
    if (!template) throw new Error("seed has no orders");
    const { id: _id, ...fields } = template;
    const ref = db.collection("orders").doc("it-loyalty-order");
    await ref.set({
      ...fields,
      number: "TX-990001",
      userId: uid,
      status: "placed",
      totals: {
        subtotal: 120_000,
        discount: 0,
        shipping: 0,
        tax: 0,
        giftCard: 0,
        rewards: 0,
        total: 120_000,
      },
      loyaltyPointsEarned: 15_000,
    });

    expect(await creditOrderPoints(ref.id)).toBe(15_000);
    expect(await creditOrderPoints(ref.id)).toBe(0);

    const after = (await db.collection("users").doc(uid).get()).get("loyalty") as {
      points: number;
      periodSpend: number;
      tier: string;
    };
    expect(after.points).toBe(before.points + 15_000);
    expect(after.periodSpend).toBe(before.periodSpend + 120_000);
    // $640 + $1,200 crosses the $1,500 Icon threshold.
    expect(after.tier).toBe("icon");
    const ledger = await db.collection("users").doc(uid).collection("loyaltyLedger").get();
    expect(ledger.docs.some((d) => d.get("orderId") === ref.id)).toBe(true);
  });

  it("skips guests", async () => {
    expect(await creditOrderPoints("seed-order-delivered")).toBe(0);
  });
});

describe("product alerts", () => {
  const live = new Set(seed.products.filter((p) => p.status === "live").map((p) => p.id));
  const inStock = seed.variants.find(
    (v) => live.has(v.productId) && (v.stockByLocation.online ?? 0) > 0,
  );
  const soldOut = seed.variants.find(
    (v) => live.has(v.productId) && (v.stockByLocation.online ?? 0) === 0,
  );
  const product = seed.products.find((p) => p.id === inStock?.productId);

  it("sends due alerts once and leaves the rest pending", async () => {
    if (!inStock || !soldOut || !product) throw new Error("seed lacks suitable variants");
    const alerts = db.collection("notifications");
    await Promise.all([
      alerts.doc("it-bis-due").set({
        type: "back_in_stock",
        email: "alerts@example.com",
        productId: inStock.productId,
        sku: inStock.sku,
        status: "pending",
        createdAt: new Date(),
      }),
      alerts.doc("it-bis-waiting").set({
        type: "back_in_stock",
        email: "alerts@example.com",
        productId: soldOut.productId,
        sku: soldOut.sku,
        status: "pending",
        createdAt: new Date(),
      }),
      alerts.doc("it-pd-due").set({
        type: "price_drop",
        email: "alerts@example.com",
        productId: product.id,
        priceAtSubscribe: product.priceRange.min + 1_000,
        status: "pending",
        createdAt: new Date(),
      }),
      alerts.doc("it-pd-waiting").set({
        type: "price_drop",
        email: "alerts@example.com",
        productId: product.id,
        priceAtSubscribe: product.priceRange.min,
        status: "pending",
        createdAt: new Date(),
      }),
    ]);

    const run = await processAlerts();
    expect(run.sent).toBeGreaterThanOrEqual(2);
    const status = async (id: string) => (await alerts.doc(id).get()).get("status");
    expect(await status("it-bis-due")).toBe("sent");
    expect(await status("it-pd-due")).toBe("sent");
    expect(await status("it-bis-waiting")).toBe("pending");
    expect(await status("it-pd-waiting")).toBe("pending");
    expect(await outbox("back_in_stock", "it-bis-due")).toHaveLength(1);

    // A second run sends nothing new for these.
    await processAlerts();
    expect(await outbox("back_in_stock", "it-bis-due")).toHaveLength(1);
  });

  it("cancels pending alerts for an email", async () => {
    expect(await cancelAlerts("alerts@example.com")).toBe(2);
    expect((await db.collection("notifications").doc("it-bis-waiting").get()).exists).toBe(false);
    expect((await db.collection("notifications").doc("it-bis-due").get()).exists).toBe(true);
  });
});

describe("e-gift cards", () => {
  const purchase = (id: string, deliverOn: string) =>
    db.collection("giftCardPurchases").doc(id).set({
      amount: 5_000,
      currency: "USD",
      purchaserEmail: "buyer@example.com",
      senderName: "Sam",
      recipientName: "Alex",
      recipientEmail: "alex@example.com",
      message: "Happy birthday",
      deliverOn,
      status: "pending_payment",
      userId: null,
      createdAt: new Date(),
    });

  it("issues and emails a card when payment succeeds on the delivery date", async () => {
    const now = new Date(Date.UTC(2026, 9, 19, 15));
    await purchase("it-gc-today", "2026-10-19");
    expect(await settleGiftCardPurchase("it-gc-today", "succeeded", now)).toBe("settled");
    // Webhooks can repeat: the second delivery is ignored.
    expect(await settleGiftCardPurchase("it-gc-today", "succeeded", now)).toBe("ignored");

    const doc = (await db.collection("giftCardPurchases").doc("it-gc-today").get()).data();
    expect(doc).toMatchObject({ status: "delivered" });
    const card = await db.collection("giftCards").doc(String(doc?.giftCardId)).get();
    expect(card.data()).toMatchObject({ balance: 5_000, status: "active" });

    const [email] = await outbox("gift_card", "it-gc-today");
    const code = /TXGC(-[A-Z0-9]{4}){3}/.exec(String(email?.text))?.[0];
    expect(code).toBeDefined();
    expect((await getGiftCardByCode(code ?? ""))?.balance).toBe(5_000);
    expect(await outbox("gift_card_receipt", "it-gc-today")).toHaveLength(1);
  });

  it("holds a scheduled card until its date", async () => {
    await purchase("it-gc-later", "2026-12-24");
    await settleGiftCardPurchase("it-gc-later", "succeeded", new Date(Date.UTC(2026, 9, 19, 15)));
    expect((await db.collection("giftCardPurchases").doc("it-gc-later").get()).get("status")).toBe(
      "paid",
    );
    await deliverScheduledGiftCards(new Date(Date.UTC(2026, 11, 23, 15)));
    expect((await db.collection("giftCardPurchases").doc("it-gc-later").get()).get("status")).toBe(
      "paid",
    );
    await deliverScheduledGiftCards(new Date(Date.UTC(2026, 11, 24, 15)));
    expect((await db.collection("giftCardPurchases").doc("it-gc-later").get()).get("status")).toBe(
      "delivered",
    );
  });

  it("cancels the purchase when payment fails", async () => {
    await purchase("it-gc-failed", "2026-10-19");
    await settleGiftCardPurchase("it-gc-failed", "failed");
    expect((await db.collection("giftCardPurchases").doc("it-gc-failed").get()).get("status")).toBe(
      "cancelled",
    );
    expect(await outbox("gift_card", "it-gc-failed")).toHaveLength(0);
  });
});
