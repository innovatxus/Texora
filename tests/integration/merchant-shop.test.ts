import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.40" }),
  cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }),
}));

const { getFirebaseAdmin } = await import("@/lib/firebase/admin");
const shops = await import("@/lib/merchant/shop-service");
const media = await import("@/lib/merchant/media/media-service");
const { getShop, getShopSlugLock } = await import("@/lib/merchant/repositories/shops");
const { listLocations } = await import("@/lib/merchant/repositories/locations");
const { getMedia } = await import("@/lib/merchant/repositories/media");
const { getMerchant } = await import("@/lib/merchant/repositories/merchants");

const { db } = getFirebaseAdmin();
const bucket = () => getFirebaseAdmin().storage.bucket();
const run = randomUUID().slice(0, 8);
const vendorId = `v-shop-${run}`;
const otherVendor = `v-shop-other-${run}`;
const now = new Date("2026-10-20T12:00:00Z");

const session = (vendor: string) => ({
  uid: `u-${vendor}`,
  email: `${vendor}@example.com`,
  role: "vendor" as const,
  vendorId: vendor,
  emailVerified: true,
});
const actor = { session: session(vendorId), vendorId };
const other = { session: session(otherVendor), vendorId: otherVendor };

const basics = (slug: string) => ({
  name: "Maison Rue",
  slug,
  tagline: "Linen for warm days",
  description: "Small-batch linen.\nMade in Portugal.",
  shopType: "brand" as const,
  departments: ["women" as const],
  categoryKeys: ["women/dresses"],
});

const location = (shopId: string, extra: Record<string, unknown> = {}) => ({
  shopId,
  name: "Studio",
  types: ["ship_from" as const, "retail" as const],
  address: { line1: "12 Mercer St", city: "New York", region: "NY", postalCode: "10013" },
  hours: [{ day: 1, open: "10:00", close: "18:00" }],
  specialHours: [],
  ...extra,
});

async function writeMerchant(id: string, emailVerified: boolean) {
  await db
    .collection("merchants")
    .doc(id)
    .set({
      ownerUid: `u-${id}`,
      email: `${id}@example.com`,
      username: `m${id.replace(/[^a-z0-9]/g, "").slice(-20)}`,
      displayName: "Ada",
      status: "onboarding",
      emailVerified,
      trustLevel: "standard",
      shopIds: [],
      createdAt: now,
      updatedAt: now,
    });
}

async function uploadImage(shopId: string, kind: "logo" | "banner") {
  const [width, height] = kind === "logo" ? [800, 800] : [2700, 900];
  const bytes = await sharp({ create: { width, height, channels: 3, background: "#3d5a3a" } })
    .png()
    .toBuffer();
  const uploadId = randomUUID();
  await bucket()
    .file(media.tmpPath(vendorId, shopId, uploadId))
    .save(bytes, { contentType: "image/png" });
  const result = await media.finalizeUpload(
    { vendorId, ownerUid: actor.session.uid, shopId, kind, uploadId },
    now,
  );
  return result.media.id;
}

let shopId = "";
const slug = `maison-${run}`;

beforeAll(async () => {
  await writeMerchant(vendorId, false);
  await writeMerchant(otherVendor, true);
});

afterAll(async () => {
  const owned = await db.collection("shops").where("vendorId", "in", [vendorId, otherVendor]).get();
  for (const doc of owned.docs) {
    const locs = await doc.ref.collection("locations").get();
    await Promise.all(locs.docs.map((l) => l.ref.delete()));
    await db.collection("shopSlugs").doc(doc.get("slug")).delete();
    await doc.ref.delete();
  }
  await db.collection("merchants").doc(vendorId).delete();
  await db.collection("merchants").doc(otherVendor).delete();
  const [files] = await bucket().getFiles({ prefix: `merchant-media/${vendorId}/` });
  await Promise.all(files.map((f) => f.delete({ ignoreNotFound: true })));
});

