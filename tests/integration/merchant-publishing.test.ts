import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.60" }),
  cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }),
}));

const { getFirebaseAdmin } = await import("@/lib/firebase/admin");
const shops = await import("@/lib/merchant/shop-service");
const products = await import("@/lib/merchant/product-service");
const publishing = await import("@/lib/merchant/publishing/publish");
const admin = await import("@/lib/merchant/admin-service");
const media = await import("@/lib/merchant/media/media-service");
const { buildMatrix } = await import("@/lib/merchant/variants/matrix");

const { db } = getFirebaseAdmin();
const bucket = () => getFirebaseAdmin().storage.bucket();
const run = randomUUID().slice(0, 8);
const vendorId = `v-pub-${run}`;
const now = new Date("2026-10-21T12:00:00Z");
const session = {
  uid: `u-${run}`,
  email: `pub-${run}@example.com`,
  role: "vendor" as const,
  vendorId,
};
const actor = { session, vendorId };
const reviewer = { uid: "admin-uid", role: "admin" as const, email: "admin@texora.test" };

let shopId = "";
let warehouse = "";
const slug = `northwind-${run}`;

async function photo() {
  const bytes = await sharp({
    create: { width: 1200, height: 1600, channels: 3, background: "#5e3a5c" },
  })
    .png()
    .toBuffer();
  const uploadId = randomUUID();
  await bucket()
    .file(media.tmpPath(vendorId, shopId, uploadId))
    .save(bytes, { contentType: "image/png" });
  const result = await media.finalizeUpload(
    { vendorId, ownerUid: session.uid, shopId, kind: "productImage", uploadId },
    now,
  );
  if (result.kind !== "image") throw new Error("expected image");
  return result.image;
}

/** A complete product draft ready to submit. */
async function readyProduct(name: string, skuPrefix: string): Promise<string> {
  const productId = await products.createDraft(actor, shopId, now);
  const draft = await products.getOwnedDraftRecord(actor, productId);
  const image = await photo();
  const matrix = buildMatrix(
    { colors: ["plum"], fits: ["regular"], sizes: ["S", "M"], excluded: new Set() },
    [],
    [],
    { skuPrefix, price: 9800, compareAtPrice: null, weightGrams: 300, lowStockThreshold: 2 },
  ).rows.map((r) => ({ ...r, stock: { [warehouse]: 10 } }));
  await products.saveDraft(
    actor,
    productId,
    draft.version,
    {
      ...draft.parsed,
      name,
      description: "A soft knit made in small batches in Portland.",
      categoryKey: "women/dresses",
      styleId: skuPrefix,
      attributes: { length: "midi", sleeve: "long" },
      composition: [{ material: "merino", percent: 100 }],
      colors: [
        {
          code: "plum",
          name: "Plum",
          family: "purple",
          swatch: "#5e3a5c",
          images: [{ ...image, alt: `${name} in Plum, front`, altConfirmed: true }],
        },
      ],
      fits: ["regular"],
      sizes: ["S", "M"],
      matrix,
    },
    now,
  );
  return productId;
}

const productDoc = async (id: string) => (await db.collection("products").doc(id).get()).data();
const draftDoc = async (id: string) => (await db.collection("productDrafts").doc(id).get()).data();

beforeAll(async () => {
  await db
    .collection("merchants")
    .doc(vendorId)
    .set({
      ownerUid: session.uid,
      email: session.email,
      username: `pub${run}`,
      displayName: "Ada",
      status: "active",
      emailVerified: true,
      trustLevel: "standard",
      shopIds: [],
      createdAt: now,
      updatedAt: now,
    });
  const shop = await shops.saveShopBasics(
    actor,
    {
      name: "Northwind Knits",
      slug,
      tagline: "Knitwear from Portland",
      description: "",
      shopType: "designer",
      departments: ["women"],
      categoryKeys: ["women/dresses"],
    },
    undefined,
    now,
  );
  shopId = shop.id;
  warehouse = (
    await shops.saveLocation(
      actor,
      {
        shopId,
        name: "Studio",
        types: ["ship_from"],
        address: { line1: "5 Mill St", city: "Portland", region: "OR", postalCode: "97209" },
        hours: [],
        specialHours: [],
      },
      now,
    )
  ).id;
  // Submitted shop (the onboarding checks are covered by merchant-shop tests).
  await db.collection("shops").doc(shopId).update({ status: "pending_review" });
});

afterAll(async () => {
  for (const coll of ["products", "productDrafts"]) {
    const docs = await db.collection(coll).where("shopId", "==", shopId).get();
    await Promise.all(docs.docs.map((d) => d.ref.delete()));
  }
  const variants = await db.collection("variants").where("shopId", "==", shopId).get();
  await Promise.all(variants.docs.map((d) => d.ref.delete()));
  const locs = await db.collection("shops").doc(shopId).collection("locations").get();
  await Promise.all(locs.docs.map((d) => d.ref.delete()));
  await db.collection("shopSlugs").doc(slug).delete();
  await db.collection("shops").doc(shopId).delete();
  await db.collection("merchants").doc(vendorId).delete();
  const [files] = await bucket().getFiles({ prefix: `merchant-media/${vendorId}/` });
  await Promise.all(files.map((f) => f.delete({ ignoreNotFound: true })));
});

