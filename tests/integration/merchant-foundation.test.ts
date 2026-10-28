import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.9", "user-agent": "vitest" }),
  cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }),
}));

const { getFirebaseAdmin } = await import("@/lib/firebase/admin");
const merchants = await import("@/lib/merchant/repositories/merchants");
const shops = await import("@/lib/merchant/repositories/shops");
const { listMerchantProducts, getOwnedProduct } =
  await import("@/lib/merchant/repositories/merchant-products");
const { consumeRateLimit, isRateLimited, resetRateLimit, enforceRateLimit } =
  await import("@/lib/security/rate-limit");
const { grantMerchantRole, RoleAssignmentError } = await import("@/lib/auth/roles");
const { listAuditLogs } = await import("@/lib/data/admin-records");

const { db, auth } = getFirebaseAdmin();
const run = randomUUID().slice(0, 8);
const now = new Date("2026-10-20T12:00:00Z");
const cleanup: Array<() => Promise<unknown>> = [];

afterAll(async () => {
  for (const fn of cleanup.reverse()) await fn().catch(() => {});
});

describe("username locks", () => {
  const name = `maison${run}`;

  it("lets exactly one of two concurrent claims win", async () => {
    cleanup.push(() => db.collection("usernames").doc(name).delete());
    const claim = (uid: string) =>
      db.runTransaction((tx) => merchants.claimUsername(tx, name, { uid, vendorId: uid }, now));
    const results = await Promise.allSettled([claim("uid-a"), claim("uid-b")]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected");
    expect((rejected as PromiseRejectedResult).reason).toBeInstanceOf(merchants.UsernameTakenError);
  });

  it("treats re-claiming your own username as a no-op and checks availability", async () => {
    const lock = await merchants.getUsernameLock(name);
    expect(lock).not.toBeNull();
    const owner = lock?.uid ?? "";
    await db.runTransaction((tx) =>
      merchants.claimUsername(tx, name, { uid: owner, vendorId: owner }, now),
    );
    expect(await merchants.isUsernameAvailable(name, owner)).toBe(true);
    expect(await merchants.isUsernameAvailable(name, "someone-else")).toBe(false);
    expect(await merchants.isUsernameAvailable(`free${run}`)).toBe(true);
    expect(await merchants.isUsernameAvailable("admin")).toBe(false);
    expect(await merchants.isUsernameAvailable("Bad Name")).toBe(false);
  });

  it("releases a username only for its holder", async () => {
    const lock = await merchants.getUsernameLock(name);
    await merchants.releaseUsername(name, "not-the-holder");
    expect(await merchants.getUsernameLock(name)).not.toBeNull();
    await merchants.releaseUsername(name, lock?.uid ?? "");
    expect(await merchants.getUsernameLock(name)).toBeNull();
  });

  it("resolves a username to the merchant's email for sign-in", async () => {
    const vendorId = `v-${run}`;
    const username = `ada${run}`;
    await db
      .collection("merchants")
      .doc(vendorId)
      .set({
        ownerUid: `u-${run}`,
        email: `ada-${run}@example.com`,
        username,
        displayName: "Ada",
        status: "onboarding",
        emailVerified: false,
        trustLevel: "standard",
        shopIds: [],
        createdAt: now,
        updatedAt: now,
      });
    await db.runTransaction((tx) =>
      merchants.claimUsername(tx, username, { uid: `u-${run}`, vendorId }, now),
    );
    cleanup.push(() => db.collection("merchants").doc(vendorId).delete());
    cleanup.push(() => db.collection("usernames").doc(username).delete());

    expect(await merchants.emailForUsername(username.toUpperCase())).toBe(`ada-${run}@example.com`);
    expect(await merchants.emailForUsername(`nobody${run}`)).toBeNull();
    expect((await merchants.getMerchantByOwner(`u-${run}`))?.id).toBe(vendorId);
  });
});

describe("shop address locks", () => {
  const first = `maison-${run}`;
  const second = `maison-rue-${run}`;

  it("claims an address and releases the old one when it changes", async () => {
    cleanup.push(() => db.collection("shopSlugs").doc(first).delete());
    cleanup.push(() => db.collection("shopSlugs").doc(second).delete());
    const owner = { shopId: `s-${run}`, vendorId: `v-${run}` };

    await db.runTransaction((tx) => shops.claimShopSlug(tx, first, owner, now));
    expect((await shops.getShopSlugLock(first))?.shopId).toBe(owner.shopId);

    await db.runTransaction((tx) => shops.claimShopSlug(tx, second, owner, now, first));
    expect(await shops.getShopSlugLock(first)).toBeNull();
    expect((await shops.getShopSlugLock(second))?.shopId).toBe(owner.shopId);
    expect(await shops.isShopSlugAvailable(second, owner.shopId)).toBe(true);
    expect(await shops.isShopSlugAvailable(second, "other-shop")).toBe(false);
  });

  it("refuses an address another shop holds", async () => {
    await expect(
      db.runTransaction((tx) =>
        shops.claimShopSlug(tx, second, { shopId: "other-shop", vendorId: "v-other" }, now),
      ),
    ).rejects.toBeInstanceOf(shops.ShopSlugTakenError);
  });
});

/** A complete draft shop, as onboarding step 1 would create it. */
function validShop(vendorId: string) {
  return {
    vendorId,
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

describe("merchant ownership", () => {
  const vendorId = `v-own-${run}`;
  const shopId = `s-own-${run}`;

  it("scopes shops and products to the owning merchant", async () => {
    await db.collection("shops").doc(shopId).set(validShop(vendorId));
    cleanup.push(() => db.collection("shops").doc(shopId).delete());
    expect((await shops.getOwnedShop(vendorId, shopId)).name).toBe("Maison Rue");
    expect((await shops.listShopsForVendor(vendorId)).map((x) => x.id)).toEqual([shopId]);
    await expect(shops.getOwnedShop("someone-else", shopId)).rejects.toMatchObject({
      code: "not_found",
    });
    await expect(shops.getOwnedShop(vendorId, `missing-${run}`)).rejects.toMatchObject({
      code: "not_found",
    });
  });

  it("pages a shop's products by most recent change", async () => {
    // Clones a seeded product into a merchant shop with staggered update times.
    const source = (await db.collection("products").limit(1).get()).docs[0];
    if (!source) throw new Error("seed has no products");
    const ids = [1, 2, 3].map((n) => `mp-${run}-${n}`);
    for (const [i, id] of ids.entries()) {
      await db
        .collection("products")
        .doc(id)
        .set({
          ...source.data(),
          slug: id,
          status: i === 0 ? "in_review" : "draft",
          vendorId,
          shopId,
          updatedAt: new Date(now.getTime() + i * 1000),
        });
      cleanup.push(() => db.collection("products").doc(id).delete());
    }

    const first = await listMerchantProducts({ shopId, limit: 2 });
    expect(first.items.map((p) => p.id)).toEqual([ids[2], ids[1]]);
    expect(first.nextCursor).not.toBeNull();
    const second = await listMerchantProducts({ shopId, limit: 2, cursor: first.nextCursor });
    expect(second.items.map((p) => p.id)).toEqual([ids[0]]);
    expect(second.nextCursor).toBeNull();

    const inReview = await listMerchantProducts({ shopId, status: "in_review", limit: 10 });
    expect(inReview.items.map((p) => p.id)).toEqual([ids[0]]);

    expect((await getOwnedProduct(vendorId, ids[0] ?? ""))?.shopId).toBe(shopId);
    expect(await getOwnedProduct("someone-else", ids[0] ?? "")).toBeNull();
  });
});

describe("rate limits", () => {
  const who = `ada-${run}@example.com`;

  it("locks an account after five failed sign-ins and resets on success", async () => {
    for (let i = 0; i < 5; i++) {
      expect((await consumeRateLimit("signInAccount", who, now)).allowed).toBe(true);
    }
    const blocked = await consumeRateLimit("signInAccount", who, now);
    expect(blocked).toMatchObject({ allowed: false, remaining: 0 });
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect(await isRateLimited("signInAccount", who, now)).toBe(true);

    await resetRateLimit("signInAccount", who, now);
    expect(await isRateLimited("signInAccount", who, now)).toBe(false);
  });

  it("starts fresh in the next window", async () => {
    const id = `win-${run}`;
    expect((await consumeRateLimit("verifyResend", id, now)).allowed).toBe(true);
    expect((await consumeRateLimit("verifyResend", id, now)).allowed).toBe(false);
    const later = new Date(now.getTime() + 61_000);
    expect((await consumeRateLimit("verifyResend", id, later)).allowed).toBe(true);
  });

  it("counts concurrent attempts exactly", async () => {
    const id = `burst-${run}`;
    const results = await Promise.all(
      Array.from({ length: 8 }, () => consumeRateLimit("register", id, now)),
    );
    expect(results.filter((r) => r.allowed)).toHaveLength(5);
  });

  it("throws limit_exceeded with friendly copy", async () => {
    const id = `throw-${run}`;
    await enforceRateLimit("verifyResend", id);
    await expect(enforceRateLimit("verifyResend", id)).rejects.toMatchObject({
      code: "limit_exceeded",
      message: "Too many attempts. Wait a minute and try again.",
    });
  });
});

describe("grantMerchantRole", () => {
  it("turns a customer into a merchant, revokes sessions and audits it", async () => {
    const user = await auth.createUser({
      email: `shopper-${run}@example.com`,
      password: "x".repeat(14),
    });
    cleanup.push(() => auth.deleteUser(user.uid));
    cleanup.push(() => db.collection("users").doc(user.uid).delete());

    await grantMerchantRole(user.uid, `v-${run}`);
    const updated = await auth.getUser(user.uid);
    expect(updated.customClaims).toEqual({ role: "vendor", vendorId: `v-${run}` });
    expect(updated.tokensValidAfterTime).toBeTruthy();
    expect((await db.collection("users").doc(user.uid).get()).get("role")).toBe("vendor");

    const logs = await listAuditLogs({ target: { type: "user", id: user.uid }, limit: 5 });
    expect(logs.items[0]).toMatchObject({
      action: "merchants.register",
      actor: { uid: user.uid, role: "customer" },
      after: { role: "vendor", vendorId: `v-${run}` },
    });

    // Repeating the same grant is a no-op (idempotent registration retries).
    await grantMerchantRole(user.uid, `v-${run}`);
  });

  it("refuses staff accounts", async () => {
    const user = await auth.createUser({ email: `staff-${run}@example.com` });
    cleanup.push(() => auth.deleteUser(user.uid));
    await auth.setCustomUserClaims(user.uid, { role: "merchandiser" });
    await expect(grantMerchantRole(user.uid, `v2-${run}`)).rejects.toBeInstanceOf(
      RoleAssignmentError,
    );
    expect((await auth.getUser(user.uid)).customClaims).toEqual({ role: "merchandiser" });
  });
});
