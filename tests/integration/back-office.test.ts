import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }),
  headers: async () => new Headers(),
}));

const { getFirebaseAdmin } = await import("@/lib/firebase/admin");
const { getOrder } = await import("@/lib/data/orders");
const orderService = await import("@/lib/admin/order-service");
const returnService = await import("@/lib/admin/return-service");
const catalog = await import("@/lib/admin/catalog-service");
const { adjustStock } = await import("@/lib/admin/inventory-service");
const merch = await import("@/lib/admin/merch-service");
const people = await import("@/lib/admin/people-service");
const site = await import("@/lib/admin/site-service");
const { requestReturn } = await import("@/lib/returns/request-return");
const { generateSeed } = await import("../../scripts/seed/generate");
import type { Session } from "@/lib/auth/session";
import type { Role } from "@/lib/auth/rbac";

const seed = generateSeed();
const { db } = getFirebaseAdmin();
const as = (role: Role): Session => ({
  uid: `seed-${role}`,
  email: `${role.replace(/_/g, "-")}@texora.test`,
  role,
  vendorId: null,
});
const admin = as("admin");
const agent = as("customer_service");

let n = 0;
/** A fresh copy of a seeded order, so tests never share state. */
async function cloneOrder(from: string, overrides: Record<string, unknown> = {}): Promise<string> {
  const template = seed.orders.find((o) => o.id === from);
  if (!template) throw new Error(`No seed order ${from}`);
  const { id: _id, ...fields } = template;
  n += 1;
  const id = `it-bo-${from}-${n}`;
  await db
    .collection("orders")
    .doc(id)
    .set({ ...fields, number: `TX-9${String(n).padStart(5, "0")}`, ...overrides });
  return id;
}
const stock = async (sku: string, location = "online") =>
  Number((await db.collection("variants").doc(sku).get()).get(`stockByLocation.${location}`) ?? 0);

describe("refunds", () => {
  it("holds customer service to the per-order limit and admins past it", async () => {
    const id = await cloneOrder("seed-order-delivered");
    const total = (await getOrder(id))?.totals.total ?? 0;

    await expect(orderService.refundOrder(agent, id, 30_000, "Too much")).rejects.toMatchObject({
      code: "limit_exceeded",
    });
    const first = await orderService.refundOrder(agent, id, 10_000, "Goodwill");
    // Pay on delivery: the money goes back by hand, and the refund says so.
    expect(first.manual).toBe(10_000);
    expect((await getOrder(id))?.status).toBe("partially_refunded");

    await orderService.refundOrder(admin, id, total - 10_000, "Rest");
    const done = await getOrder(id);
    expect(done?.status).toBe("refunded");
    await expect(orderService.refundOrder(admin, id, 1, "Again")).rejects.toMatchObject({
      code: "conflict",
    });
    const audit = await db
      .collection("auditLogs")
      .where("target.id", "==", id)
      .where("action", "==", "orders.refund")
      .get();
    expect(audit.size).toBe(2);
  });
});

describe("cancellation and fulfilment", () => {
  it("cancels an unshipped order and puts the stock back", async () => {
    const id = await cloneOrder("seed-order-placed");
    const order = await getOrder(id);
    const line = order?.lines[0];
    if (!line) throw new Error("no line");
    const before = await stock(line.sku);
    await orderService.cancelOrder(admin, id, "Customer asked");
    expect((await getOrder(id))?.status).toBe("cancelled");
    expect(await stock(line.sku)).toBe(before + line.quantity);
    await expect(orderService.cancelOrder(admin, id, "Twice")).rejects.toMatchObject({
      code: "conflict",
    });
  });

  it("ships in parcels, then delivers and captures pay-on-delivery", async () => {
    const id = await cloneOrder("seed-order-placed");
    const order = await getOrder(id);
    const [a, b] = order?.lines ?? [];
    if (!a || !b) throw new Error("expected two lines");
    await orderService.markProcessing(admin, id);
    await orderService.addShipment(admin, id, {
      carrier: "UPS",
      trackingNumber: "1Z1",
      skus: [a.sku],
    });
    expect((await getOrder(id))?.status).toBe("partially_shipped");
    await orderService.addShipment(admin, id, {
      carrier: "UPS",
      trackingNumber: "1Z2",
      skus: [b.sku],
    });
    expect((await getOrder(id))?.status).toBe("shipped");
    await orderService.markDelivered(admin, id);
    const delivered = await getOrder(id);
    expect(delivered?.status).toBe("delivered");
    expect(delivered?.shipments.every((s) => s.status === "delivered")).toBe(true);
    expect(delivered?.payments.find((p) => p.provider === "cod")?.status).toBe("captured");
  });

  it("refuses to ship items that aren't in the order", async () => {
    const id = await cloneOrder("seed-order-placed");
    await expect(
      orderService.addShipment(admin, id, { carrier: "UPS", trackingNumber: "1Z", skus: ["NOPE"] }),
    ).rejects.toMatchObject({ code: "conflict" });
  });
});