let productId = "";
/** A live merchant product (published by the trusted-merchant test). */
let liveProductId = "";

describe("review and publishing", () => {
  it("submits a product for review and emails the team", async () => {
    productId = await readyProduct("Merino Wrap Dress", `NW-${run}`);
    expect(await publishing.submitProduct(actor, productId, now)).toEqual({ status: "in_review" });
    expect(await productDoc(productId)).toBeUndefined();
    const outbox = await db.collection("emailOutbox").where("ref", "==", productId).get();
    expect(outbox.docs.map((d) => d.get("kind"))).toContain("merchant_product_review_request");
  });

  it("approval publishes it, but it stays hidden until the shop is approved", async () => {
    await publishing.reviewProduct(reviewer, productId, "approve", [], now);
    expect(await draftDoc(productId)).toMatchObject({ status: "live", published: true });
    const product = await productDoc(productId);
    expect(product).toMatchObject({
      status: "draft",
      shopId,
      vendorId,
      shop: { slug, name: "Northwind Knits" },
    });
    const variants = await db.collection("variants").where("productId", "==", productId).get();
    expect(variants.size).toBe(2);
    expect(variants.docs[0]?.get("stockByLocation")).toEqual({
      [`m_${shopId}_${warehouse}`]: 10,
      online: 10,
    });
  });

  it("approving the shop makes its live products visible", async () => {
    await admin.decideShop(reviewer, shopId, "approve", [], now);
    expect((await productDoc(productId))?.status).toBe("live");
  });

  it("reviews edits to a live product while the published version stays on sale", async () => {
    const draft = await products.getOwnedDraftRecord(actor, productId);
    await products.saveDraft(
      actor,
      productId,
      draft.version,
      { ...draft.parsed, name: "Merino Wrap Dress II" },
      now,
    );
    await publishing.submitProduct(actor, productId, now);
    expect((await draftDoc(productId))?.status).toBe("in_review");
    expect(await productDoc(productId)).toMatchObject({
      status: "live",
      name: "Merino Wrap Dress",
    });

    await publishing.reviewProduct(
      reviewer,
      productId,
      "changes",
      ["Show the back of the dress"],
      now,
    );
    expect(await draftDoc(productId)).toMatchObject({
      status: "changes_requested",
      reviewNotes: ["Show the back of the dress"],
    });
    expect((await productDoc(productId))?.status).toBe("live");
    await expect(
      publishing.reviewProduct(reviewer, productId, "changes", [], now),
    ).rejects.toMatchObject({
      code: "conflict",
    });
  });

  it("pushes stock edits to the live product straight away", async () => {
    const draft = await products.getOwnedDraftRecord(actor, productId);
    const key = draft.parsed.matrix[0]?.key ?? "";
    await products.updateDraftStock(actor, productId, key, warehouse, 3, now);
    await publishing.syncPublishedStock(productId, now);
    const sku = draft.parsed.matrix[0]?.sku ?? "";
    expect((await db.collection("variants").doc(sku).get()).get("stockByLocation.online")).toBe(3);
  });

  it("hides products when the shop is paused and shows them again on reinstatement", async () => {
    await expect(admin.decideShop(reviewer, shopId, "suspend", [], now)).rejects.toMatchObject({
      field: "reasons",
    });
    await admin.decideShop(reviewer, shopId, "suspend", ["Counterfeit report under review"], now);
    expect((await productDoc(productId))?.status).toBe("draft");
    await admin.decideShop(reviewer, shopId, "reinstate", [], now);
    expect((await productDoc(productId))?.status).toBe("live");
  });

  it("refuses a SKU another product already uses, at submission", async () => {
    const clashId = await readyProduct("Merino Tunic", `NW-${run}`);
    await expect(publishing.submitProduct(actor, clashId, now)).rejects.toMatchObject({
      message: expect.stringContaining("is already used by another product"),
    });
    expect((await draftDoc(clashId))?.status).toBe("draft");
  });

  it("trusted merchants publish directly, or on schedule", async () => {
    await admin.setTrustLevel(reviewer, vendorId, "trusted", now);
    const direct = await readyProduct("Merino Cardigan Dress", `NWC-${run}`);
    liveProductId = direct;
    expect(await publishing.submitProduct(actor, direct, now)).toEqual({ status: "live" });
    expect((await productDoc(direct))?.status).toBe("live");

    const later = await readyProduct("Merino Slip", `NWS-${run}`);
    const draft = await products.getOwnedDraftRecord(actor, later);
    await products.saveDraft(
      actor,
      later,
      draft.version,
      { ...draft.parsed, publishAt: "2026-11-01T09:00" },
      now,
    );
    expect(await publishing.submitProduct(actor, later, now)).toEqual({ status: "scheduled" });
    expect((await productDoc(later))?.status).toBe("scheduled");
    expect(
      await publishing.publishDueProducts(new Date("2026-11-02T00:00:00Z")),
    ).toBeGreaterThanOrEqual(1);
    expect((await productDoc(later))?.status).toBe("live");
  });

  it("unpublishing takes a product off sale", async () => {
    await publishing.unpublishProduct(actor, productId, now);
    expect(await draftDoc(productId)).toMatchObject({ status: "draft", published: false });
    expect((await productDoc(productId))?.status).toBe("draft");
  });

  it("keeps shop counters in step", async () => {
    const shop = (await db.collection("shops").doc(shopId).get()).data();
    // Live: cardigan dress + slip. Drafts: wrap dress and the tunic.
    expect(shop?.counters).toMatchObject({ live: 2, draft: 2, inReview: 0, changesRequested: 0 });
  });
});

