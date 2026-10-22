import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.90", "user-agent": "vitest" }),
  cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }),
}));

const { getFirebaseAdmin } = await import("@/lib/firebase/admin");
const auth = await import("@/lib/account/auth-service");
const account = await import("@/lib/account/account-service");
const { signInWithPassword } = await import("@/lib/auth/identity");

const { db, auth: adminAuth } = getFirebaseAdmin();
const run = randomUUID().slice(0, 8);
const PASSWORD = "harbour-violet-lantern-31";
const cleanupUids: string[] = [];
const ip = () => `198.51.100.${Math.floor(Math.random() * 250) + 1}`;

afterAll(async () => {
  for (const uid of cleanupUids) {
    await db
      .collection("users")
      .doc(uid)
      .delete()
      .catch(() => {});
    await adminAuth.deleteUser(uid).catch(() => {});
  }
});

/** Claims inside an ID token, without verifying it (the emulator's tokens are unsigned). */
function claimsOf(idToken: string): Record<string, unknown> {
  const payload = idToken.split(".")[1] ?? "";
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, unknown>;
}

async function newCustomer(joinRewards: boolean, tag: string) {
  const email = `cust-${tag}-${run}@example.com`;
  const result = await auth.registerCustomer(
    {
      firstName: "Grace",
      lastName: "Hopper",
      email,
      password: PASSWORD,
      marketingEmail: true,
      joinRewards,
    },
    ip(),
  );
  cleanupUids.push(result.uid);
  const session = {
    uid: result.uid,
    email,
    role: result.role,
    emailVerified: false,
    vendorId: null,
  } as Parameters<typeof account.changePassword>[0];
  return { ...result, email, session };
}

describe("registerCustomer", () => {
  it("creates a rewards member with a complete profile and a welcome email", async () => {
    const { uid, idToken, email } = await newCustomer(true, "member");
    expect(claimsOf(idToken)).toMatchObject({ role: "loyalty_member" });
    expect(await account.getAccountUser(uid)).toMatchObject({
      email,
      firstName: "Grace",
      role: "loyalty_member",
      loyalty: { tier: "core", points: 0 },
      preferences: { marketingEmail: true },
    });
    const mail = await db.collection("emailOutbox").where("to", "==", email).get();
    expect(mail.docs.map((d) => d.get("kind"))).toContain("customer_welcome");
  });

  it("refuses an email that's already registered, on the email field", async () => {
    const { email } = await newCustomer(false, "dup");
    await expect(
      auth.registerCustomer(
        {
          firstName: "A",
          lastName: "B",
          email,
          password: PASSWORD,
          marketingEmail: false,
          joinRewards: false,
        },
        ip(),
      ),
    ).rejects.toMatchObject({ code: "conflict", field: "email" });
  });
});

describe("signInCustomer", () => {
  it("signs in and locks the account after five failures", async () => {
    const { email } = await newCustomer(false, "lock");
    await expect(auth.signInCustomer(email, PASSWORD, ip())).resolves.toHaveProperty("idToken");
    for (let i = 0; i < 5; i++) {
      await expect(auth.signInCustomer(email, "wrong-password-0000", ip())).rejects.toMatchObject({
        code: "unauthenticated",
      });
    }
    await expect(auth.signInCustomer(email, PASSWORD, ip())).rejects.toMatchObject({
      message: auth.LOCKED_OUT,
    });
  });
});