describe("returns in the back office", () => {
  it("restocks only resellable items and refunds the estimate", async () => {
    const id = await cloneOrder("seed-order-delivered");
    const order = await getOrder(id);
    const [a, b] = (order?.lines ?? []).filter((l) => !l.finalSale);
    if (!order || !a || !b) throw new Error("expected two returnable lines");
    const created = await requestReturn(order, {
      lines: [
        { sku: a.sku, quantity: 1, reason: "too_small" },
        { sku: b.sku, quantity: 1, reason: "damaged" },
      ],
      method: "mail",
      refundTo: "original",
    });
    const [beforeA, beforeB] = [await stock(a.sku), await stock(b.sku)];
    await returnService.receiveReturn(admin, created.returnId, {
      conditions: { [a.sku]: "resellable", [b.sku]: "damaged" },
      location: "online",
    });
    expect(await stock(a.sku)).toBe(beforeA + 1);
    expect(await stock(b.sku)).toBe(beforeB);

    const refunded = await returnService.refundReturn(admin, created.returnId);
    const record = (await db.collection("returns").doc(created.returnId).get()).data();
    expect(record).toMatchObject({ status: "refunded", refundAmount: refunded.amount });
    expect((await getOrder(id))?.refunds.some((r) => r.id === `return-${created.returnId}`)).toBe(
      true,
    );
  });

  it("issues store credit as an emailed gift card", async () => {
    const id = await cloneOrder("seed-order-delivered");
    const order = await getOrder(id);
    const line = order?.lines.find((l) => !l.finalSale);
    if (!order || !line) throw new Error("no line");
    const created = await requestReturn(order, {
      lines: [{ sku: line.sku, quantity: 1, reason: "changed_mind" }],
      method: "store",
      storeId: "soho",
      refundTo: "store_credit",
    });
    await returnService.receiveReturn(admin, created.returnId, {
      conditions: {},
      location: "soho",
    });
    const result = await returnService.refundReturn(admin, created.returnId);
    expect(result.storeCreditLast4).toMatch(/^[A-Z0-9]{4}$/);
    const refund = (await getOrder(id))?.refunds.find((r) => r.id === `return-${created.returnId}`);
    expect(refund?.storeCredit).toBe(true);
    const mail = await db.collection("emailOutbox").where("kind", "==", "store_credit").get();
    expect(mail.size).toBeGreaterThan(0);
  });
});

describe("catalog and pricing", () => {
  const variant = seed.variants.find((v) => v.compareAtPrice === undefined);
  if (!variant) throw new Error("no full-price variant");

  it("markdowns update the product's price range and sale badge", async () => {
    await catalog.setVariantPrice(
      as("pricing_manager"),
      variant.sku,
      5_000,
      9_000,
      "Test markdown",
    );
    let product = (await db.collection("products").doc(variant.productId).get()).data();
    expect(product?.priceRange.compareAtMax).toBe(9_000);
    expect(product?.badges).toContain("sale");

    await catalog.setVariantPrice(
      as("pricing_manager"),
      variant.sku,
      variant.price,
      null,
      "Back to full",
    );
    product = (await db.collection("products").doc(variant.productId).get()).data();
    const others = seed.variants.filter(
      (v) => v.productId === variant.productId && v.compareAtPrice !== undefined,
    );
    if (others.length === 0) expect(product?.badges).not.toContain("sale");
  });

  it("price requests need someone else to approve them", async () => {
    const merchandiser = as("merchandiser");
    const requestId = await catalog.requestPriceChange(merchandiser, {
      sku: variant.sku,
      price: variant.price + 500,
      compareAtPrice: null,
      reason: "Cost increase",
    });
    await expect(
      catalog.decidePriceChange(merchandiser, requestId, "approved"),
    ).rejects.toMatchObject({
      code: "forbidden",
    });
    await catalog.decidePriceChange(as("pricing_manager"), requestId, "approved");
    expect(Number((await db.collection("variants").doc(variant.sku).get()).get("price"))).toBe(
      variant.price + 500,
    );
  });

  it("imports CSV row by row", async () => {
    const product = seed.products.find((p) => p.status === "live");
    if (!product) throw new Error("no product");
    const result = await catalog.importProductsCsv(
      as("merchandiser"),
      `id,name,status\n${product.id},Renamed by CSV,\nnope,Missing,\n${product.id},,archived\n`,
      { canPublish: false },
    );
    expect(result.updated).toBe(1);
    expect(result.errors.map((e) => e.row)).toEqual([3, 4]);
    expect((await db.collection("products").doc(product.id).get()).get("name")).toBe(
      "Renamed by CSV",
    );
  });
});

