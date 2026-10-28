import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.30" }),
  cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }),
}));

const { getFirebaseAdmin } = await import("@/lib/firebase/admin");
const media = await import("@/lib/merchant/media/media-service");
const { getMedia } = await import("@/lib/merchant/repositories/media");
const { GET } = await import("@/app/media/m/[...path]/route");

const { db } = getFirebaseAdmin();
const bucket = () => getFirebaseAdmin().storage.bucket();
const run = randomUUID().slice(0, 8);
const vendorId = `v-media-${run}`;
const otherVendor = `v-other-${run}`;
const shopId = `s-media-${run}`;
const now = new Date("2026-10-20T12:00:00Z");

function shop(owner: string) {
  return {
    vendorId: owner,
    name: "Maison Rue",
    slug: `maison-${run}`,
    tagline: "",
    description: "",
    shopType: "boutique",
    departments: ["women"],
    categoryKeys: ["women/dresses"],
    contact: { email: "hello@example.com" },
    social: {},
    returnPolicy: { mode: "platform" },
    shipping: { processingTime: "1-2" },
    status: "draft",
    reviewNotes: [],
    onboardingStep: "branding",
    completedSteps: ["basics"],
    counters: { live: 0, draft: 0, inReview: 0, changesRequested: 0, lowStock: 0 },
    createdAt: now,
    updatedAt: now,
  };
}

/** Writes a raw upload as the browser would (rules bypassed: this is the Admin SDK). */
async function rawUpload(bytes: Buffer, contentType: string, owner = vendorId): Promise<string> {
  const uploadId = randomUUID();
  await bucket()
    .file(media.tmpPath(owner, shopId, uploadId))
    .save(bytes, { contentType });
  return uploadId;
}

const logoPng = () =>
  sharp({ create: { width: 800, height: 600, channels: 3, background: "#1f2a44" } })
    .png()
    .withMetadata({ exif: { IFD0: { Make: "TestCam" }, IFD3: { GPSLatitudeRef: "N" } } })
    .toBuffer();

const input = (uploadId: string, kind: "logo" | "banner" | "productImage" = "logo") => ({
  vendorId,
  ownerUid: `u-${run}`,
  shopId,
  kind,
  uploadId,
});

beforeAll(async () => {
  await db.collection("shops").doc(shopId).set(shop(vendorId));
});

afterAll(async () => {
  await db.collection("shops").doc(shopId).delete();
  const [files] = await bucket().getFiles({ prefix: `merchant-media/${vendorId}/` });
  await Promise.all(files.map((f) => f.delete({ ignoreNotFound: true })));
  const records = await db.collection("merchantMedia").where("vendorId", "==", vendorId).get();
  await Promise.all(records.docs.map((d) => d.ref.delete()));
});

