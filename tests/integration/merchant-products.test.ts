import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.50" }),
  cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }),
}));

const { getFirebaseAdmin } = await import("@/lib/firebase/admin");
const shops = await import("@/lib/merchant/shop-service");
const products = await import("@/lib/merchant/product-service");
const media = await import("@/lib/merchant/media/media-service");
const { getShop } = await import("@/lib/merchant/repositories/shops");
const { getMedia } = await import("@/lib/merchant/repositories/media");
const { buildMatrix } = await import("@/lib/merchant/variants/matrix");

const { db } = getFirebaseAdmin();
const bucket = () => getFirebaseAdmin().storage.bucket();
const run = randomUUID().slice(0, 8);
const vendorId = `v-prod-${run}`;
const now = new Date("2026-10-21T10:00:00Z");
const session = { uid: `u-${run}`, email: `${run}@example.com`, role: "vendor" as const, vendorId };
const actor = { session, vendorId };
const other = {
  session: { ...session, uid: "other", vendorId: "v-someone-else" },
  vendorId: "v-someone-else",
};

let shopId = "";
let warehouse = "";

async function image(): Promise<{ id: string; url: string }> {
  const bytes = await sharp({
    create: { width: 1200, height: 1600, channels: 3, background: "#1d566a" },
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
  return { id: result.image.mediaId, url: result.image.url };
}

beforeAll(async () => {
  await db
    .collection("merchants")
    .doc(vendorId)
    .set({
      ownerUid: session.uid,
      email: session.email,
      username: `prod${run}`,
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
      name: "Harbour Goods",
      slug: `harbour-${run}`,
      description: "",
      shopType: "brand",
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
        name: "Warehouse",
        types: ["ship_from"],
        address: {
          line1: "Borg El Arab Industrial Zone",
          city: "Borg El Arab",
          region: "ALX",
          postalCode: "21934",
        },
        hours: [],
        specialHours: [],
      },
      now,
    )
  ).id;
});

afterAll(async () => {
  const drafts = await db.collection("productDrafts").where("shopId", "==", shopId).get();
  await Promise.all(drafts.docs.map((d) => d.ref.delete()));
  const locs = await db.collection("shops").doc(shopId).collection("locations").get();
  await Promise.all(locs.docs.map((d) => d.ref.delete()));
  await db.collection("shopSlugs").doc(`harbour-${run}`).delete();
  await db.collection("shops").doc(shopId).delete();
  await db.collection("merchants").doc(vendorId).delete();
  const [files] = await bucket().getFiles({ prefix: `merchant-media/${vendorId}/` });
  await Promise.all(files.map((f) => f.delete({ ignoreNotFound: true })));
});

/** A filled-in draft: one colour with a photo, two sizes, priced and stocked. */
async function filledData(
  base: Awaited<ReturnType<typeof products.getOwnedDraftRecord>>["parsed"],
) {
  const photo = await image();
  const data = {
    ...base,
    name: "Linen Midi Dress",
    categoryKey: "women/dresses",
    styleId: "HARB-DRESS-01",
    colors: [
      {
        code: "navy",
        name: "Navy",
        family: "blue" as const,
        swatch: "#1f2a44",
        images: [
          {
            mediaId: photo.id,
            url: photo.url,
            alt: "Linen Midi Dress in Navy, front",
            altConfirmed: true,
            width: 1200,
            height: 1600,
            blurDataURL: "data:image/webp;base64,AA",
            dominantColor: "#1d566a",
          },
        ],
      },
    ],
    fits: ["regular" as const],
    sizes: ["S", "M"],
  };
  const matrix = buildMatrix(
    { colors: ["navy"], fits: ["regular"], sizes: ["S", "M"], excluded: new Set() },
    [],
    [],
    {
      skuPrefix: "HARB-DRESS-01",
      price: 14800,
      compareAtPrice: null,
      weightGrams: 400,
      lowStockThreshold: 3,
    },
  );
  return {
    data: {
      ...data,
      matrix: matrix.rows.map((r, i) => ({ ...r, stock: { [warehouse]: i === 0 ? 2 : 10 } })),
    },
    photo,
  };
}

let productId = "";

describe("drafts", () => {
  it("creates a draft and counts it on the shop", async () => {
    productId = await products.createDraft(actor, shopId, now);
    const draft = await products.getOwnedDraftRecord(actor, productId);
    expect(draft).toMatchObject({ status: "draft", version: 0, shopId });
    expect(draft.parsed.shipping.shipsFromLocationId).toBe(warehouse);
    expect((await getShop(shopId))?.counters.draft).toBe(1);
  });

  it("keeps other merchants out", async () => {
    await expect(products.getOwnedDraftRecord(other, productId)).rejects.toMatchObject({
      code: "not_found",
    });
    await expect(products.createDraft(other, shopId, now)).rejects.toMatchObject({
      code: "not_found",
    });
  });

  it("autosaves with version checks, summarises and attaches photos", async () => {
    const draft = await products.getOwnedDraftRecord(actor, productId);
    const { data, photo } = await filledData(draft.parsed);
    const saved = await products.saveDraft(actor, productId, 0, data, now);
    expect(saved.version).toBe(1);
    expect(saved.summary).toMatchObject({
      name: "Linen Midi Dress",
      variants: 2,
      priceMin: 14800,
      stock: 12,
      lowStock: true,
      image: photo.url,
    });
    expect((await getMedia(photo.id))?.status).toBe("attached");
    expect((await getShop(shopId))?.counters.lowStock).toBe(1);

    await expect(products.saveDraft(actor, productId, 0, data, now)).rejects.toMatchObject({
      code: "conflict",
      message: expect.stringContaining("another tab"),
    });
  });

  it("refuses photos from another merchant's folder", async () => {
    const draft = await products.getOwnedDraftRecord(actor, productId);
    const forged = {
      ...draft.parsed,
      colors: draft.parsed.colors.map((c) => ({
        ...c,
        images: c.images.map((i) => ({ ...i, url: "/media/m/v-someone-else/s1/x.webp" })),
      })),
    };
    await expect(
      products.saveDraft(actor, productId, draft.version, forged, now),
    ).rejects.toMatchObject({
      code: "conflict",
    });
  });

  it("releases photos that are removed", async () => {
    const draft = await products.getOwnedDraftRecord(actor, productId);
    const photoId = draft.parsed.colors[0]?.images[0]?.mediaId ?? "";
    const withoutPhoto = {
      ...draft.parsed,
      colors: draft.parsed.colors.map((c) => ({ ...c, images: [] })),
    };
    await products.saveDraft(actor, productId, draft.version, withoutPhoto, now);
    expect((await getMedia(photoId))?.status).toBe("orphaned");
    // Put it back for the next tests.
    await products.saveDraft(actor, productId, draft.version + 1, draft.parsed, now);
    expect((await getMedia(photoId))?.status).toBe("attached");
  });

  it("edits stock inline and refuses unknown locations", async () => {
    const draft = await products.getOwnedDraftRecord(actor, productId);
    const key = draft.parsed.matrix[0]?.key ?? "";
    const result = await products.updateDraftStock(actor, productId, key, warehouse, 20, now);
    expect(result.summary).toMatchObject({ stock: 30, lowStock: false });
    expect((await getShop(shopId))?.counters.lowStock).toBe(0);
    await expect(
      products.updateDraftStock(actor, productId, key, "nowhere", 1, now),
    ).rejects.toMatchObject({
      code: "not_found",
    });
  });
});

describe("duplicate, archive and list", () => {
  it("duplicates everything except the address and SKUs", async () => {
    const copyId = await products.duplicateDraft(actor, productId, now);
    const [source, copy] = await Promise.all([
      products.getOwnedDraftRecord(actor, productId),
      products.getOwnedDraftRecord(actor, copyId),
    ]);
    expect(copy.parsed.name).toBe("Linen Midi Dress (copy)");
    expect(copy.parsed.colors).toEqual(source.parsed.colors);
    expect(copy.parsed.slug).toBe("");
    const sourceSkus = new Set(source.parsed.matrix.map((r) => r.sku));
    expect(copy.parsed.matrix.every((r) => !sourceSkus.has(r.sku))).toBe(true);
    expect(copy.parsed.matrix.map((r) => r.stock)).toEqual(
      source.parsed.matrix.map((r) => r.stock),
    );
    expect((await getShop(shopId))?.counters.draft).toBe(2);
  });

  it("archives and restores, keeping counters right", async () => {
    expect(await products.setArchived(actor, [productId], true, undefined, now)).toBe(1);
    expect((await getShop(shopId))?.counters.draft).toBe(1);
    await expect(products.saveDraft(actor, productId, 99, {}, now)).rejects.toMatchObject({
      code: "conflict",
    });
    expect(await products.setArchived(actor, [productId], true, undefined, now)).toBe(0);
    expect(await products.setArchived(actor, [productId], false, undefined, now)).toBe(1);
    expect((await getShop(shopId))?.counters.draft).toBe(2);
  });

  it("lists, searches, filters and pages a shop's products", async () => {
    const all = await products.listShopDrafts(actor, { shopId, limit: 1 });
    expect(all.total).toBe(2);
    expect(all.items).toHaveLength(1);
    expect(all.nextOffset).toBe(1);
    const bySku = await products.listShopDrafts(actor, { shopId, q: "harb-dress-01-copy" });
    expect(bySku.items.map((i) => i.summary.name)).toEqual(["Linen Midi Dress (copy)"]);
    const byName = await products.listShopDrafts(actor, { shopId, sort: "name" });
    expect(byName.items.map((i) => i.summary.name)).toEqual([
      "Linen Midi Dress",
      "Linen Midi Dress (copy)",
    ]);
    expect((await products.listShopDrafts(actor, { shopId, stock: "out" })).total).toBe(0);
    await products.setArchived(actor, [productId], true, undefined, now);
    expect((await products.listShopDrafts(actor, { shopId })).total).toBe(1);
    expect((await products.listShopDrafts(actor, { shopId, status: "archived" })).total).toBe(1);
    await expect(products.listShopDrafts(other, { shopId })).rejects.toMatchObject({
      code: "not_found",
    });
  });
});