describe("inventory", () => {
  it("adjusts stock with a reason and never goes below zero", async () => {
    const v = seed.variants[0];
    if (!v) throw new Error("no variant");
    const before = await stock(v.sku);
    await expect(
      adjustStock(admin, {
        sku: v.sku,
        location: "online",
        delta: -(before + 1),
        reason: "damaged",
      }),
    ).rejects.toMatchObject({ code: "conflict" });
    const result = await adjustStock(admin, {
      sku: v.sku,
      location: "online",
      delta: 5,
      reason: "received",
    });
    expect(result).toEqual({ before, after: before + 5 });
    const history = await db.collection("inventoryAdjustments").where("sku", "==", v.sku).get();
    expect(history.docs.some((d) => d.get("reason") === "received")).toBe(true);
  });
});

describe("reviews, loyalty and promotions", () => {
  it("approving a review updates the product's rating count", async () => {
    const pending = seed.reviews.find((r) => r.status === "pending");
    if (!pending) throw new Error("no pending review");
    const count = (await db.collection("products").doc(pending.productId).get()).get("ratingCount");
    await merch.moderateReview(as("merchandiser"), pending.id, "approved");
    expect((await db.collection("products").doc(pending.productId).get()).get("ratingCount")).toBe(
      count + 1,
    );
  });

  it("adjusts member points and refuses non-members", async () => {
    const balance = await people.adjustLoyalty(agent, "seed-loyalty_member", 250, "Goodwill");
    expect(balance).toBeGreaterThanOrEqual(250);
    await expect(people.adjustLoyalty(agent, "seed-customer", 100, "x")).rejects.toMatchObject({
      code: "conflict",
    });
    await expect(
      people.adjustLoyalty(agent, "seed-loyalty_member", -10_000_000, "Too many"),
    ).rejects.toMatchObject({ code: "conflict" });
  });

  it("creates a promotion and generates unique codes", async () => {
    const id = await merch.savePromotion(as("pricing_manager"), {
      name: "IT Flash Sale",
      type: "percent",
      value: 20,
      conditions: {},
      automatic: false,
      stackable: false,
      priority: 5,
      audience: "everyone",
      schedule: {},
      active: true,
    });
    const codes = await merch.generatePromoCodes(as("pricing_manager"), id, {
      prefix: "ITFLASH",
      count: 25,
    });
    expect(new Set(codes).size).toBe(25);
    expect((await merch.listPromoCodes(id)).length).toBe(25);
  });
});

describe("users, settings and content", () => {
  it("invites staff with a role, and protects self-changes", async () => {
    const { uid } = await people.inviteStaff(admin, {
      email: "new.agent@texora.test",
      firstName: "New",
      lastName: "Agent",
      role: "customer_service",
    });
    const user = await getFirebaseAdmin().auth.getUser(uid);
    expect(user.customClaims?.role).toBe("customer_service");
    await expect(people.changeRole(admin, admin.uid, "super_admin")).rejects.toMatchObject({
      code: "forbidden",
    });
    await expect(people.revokeSessions(admin, admin.uid)).rejects.toMatchObject({
      code: "conflict",
    });
    const invites = await db.collection("emailOutbox").where("kind", "==", "staff_invite").get();
    expect(invites.size).toBeGreaterThan(0);
  });

  it("validates settings before saving", async () => {
    const settings = seed.settings;
    await expect(
      site.updateSettings(admin, {
        freeShippingThreshold: settings.freeShippingThreshold,
        shippingRates: settings.shippingRates,
        refundLimits: settings.refundLimits,
        reservationMinutes: settings.reservationMinutes,
        loyalty: { ...settings.loyalty, tierThresholds: { enthusiast: 100_000, icon: 50_000 } },
        features: settings.features,
      }),
    ).rejects.toMatchObject({ code: "conflict" });
  });

  it("never saves a page with an invalid module", async () => {
    const page = await site.getPage("home");
    if (!page) throw new Error("no home page");
    const broken = [{ ...page.modules[0], data: { headline: "" } }];
    await expect(
      site.savePage(admin, "home", {
        title: page.title,
        status: page.status,
        seo: page.seo,
        modules: broken as never,
      }),
    ).rejects.toMatchObject({ code: "conflict" });
    await site.savePage(admin, "home", {
      title: page.title,
      status: page.status,
      seo: page.seo,
      modules: [...page.modules, site.moduleTemplate("storyBlock")],
    });
    expect((await site.getPage("home"))?.modules.length).toBe(page.modules.length + 1);
  });
});