describe("shop basics", () => {
  it("creates the shop, reserves its address and links it to the merchant", async () => {
    const shop = await shops.saveShopBasics(actor, basics(slug), undefined, now);
    shopId = shop.id;
    expect(shop).toMatchObject({
      vendorId,
      slug,
      status: "draft",
      onboardingStep: "branding",
      completedSteps: ["basics"],
      accent: "ink",
      contact: { email: `${vendorId}@example.com` },
      returnPolicy: { mode: "platform" },
    });
    expect((await getShopSlugLock(slug))?.shopId).toBe(shopId);
    expect((await getMerchant(vendorId))?.shopIds).toEqual([shopId]);
  });

  it("refuses an address another shop holds, on the slug field", async () => {
    await expect(shops.saveShopBasics(other, basics(slug), undefined, now)).rejects.toMatchObject({
      code: "conflict",
      field: "slug",
    });
  });

  it("refuses categories outside the chosen departments", async () => {
    await expect(
      shops.saveShopBasics(actor, { ...basics(slug), categoryKeys: ["men/shirts"] }, shopId, now),
    ).rejects.toMatchObject({ field: "categoryKeys" });
  });

  it("moves to a new address and frees the old one", async () => {
    const renamed = `maison-rue-${run}`;
    await shops.saveShopBasics(actor, basics(renamed), shopId, now);
    expect(await getShopSlugLock(slug)).toBeNull();
    expect((await getShopSlugLock(renamed))?.shopId).toBe(shopId);
    await shops.saveShopBasics(actor, basics(slug), shopId, now);
  });

  it("keeps other merchants out", async () => {
    await expect(shops.saveShopBasics(other, basics(slug), shopId, now)).rejects.toMatchObject({
      code: "not_found",
    });
    await expect(shops.saveLocation(other, location(shopId), now)).rejects.toMatchObject({
      code: "not_found",
    });
  });
});

describe("branding", () => {
  it("attaches the logo and banner and releases a replaced logo", async () => {
    const firstLogo = await uploadImage(shopId, "logo");
    const banner = await uploadImage(shopId, "banner");
    await shops.saveShopBranding(
      actor,
      {
        shopId,
        logoMediaId: firstLogo,
        bannerMediaId: banner,
        bannerFocal: { x: 0.3, y: 0.6 },
        accent: "moss",
      },
      now,
    );
    let shop = await getShop(shopId);
    expect(shop?.logo?.mediaId).toBe(firstLogo);
    expect(shop?.banner).toMatchObject({ mediaId: banner, focal: { x: 0.3, y: 0.6 } });
    expect(shop?.accent).toBe("moss");
    expect((await getMedia(firstLogo))?.status).toBe("attached");

    const secondLogo = await uploadImage(shopId, "logo");
    await shops.saveShopBranding(actor, { shopId, logoMediaId: secondLogo, accent: "moss" }, now);
    shop = await getShop(shopId);
    expect(shop?.logo?.mediaId).toBe(secondLogo);
    expect(shop?.banner?.mediaId).toBe(banner);
    expect(await getMedia(firstLogo)).toMatchObject({ status: "orphaned" });
  });

  it("refuses a banner used as a logo", async () => {
    const banner = await uploadImage(shopId, "banner");
    await expect(
      shops.saveShopBranding(actor, { shopId, logoMediaId: banner, accent: "ink" }, now),
    ).rejects.toMatchObject({ code: "conflict" });
  });
});

