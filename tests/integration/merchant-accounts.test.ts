import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.20", "user-agent": "vitest" }),
  cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }),
}));

const { getFirebaseAdmin } = await import("@/lib/firebase/admin");
const service = await import("@/lib/merchant/account-service");
const { emailForUsername, getMerchantByOwner, getUsernameLock } =
  await import("@/lib/merchant/repositories/merchants");
const { signInWithPassword } = await import("@/lib/auth/identity");
const { SEED_PASSWORD } = await import("../../scripts/seed/generate");
const { getUserProfile } = await import("@/lib/data/admin-records");

const { db, auth } = getFirebaseAdmin();
const run = randomUUID().slice(0, 8);
const PASSWORD = "violet-harbour-stitch-42";
const cleanupUids: string[] = [];
const cleanupDocs: string[] = [];

afterAll(async () => {
  for (const path of cleanupDocs)
    await db
      .doc(path)
      .delete()
      .catch(() => {});
  for (const uid of cleanupUids) await auth.deleteUser(uid).catch(() => {});
});

/** Claims inside an ID token, without verifying it (the emulator's tokens are unsigned). */
function claimsOf(idToken: string): Record<string, unknown> {
  const payload = idToken.split(".")[1] ?? "";
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, unknown>;
}

/** The newest email sent to an address, from the development outbox. */
async function lastEmail(to: string, kind: string) {
  const snapshot = await db.collection("emailOutbox").where("to", "==", to).get();
  const mail = snapshot.docs
    .map((d) => d.data())
    .filter((d) => d.kind === kind)
    .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())[0];
  if (!mail) throw new Error(`No ${kind} email to ${to}`);
  return mail as { subject: string; html: string };
}

function oobCodeIn(html: string, path: string): string {
  const match = html.match(new RegExp(`${path}\\?oobCode=([^"&]+)`));
  if (!match?.[1]) throw new Error(`No ${path} link in email`);
  return decodeURIComponent(match[1]);
}

const email = `ada-${run}@example.com`;
const username = `maison${run}`;

describe("registerMerchant", () => {
  it("creates the account, username lock, merchant record and role, then emails a link", async () => {
    const result = await service.registerMerchant({ email, username, password: PASSWORD });
    cleanupUids.push(result.uid);
    cleanupDocs.push(
      `merchants/${result.vendorId}`,
      `usernames/${username}`,
      `users/${result.uid}`,
    );

    expect(claimsOf(result.idToken)).toMatchObject({ role: "vendor", vendorId: result.vendorId });
    expect((await auth.getUser(result.uid)).customClaims).toEqual({
      role: "vendor",
      vendorId: result.vendorId,
    });
    expect(await getUsernameLock(username)).toMatchObject({
      uid: result.uid,
      vendorId: result.vendorId,
    });
    expect(await getMerchantByOwner(result.uid)).toMatchObject({
      id: result.vendorId,
      email,
      username,
      status: "onboarding",
      emailVerified: false,
      trustLevel: "standard",
      shopIds: [],
    });

    // The profile is complete (it parses), not a partial role-only document.
    expect(await getUserProfile(result.uid)).toMatchObject({ email, role: "vendor" });

    const mail = await lastEmail(email, "merchant_verify_email");
    expect(mail.subject).toBe("Verify your email to open your Texora shop");
    expect(oobCodeIn(mail.html, "/merchant/verify-email")).toBeTruthy();
  });

  it("is idempotent: retrying the same registration signs in instead of failing", async () => {
    const first = await getMerchantByOwner((await auth.getUserByEmail(email)).uid);
    const retry = await service.registerMerchant({ email, username, password: PASSWORD });
    expect(retry.vendorId).toBe(first?.id);
  });

  it("refuses a taken username on the username field and rolls the account back", async () => {
    const other = `bea-${run}@example.com`;
    await expect(
      service.registerMerchant({ email: other, username, password: PASSWORD }),
    ).rejects.toMatchObject({
      code: "conflict",
      field: "username",
      message: "That username is taken",
    });
    await expect(auth.getUserByEmail(other)).rejects.toMatchObject({
      code: "auth/user-not-found",
    });
  });

  it("refuses an existing email with a different password on the email field", async () => {
    await expect(
      service.registerMerchant({
        email,
        username: `other${run}`,
        password: "a-different-phrase-99",
      }),
    ).rejects.toMatchObject({ code: "conflict", field: "email" });
    expect(await getUsernameLock(`other${run}`)).toBeNull();
  });

  it("upgrades an existing shopper who registers with their own password", async () => {
    const shopperEmail = `shopper-${run}@example.com`;
    const shopper = await auth.createUser({ email: shopperEmail, password: PASSWORD });
    cleanupUids.push(shopper.uid);
    const shopperName = `shopper${run}`;
    const result = await service.registerMerchant({
      email: shopperEmail,
      username: shopperName,
      password: PASSWORD,
    });
    cleanupDocs.push(
      `merchants/${result.vendorId}`,
      `usernames/${shopperName}`,
      `users/${shopper.uid}`,
    );
    expect(result.uid).toBe(shopper.uid);
    expect(claimsOf(result.idToken)).toMatchObject({ role: "vendor", vendorId: result.vendorId });
  });
});