describe("merchant orders", () => {
  const address = {
    firstName: "Grace",
    lastName: "Hopper",
    line1: "1 Navy Yard",
    city: "Arlington",
    region: "VA",
    postalCode: "22201",
    country: "US" as const,
    phone: "703 555 0100",
  };
  let orderId = "";
  let merchantSku = "";

  it("snapshots the merchant on order lines and lists the order for them only", async () => {
    const { placeOrder } = await import("@/lib/orders/place-order");
    const { generateSeed } = await import("../../scripts/seed/generate");
    const seed = generateSeed();
    const live = new Set(seed.products.filter((p) => p.status === "live").map((p) => p.id));
    const own = seed.variants.find(
      (v) => live.has(v.productId) && (v.stockByLocation.online ?? 0) > 3,
    );
    const merchantVariant = (
      await db.collection("variants").where("productId", "==", liveProductId).get()
    ).docs[0];
    if (!own || !merchantVariant) throw new Error("fixtures missing");
    merchantSku = merchantVariant.id;

    const placed = await placeOrder(
      {
        idempotencyKey: `it-merchant-order-${run}-padding`,
        email: "grace@example.com",
        lines: [
          { sku: own.sku, quantity: 1 },
          { sku: merchantSku, quantity: 2 },
        ],
        promoCodes: [],
        delivery: { method: "standard" },
        shippingAddress: address,
        billingAddress: address,
        paymentMethod: "cod",
      },
      null,
    );
    orderId = placed.orderId;
    const order = (await db.collection("orders").doc(orderId).get()).data();
    expect(order?.vendorIds).toEqual([vendorId]);
    const merchantLine = order?.lines.find((l: { sku: string }) => l.sku === merchantSku);
    expect(merchantLine).toMatchObject({
      vendorId,
      shopId,
      shopName: "Northwind Knits",
      quantity: 2,
    });
    expect(order?.lines.find((l: { sku: string }) => l.sku === own.sku).vendorId).toBeUndefined();

    const { listMerchantOrders, getMerchantOrder } = await import("@/lib/merchant/order-service");
    const list = await listMerchantOrders(vendorId, { limit: 10 });
    expect(list.items.map((o) => o.id)).toContain(orderId);
    const view = await getMerchantOrder(vendorId, orderId);
    expect(view?.lines.map((l) => l.sku)).toEqual([merchantSku]);
    expect(await getMerchantOrder("v-someone-else", orderId)).toBeNull();

    const outbox = await db.collection("emailOutbox").where("ref", "==", orderId).get();
    expect(outbox.docs.map((d) => d.get("kind"))).toEqual(
      expect.arrayContaining(["order_confirmation", "merchant_new_order"]),
    );
  });

  it("ships only the merchant's items and emails the customer", async () => {
    const { markShipped } = await import("@/lib/merchant/order-service");
    const other = { session: { ...session, uid: "x", vendorId: "v-other" }, vendorId: "v-other" };
    await expect(
      markShipped(other, orderId, { carrier: "UPS", trackingNumber: "1Z999" }, now),
    ).rejects.toMatchObject({
      code: "not_found",
    });
    const view = await markShipped(
      actor,
      orderId,
      { carrier: "UPS", trackingNumber: "1Z999AA" },
      now,
    );
    expect(view).toMatchObject({ status: "shipped", unshipped: [] });
    const order = (await db.collection("orders").doc(orderId).get()).data();
    // Texora's own line is still waiting, so the order is only partly shipped.
    expect(order?.status).toBe("partially_shipped");
    expect(order?.shipments).toHaveLength(1);
    expect(order?.shipments[0]).toMatchObject({ carrier: "UPS", skus: [merchantSku] });
    await expect(
      markShipped(actor, orderId, { carrier: "UPS", trackingNumber: "1Z999AA" }, now),
    ).rejects.toMatchObject({
      code: "conflict",
    });
    const outbox = await db.collection("emailOutbox").where("ref", "==", orderId).get();
    expect(outbox.docs.map((d) => d.get("kind"))).toContain("merchant_shipped");
  });
});