describe("password reset", () => {
  it("emails a link for known accounts only, and the link sets a new password", async () => {
    const { email } = await newCustomer(false, "reset");
    await auth.requestCustomerPasswordReset(`nobody-${run}@example.com`, ip());
    await auth.requestCustomerPasswordReset(email, ip());
    const mail = await db
      .collection("emailOutbox")
      .where("to", "==", email)
      .where("kind", "==", "customer_password_reset")
      .get();
    const html = String(mail.docs[0]?.get("html") ?? "");
    const oobCode = decodeURIComponent(html.match(/oobCode=([^"&]+)/)?.[1] ?? "");
    expect(await auth.checkResetCode(oobCode)).toBe(true);
    await auth.resetCustomerPassword(oobCode, "copper-meadow-lantern-77");
    await expect(signInWithPassword(email, "copper-meadow-lantern-77")).resolves.toBeTruthy();
  });
});

describe("joinRewards", () => {
  it("turns a customer into a Core member and returns a token with the new role", async () => {
    const { uid } = await newCustomer(false, "join");
    const token = await auth.joinRewards(uid);
    expect(claimsOf(token)).toMatchObject({ role: "loyalty_member" });
    expect((await account.getAccountUser(uid))?.loyalty).toMatchObject({ tier: "core", points: 0 });
    await expect(auth.joinRewards(uid)).rejects.toMatchObject({ code: "conflict" });
  });
});

describe("account data", () => {
  it("keeps exactly one default shipping address and hands it on when removed", async () => {
    const { uid } = await newCustomer(false, "addr");
    const base = {
      firstName: "Grace",
      lastName: "Hopper",
      line1: "1 Navy Yard",
      city: "Arlington",
      region: "VA",
      postalCode: "22201",
      country: "US",
      phone: "7035550100",
    };
    const first = await account.saveAddress(uid, { ...base, label: "Home" });
    const second = await account.saveAddress(uid, {
      ...base,
      line1: "2 Pier Rd",
      isDefaultShipping: true,
    });
    let list = await account.listAddresses(uid);
    expect(list.filter((a) => a.isDefaultShipping).map((a) => a.id)).toEqual([second]);
    expect(list.find((a) => a.id === first)?.isDefaultBilling).toBe(true);
    await account.deleteAddress(uid, second);
    list = await account.listAddresses(uid);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: first, isDefaultShipping: true });
  });

  it("merges wishlists without duplicates and saves the bag", async () => {
    const { uid } = await newCustomer(false, "sync");
    await account.mergeWishlist(uid, [{ productId: "p1", priceAtAdd: 5000, addedAt: 1 }]);
    const merged = await account.mergeWishlist(uid, [
      { productId: "p1", priceAtAdd: 4000, addedAt: 2 },
      { productId: "p2", priceAtAdd: 3000, addedAt: 3 },
    ]);
    expect(merged.map((w) => w.productId).sort()).toEqual(["p1", "p2"]);
    expect(merged.find((w) => w.productId === "p1")?.priceAtAdd).toBe(5000);

    const line = {
      sku: "S1",
      productId: "p1",
      quantity: 2,
      savedForLater: false,
      addedAt: new Date(),
    };
    await account.saveCart(uid, [line], ["WELCOME15"]);
    expect(await account.getSavedCart(uid)).toMatchObject({
      ownerUid: uid,
      lines: [{ sku: "S1", quantity: 2 }],
      promoCodes: ["WELCOME15"],
    });
  });

  it("clears an optional phone without breaking the profile", async () => {
    const { uid } = await newCustomer(false, "phone");
    await account.updateDetails(uid, { firstName: "Ada", lastName: "Byron", phone: "2025550123" });
    await account.updateDetails(uid, { firstName: "Ada", lastName: "Byron" });
    const user = await account.getAccountUser(uid);
    expect(user).toMatchObject({ firstName: "Ada" });
    expect(user?.phone).toBeUndefined();
    await account.updateSizePreferences(uid, { fitFamily: "petite", savedSizes: { alpha: "S" } });
    await account.updateSizePreferences(uid, { savedSizes: {} });
    expect((await account.getAccountUser(uid))?.preferences.fitFamily).toBeUndefined();
  });
});

describe("security", () => {
  it("changes the password after checking the current one", async () => {
    const { session, email } = await newCustomer(false, "pw");
    await expect(
      account.changePassword(session, "not-the-password-1", "silver-orchard-kite-52"),
    ).rejects.toMatchObject({ field: "currentPassword" });
    await expect(
      account.changePassword(session, PASSWORD, "silver-orchard-kite-52"),
    ).resolves.toBeTruthy();
    await expect(signInWithPassword(email, "silver-orchard-kite-52")).resolves.toBeTruthy();
  });

  it("exports the account and then deletes it", async () => {
    const { uid, session } = await newCustomer(true, "delete");
    await account.mergeWishlist(uid, [{ productId: "p9", priceAtAdd: 100, addedAt: 1 }]);
    const data = await account.exportAccountData(uid);
    expect(data).toMatchObject({ profile: { uid }, wishlist: [{ productId: "p9" }] });

    await expect(account.deleteAccount(session, "wrong-password-xx")).rejects.toMatchObject({
      field: "password",
    });
    await account.deleteAccount(session, PASSWORD);
    expect(await account.getAccountUser(uid)).toBeNull();
    expect((await db.collection("users").doc(uid).collection("wishlist").get()).size).toBe(0);
    await expect(adminAuth.getUser(uid)).rejects.toMatchObject({ code: "auth/user-not-found" });
  });
});