describe("upgradeToMerchant", () => {
  it("adds a shop to a signed-in customer and mints a token with the new role", async () => {
    const customer = await auth.getUserByEmail("customer@texora.test");
    const name = `seeded${run}`;
    const before = customer.customClaims ?? {};
    const result = await service.upgradeToMerchant(customer.uid, name);
    cleanupDocs.push(`merchants/${result.vendorId}`, `usernames/${name}`);
    try {
      expect(claimsOf(result.idToken)).toMatchObject({ role: "vendor", vendorId: result.vendorId });
      await expect(service.upgradeToMerchant(customer.uid, `again${run}`)).rejects.toMatchObject({
        code: "conflict",
      });
    } finally {
      // Other suites sign in as this customer, so put the role back.
      await auth.setCustomUserClaims(customer.uid, before);
      await db.doc(`users/${customer.uid}`).set({ role: "customer" }, { merge: true });
    }
  });
});

describe("email verification", () => {
  it("verifies once from the emailed link and keeps the merchant record in step", async () => {
    const uid = (await auth.getUserByEmail(email)).uid;
    const code = oobCodeIn(
      (await lastEmail(email, "merchant_verify_email")).html,
      "/merchant/verify-email",
    );
    expect(await service.verifyMerchantEmail(code)).toEqual({ status: "verified" });
    expect((await getMerchantByOwner(uid))?.emailVerified).toBe(true);
    expect(await service.verifyMerchantEmail(code)).toEqual({ status: "invalid" });
  });

  it("limits resends to one a minute", async () => {
    const name = `resend${run}`;
    const resendEmail = `resend-${run}@example.com`;
    const result = await service.registerMerchant({
      email: resendEmail,
      username: name,
      password: PASSWORD,
    });
    cleanupUids.push(result.uid);
    cleanupDocs.push(`merchants/${result.vendorId}`, `usernames/${name}`);
    await service.resendMerchantVerification(result.uid, result.vendorId);
    await expect(
      service.resendMerchantVerification(result.uid, result.vendorId),
    ).rejects.toMatchObject({
      code: "limit_exceeded",
      message: expect.stringMatching(/^Wait \d+ seconds/),
    });
  });
});

describe("verifyMerchantCredentials", () => {
  it("signs in with a username or an email", async () => {
    const byName = await service.verifyMerchantCredentials(
      username,
      PASSWORD,
      `ip-a-${run}`,
      emailForUsername,
    );
    expect(byName.email).toBe(email);
    const byEmail = await service.verifyMerchantCredentials(
      email.toUpperCase(),
      PASSWORD,
      `ip-a-${run}`,
      emailForUsername,
    );
    expect(claimsOf(byEmail.idToken)).toMatchObject({ role: "vendor" });
  });

  it("gives one generic message for unknown usernames and wrong passwords", async () => {
    await expect(
      service.verifyMerchantCredentials(`nobody${run}`, PASSWORD, `ip-b-${run}`, emailForUsername),
    ).rejects.toMatchObject({ code: "unauthenticated", message: service.SIGN_IN_FAILED });
    await expect(
      service.verifyMerchantCredentials(
        username,
        "wrong-password-here",
        `ip-b-${run}`,
        emailForUsername,
      ),
    ).rejects.toMatchObject({ code: "unauthenticated", message: service.SIGN_IN_FAILED });
  });

  it("locks the account after five failures, even for the right password", async () => {
    const lockEmail = `lock-${run}@example.com`;
    const lockName = `lock${run}`;
    const result = await service.registerMerchant({
      email: lockEmail,
      username: lockName,
      password: PASSWORD,
    });
    cleanupUids.push(result.uid);
    cleanupDocs.push(`merchants/${result.vendorId}`, `usernames/${lockName}`);
    for (let i = 0; i < 5; i++) {
      await expect(
        service.verifyMerchantCredentials(
          lockEmail,
          "wrong-password-here",
          `ip-c-${run}`,
          emailForUsername,
        ),
      ).rejects.toMatchObject({ code: "unauthenticated" });
    }
    await expect(
      service.verifyMerchantCredentials(lockName, PASSWORD, `ip-c-${run}`, emailForUsername),
    ).rejects.toMatchObject({ code: "limit_exceeded", message: service.LOCKED_OUT });
  });
});

describe("password recovery", () => {
  it("says nothing about unknown emails and resets a known one", async () => {
    await service.requestMerchantPasswordReset(`unknown-${run}@example.com`, `ip-d-${run}`);
    await service.requestMerchantPasswordReset(email, `ip-d-${run}`);
    const code = oobCodeIn(
      (await lastEmail(email, "merchant_password_reset")).html,
      "/merchant/reset-password",
    );
    expect(await service.checkPasswordResetCode(code)).toBe(true);

    await expect(service.resetMerchantPassword(code, "password1234")).rejects.toMatchObject({
      field: "password",
    });
    const next = "lantern-meadow-copper-17";
    await service.resetMerchantPassword(code, next);
    await expect(signInWithPassword(email, PASSWORD)).rejects.toMatchObject({
      code: "INVALID_LOGIN_CREDENTIALS",
    });
    expect((await signInWithPassword(email, next)).idToken).toBeTruthy();
    expect(await service.checkPasswordResetCode(code)).toBe(false);
    await expect(service.resetMerchantPassword(code, next)).rejects.toMatchObject({
      code: "not_found",
    });
  });

  it("still signs in the seeded customer (recovery didn't touch other accounts)", async () => {
    expect((await signInWithPassword("customer@texora.test", SEED_PASSWORD)).idToken).toBeTruthy();
  });
});