describe("finalizeUpload", () => {
  it("processes an upload, stores the WebP, deletes the raw file and records it", async () => {
    const uploadId = await rawUpload(await logoPng(), "image/png");
    const result = await media.finalizeUpload(input(uploadId), now);
    expect(result.kind).toBe("image");
    if (result.kind !== "image") return;

    expect(result.image).toMatchObject({ width: 600, height: 600 });
    expect(result.image.url).toBe(`/media/m/${vendorId}/${shopId}/${result.media.id}.webp`);
    const [stored] = await bucket().file(result.media.path).download();
    const meta = await sharp(stored).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.exif).toBeUndefined();

    const [rawExists] = await bucket()
      .file(media.tmpPath(vendorId, shopId, uploadId))
      .exists();
    expect(rawExists).toBe(false);
    expect(await getMedia(result.media.id)).toMatchObject({
      status: "tmp",
      kind: "logo",
      vendorId,
    });
  });

  it("refuses a shop the merchant doesn't own", async () => {
    const uploadId = await rawUpload(await logoPng(), "image/png");
    await expect(
      media.finalizeUpload({ ...input(uploadId), vendorId: otherVendor }, now),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("rejects HTML uploaded with an image content type, and deletes it", async () => {
    const uploadId = await rawUpload(
      Buffer.from("<html><script>alert(1)</script></html>"),
      "image/png",
    );
    await expect(media.finalizeUpload(input(uploadId), now)).rejects.toMatchObject({
      code: "conflict",
      message: expect.stringMatching(/^That file type isn't supported/),
    });
    const [exists] = await bucket()
      .file(media.tmpPath(vendorId, shopId, uploadId))
      .exists();
    expect(exists).toBe(false);
  });

  it("checks the stored size before downloading", async () => {
    const big = Buffer.alloc(6 * 1024 * 1024);
    const uploadId = await rawUpload(big, "image/png");
    await expect(media.finalizeUpload(input(uploadId), now)).rejects.toMatchObject({
      code: "conflict",
      message: "That file is too large — the limit is 5 MB.",
    });
  });

  it("refuses unknown or malformed upload ids", async () => {
    await expect(media.finalizeUpload(input("../../etc"), now)).rejects.toMatchObject({
      code: "not_found",
    });
    await expect(media.finalizeUpload(input(randomUUID()), now)).rejects.toMatchObject({
      code: "not_found",
    });
  });
});

describe("serving", () => {
  it("serves processed media with long caching, and supports ranges", async () => {
    const uploadId = await rawUpload(await logoPng(), "image/png");
    const result = await media.finalizeUpload(input(uploadId), now);
    const file = result.media.path.split("/").at(-1) ?? "";
    const params = Promise.resolve({ path: [vendorId, shopId, file] });

    const full = await GET(
      new Request(`http://localhost${result.kind === "image" ? result.image.url : ""}`),
      { params },
    );
    expect(full.status).toBe(200);
    expect(full.headers.get("content-type")).toBe("image/webp");
    expect(full.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(full.headers.get("x-content-type-options")).toBe("nosniff");
    const body = new Uint8Array(await full.arrayBuffer());
    expect(body.byteLength).toBe(result.media.bytes);

    const partial = await GET(
      new Request("http://localhost/x", { headers: { range: "bytes=0-9" } }),
      {
        params,
      },
    );
    expect(partial.status).toBe(206);
    expect(partial.headers.get("content-range")).toBe(`bytes 0-9/${result.media.bytes}`);
    expect((await partial.arrayBuffer()).byteLength).toBe(10);
  });

  it("never serves raw uploads or arbitrary paths", async () => {
    const uploadId = await rawUpload(await logoPng(), "image/png");
    const raw = await GET(new Request("http://localhost/x"), {
      params: Promise.resolve({ path: [vendorId, shopId, uploadId] }),
    });
    expect(raw.status).toBe(404);
    const traversal = await GET(new Request("http://localhost/x"), {
      params: Promise.resolve({ path: [vendorId, "..", "tmp", `${uploadId}.webp`] }),
    });
    expect(traversal.status).toBe(404);
    const missing = await GET(new Request("http://localhost/x"), {
      params: Promise.resolve({ path: [vendorId, shopId, `${randomUUID()}.webp`] }),
    });
    expect(missing.status).toBe(404);
  });
});

describe("cleanupStaleMedia", () => {
  it("deletes unattached and orphaned media and stale raw uploads after 24 hours", async () => {
    const keepUpload = await rawUpload(await logoPng(), "image/png");
    const unused = await media.finalizeUpload(
      input(await rawUpload(await logoPng(), "image/png")),
      now,
    );
    const kept = await media.finalizeUpload(
      input(await rawUpload(await logoPng(), "image/png")),
      now,
    );
    const replaced = await media.finalizeUpload(
      input(await rawUpload(await logoPng(), "image/png")),
      now,
    );
    await db.runTransaction(async (tx) => {
      media.attachMedia(tx, [kept.media.id, replaced.media.id]);
    });
    await db.runTransaction(async (tx) => {
      media.orphanMedia(tx, [replaced.media.id], now);
    });

    const later = new Date(now.getTime() + 25 * 3_600_000);
    // Raw uploads use their Storage creation time, which is "now" in the emulator.
    const result = await media.cleanupStaleMedia(later);
    expect(result.records).toBeGreaterThanOrEqual(2);

    expect(await getMedia(unused.media.id)).toBeNull();
    expect(await getMedia(replaced.media.id)).toBeNull();
    expect(await getMedia(kept.media.id)).toMatchObject({ status: "attached" });
    const [unusedFile] = await bucket().file(unused.media.path).exists();
    const [keptFile] = await bucket().file(kept.media.path).exists();
    expect(unusedFile).toBe(false);
    expect(keptFile).toBe(true);

    // The raw upload was created moments ago, so it survives a cleanup at the real time.
    await media.cleanupStaleMedia(new Date());
    const [stillThere] = await bucket()
      .file(media.tmpPath(vendorId, shopId, keepUpload))
      .exists();
    expect(stillThere).toBe(true);
  });
});
