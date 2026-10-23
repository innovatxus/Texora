import { beforeEach, describe, expect, it, vi } from "vitest";

// Guest checkout: no session cookie.
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }),
  headers: async () => new Headers(),
}));

const { getFirebaseAdmin } = await import("@/lib/firebase/admin");
const { placeOrder } = await import("@/lib/orders/place-order");
const { releaseExpiredReservations } = await import("@/lib/orders/payments");
const { verifyOrderAccessToken } = await import("@/lib/orders/token");
const { generateSeed } = await import("../fixtures/seed/generate");

const seed = generateSeed();
const { db } = getFirebaseAdmin();

/** A live variant with plenty of online stock. */
function pickVariant(minStock = 5, skip: string[] = []) {
  const live = new Set(seed.products.filter((p) => p.status === "live").map((p) => p.id));
  const variant = seed.variants.find(
    (v) =>
      live.has(v.productId) && (v.stockByLocation.online ?? 0) >= minStock && !skip.includes(v.sku),
  );
  if (!variant) throw new Error("No suitable variant in the seed");
  return variant;
}

const address = {
  firstName: "Ada",
  lastName: "Lovelace",
  line1: "12 Brazil Street",
  city: "Zamalek",
  region: "C",
  postalCode: "11211",
  country: "EG" as const,
  phone: "010 1234 5678",
};

let counter = 0;
const key = () => `it-order-${Date.now()}-${++counter}-padding`;

async function onlineStock(sku: string): Promise<number> {
  return Number((await db.collection("variants").doc(sku).get()).get("stockByLocation.online"));
}

function order(sku: string, quantity: number, extra: Record<string, unknown> = {}) {
  return {
    idempotencyKey: key(),
    email: "guest@example.com",
    lines: [{ sku, quantity }],
    promoCodes: [],
    delivery: { method: "standard" as const },
    shippingAddress: address,
    billingAddress: address,
    paymentMethod: "cod" as const,
    ...extra,
  };
}

beforeEach(() => {
  counter += 1;
});

describe("placeOrder", () => {
  it("places a cash-on-delivery order, decrements stock and numbers it", async () => {
    const variant = pickVariant(6);
    const before = await onlineStock(variant.sku);

    const result = await placeOrder(order(variant.sku, 2), null);
    expect(result).toMatchObject({ status: "placed", payment: { kind: "cod" } });
    expect(result.number).toMatch(/^TX-\d{6}$/);
    expect(verifyOrderAccessToken(result.orderId, result.accessToken)).toBe(true);
    expect(await onlineStock(variant.sku)).toBe(before - 2);

    const saved = (await db.collection("orders").doc(result.orderId).get()).data();
    expect(saved).toMatchObject({ status: "placed", email: "guest@example.com", userId: null });
    // Line snapshot keeps the price and name at the time of purchase.
    expect(saved?.lines[0]).toMatchObject({
      sku: variant.sku,
      quantity: 2,
      unitPrice: variant.price,
    });
    expect(saved?.totals.total).toBeGreaterThan(0);

    const email = await db.collection("emailOutbox").where("ref", "==", result.orderId).get();
    expect(email.size).toBe(1);
    expect(email.docs[0]?.get("subject")).toContain(result.number);
  });

  it("returns the same order for a repeated idempotency key", async () => {
    const variant = pickVariant(6);
    const input = order(variant.sku, 1);
    const first = await placeOrder(input, null);
    const before = await onlineStock(variant.sku);
    const second = await placeOrder(input, null);
    expect(second.orderId).toBe(first.orderId);
    expect(await onlineStock(variant.sku)).toBe(before);
  });

  it("numbers orders sequentially", async () => {
    const variant = pickVariant(6);
    const a = await placeOrder(order(variant.sku, 1), null);
    const b = await placeOrder(order(variant.sku, 1), null);
    expect(Number(b.number.slice(3))).toBe(Number(a.number.slice(3)) + 1);
  });

  it("refuses to oversell and leaves stock untouched", async () => {
    // A line is capped at 10, so pick a variant holding fewer than 10.
    const live = new Set(seed.products.filter((p) => p.status === "live").map((p) => p.id));
    const variant = seed.variants.find(
      (v) =>
        live.has(v.productId) &&
        (v.stockByLocation.online ?? 0) >= 1 &&
        (v.stockByLocation.online ?? 0) < 9,
    );
    if (!variant) throw new Error("No low-stock variant in the seed");
    const stock = await onlineStock(variant.sku);
    await expect(placeOrder(order(variant.sku, stock + 1), null)).rejects.toMatchObject({
      code: "conflict",
    });
    expect(await onlineStock(variant.sku)).toBe(stock);
  });

  it("debits a gift card that covers part of the order", async () => {
    const card = await db
      .collection("giftCards")
      .doc(seed.giftCards[0]?.id ?? "")
      .get();
    const balance = Number(card.get("balance"));
    const variant = pickVariant(3);
    const result = await placeOrder(
      order(variant.sku, 1, { giftCardCode: seed.demoGiftCardCode }),
      null,
    );
    const saved = (await db.collection("orders").doc(result.orderId).get()).data();
    const used = Number(saved?.totals.giftCard);
    expect(used).toBeGreaterThan(0);
    expect(Number((await card.ref.get()).get("balance"))).toBe(balance - used);
  });

  it("releases stock held by an expired card reservation", async () => {
    const variant = pickVariant(4);
    const before = await onlineStock(variant.sku);
    // Simulate a card order whose payment never completed.
    const ref = db.collection("orders").doc();
    await db.runTransaction(async (tx) => {
      tx.update(db.collection("variants").doc(variant.sku), {
        "stockByLocation.online": before - 1,
      });
      tx.create(db.collection("inventoryReservations").doc(), {
        sku: variant.sku,
        location: "online",
        quantity: 1,
        cartId: ref.id,
        orderId: ref.id,
        expiresAt: new Date(Date.now() - 60_000),
        createdAt: new Date(),
      });
      tx.create(ref, {
        status: "pending_payment",
        payments: [{ provider: "paymob", ref: "pi_test", amount: 100, status: "pending" }],
      });
    });

    expect(await releaseExpiredReservations()).toBeGreaterThanOrEqual(1);
    expect(await onlineStock(variant.sku)).toBe(before);
    expect((await ref.get()).get("status")).toBe("cancelled");
  });
});