describe("locations", () => {
  it("rejects a ZIP that doesn't match the state", async () => {
    await expect(
      shops.saveLocation(
        actor,
        location(shopId, {
          address: { line1: "1 Main St", city: "Austin", region: "TX", postalCode: "10013" },
        }),
        now,
      ),
    ).rejects.toMatchObject({ field: "address.postalCode" });
  });

  it("adds a location with timezone and position, becoming primary and the default ship-from", async () => {
    const saved = await shops.saveLocation(actor, location(shopId), now);
    expect(saved).toMatchObject({
      timezone: "America/New_York",
      isPrimary: true,
      status: "active",
    });
    expect(saved.geo).toBeDefined();
    const shop = await getShop(shopId);
    expect(shop?.shipping.shipsFromLocationId).toBe(saved.id);
    expect(shop?.completedSteps).toContain("locations");
  });

  it("never archives the last ship-from location, and hands primary on", async () => {
    const [studio] = await listLocations(shopId);
    if (!studio) throw new Error("no location");
    await expect(shops.archiveLocation(actor, shopId, studio.id, now)).rejects.toMatchObject({
      code: "conflict",
    });
    const warehouse = await shops.saveLocation(
      actor,
      location(shopId, { name: "Warehouse", types: ["ship_from"], hours: [] }),
      now,
    );
    await shops.archiveLocation(actor, shopId, studio.id, now);
    const active = await listLocations(shopId);
    expect(active.map((l) => l.id)).toEqual([warehouse.id]);
    expect(active[0]?.isPrimary).toBe(true);
    expect((await getShop(shopId))?.shipping.shipsFromLocationId).toBe(warehouse.id);
  });
});

describe("contact & policies", () => {
  it("saves policies and refuses a ships-from that isn't the merchant's", async () => {
    const input = {
      shopId,
      contact: { email: "hello@maisonrue.com", phone: "+12125550123" },
      social: { instagram: "maison.rue" },
      returnPolicy: { mode: "custom" as const, windowDays: 14 as const, notes: "Unworn" },
      shipping: { processingTime: "3-5" as const },
    };
    await shops.saveShopContact(actor, input, now);
    expect(await getShop(shopId)).toMatchObject({
      contact: { email: "hello@maisonrue.com" },
      returnPolicy: { windowDays: 14 },
      completedSteps: expect.arrayContaining(["contact"]),
    });
    await expect(
      shops.saveShopContact(
        actor,
        { ...input, shipping: { processingTime: "1-2", shipsFromLocationId: "nope" } },
        now,
      ),
    ).rejects.toMatchObject({ field: "shipping.shipsFromLocationId" });
  });
});

describe("submit", () => {
  it("is blocked until the email is verified", async () => {
    await expect(shops.submitShop(actor, shopId, now)).rejects.toMatchObject({
      code: "conflict",
      message: expect.stringContaining("verify your email"),
    });
  });

  it("submits a complete shop, emails the merchant and the team, and can't submit twice", async () => {
    await db.collection("merchants").doc(vendorId).update({ emailVerified: true });
    const submitted = await shops.submitShop(actor, shopId, now);
    expect(submitted.status).toBe("pending_review");
    expect(submitted.reviewNotes.at(-1)).toMatchObject({ decision: "submitted" });
    expect((await getMerchant(vendorId))?.status).toBe("active");

    const outbox = await db.collection("emailOutbox").where("ref", "==", shopId).get();
    expect(outbox.docs.map((d) => d.get("kind")).sort()).toEqual([
      "merchant_shop_review_request",
      "merchant_shop_submitted",
    ]);
    await expect(shops.submitShop(actor, shopId, now)).rejects.toMatchObject({ code: "conflict" });
  });
});

describe("close and reopen", () => {
  it("closes the shop and reopens it within 30 days", async () => {
    await shops.closeShop(actor, shopId, now);
    expect((await getShop(shopId))?.status).toBe("closed");
    await expect(
      shops.reopenShop(actor, shopId, new Date(now.getTime() + 31 * 86_400_000)),
    ).rejects.toMatchObject({ code: "conflict" });
    await shops.reopenShop(actor, shopId, new Date(now.getTime() + 86_400_000));
    // Never approved, so it returns to setup rather than going live.
    expect((await getShop(shopId))?.status).toBe("draft");
  });
});
