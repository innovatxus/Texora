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
