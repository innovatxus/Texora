import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.70", "user-agent": "vitest" }),
  cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }),
}));

const { getFirebaseAdmin } = await import("@/lib/firebase/admin");
const { registerMerchant } = await import("@/lib/merchant/account-service");
const settings = await import("@/lib/merchant/settings-service");
const { getMerchant, getUsernameLock } = await import("@/lib/merchant/repositories/merchants");
const { signInWithPassword } = await import("@/lib/auth/identity");
const { FieldValue } = await import("firebase-admin/firestore");

const { db, auth } = getFirebaseAdmin();
const run = randomUUID().slice(0, 8);
const PASSWORD = "violet-harbour-stitch-42";
const cleanupUids: string[] = [];
const cleanupDocs: string[] = [];

type Actor = Parameters<typeof settings.updateDisplayName>[0];
let actor: Actor;
let other: Actor;
let email = `set-${run}@example.com`;
let username = `settings${run}`;

async function register(e: string, u: string): Promise<Actor> {
  const result = await registerMerchant({ email: e, username: u, password: PASSWORD });
  cleanupUids.push(result.uid);
  cleanupDocs.push(`merchants/${result.vendorId}`, `usernames/${u}`, `users/${result.uid}`);
  return {
    session: {
      uid: result.uid,
      email: e,
      role: "vendor",
      vendorId: result.vendorId,
      emailVerified: false,
    } as Actor["session"],
    vendorId: result.vendorId,
  };
}

beforeAll(async () => {
  actor = await register(email, username);
  other = await register(`set-other-${run}@example.com`, `setother${run}`);
});

afterAll(async () => {
  for (const path of cleanupDocs)
    await db
      .doc(path)
      .delete()
      .catch(() => {});
  for (const uid of cleanupUids) await auth.deleteUser(uid).catch(() => {});
});

describe("account settings", () => {
  it("defaults every optional email to on", async () => {
    expect((await getMerchant(actor.vendorId))?.notifications).toEqual({
      newOrders: true,
      productReviews: true,
    });
  });

  it("updates the display name", async () => {
    await settings.updateDisplayName(actor, "Ada Lovelace");
    expect((await getMerchant(actor.vendorId))?.displayName).toBe("Ada Lovelace");
  });

  it("only touches the signed-in owner's account", async () => {
    await expect(
      settings.updateDisplayName({ ...actor, vendorId: other.vendorId }, "Hijack"),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("changes the username, moves the lock and then holds it for 30 days", async () => {
    const next = `renamed${run}`;
    cleanupDocs.push(`usernames/${next}`);
    const now = new Date("2026-10-20T12:00:00Z");
    await settings.changeUsername(actor, next, now);
    expect(await getUsernameLock(next)).toMatchObject({ uid: actor.session.uid });
    expect(await getUsernameLock(username)).toBeNull();
    username = next;

    await expect(
      settings.changeUsername(actor, `again${run}`, new Date("2026-11-01T12:00:00Z")),
    ).rejects.toMatchObject({ code: "conflict", field: "username" });
  });

  it("refuses a username that's taken", async () => {
    await db.doc(`merchants/${actor.vendorId}`).update({ usernameChangedAt: FieldValue.delete() });
    await expect(settings.changeUsername(actor, `setother${run}`)).rejects.toMatchObject({
      field: "username",
    });
  });

  it("changes the email and asks for it to be verified again", async () => {
    await auth.updateUser(actor.session.uid, { emailVerified: true });
    const next = `set-new-${run}@example.com`;
    await settings.changeEmail(actor, next);
    expect(await getMerchant(actor.vendorId)).toMatchObject({ email: next, emailVerified: false });
    expect((await auth.getUser(actor.session.uid)).emailVerified).toBe(false);
    const mail = await db
      .collection("emailOutbox")
      .where("to", "==", next)
      .where("kind", "==", "merchant_verify_email")
      .get();
    expect(mail.size).toBe(1);
    email = next;
  });

  it("refuses an email that another account uses", async () => {
    await expect(settings.changeEmail(actor, `set-other-${run}@example.com`)).rejects.toMatchObject(
      { code: "conflict", field: "email" },
    );
  });
});

describe("password", () => {
  it("checks the current password", async () => {
    await expect(
      settings.changePassword(actor, "not-the-password-at-all", "another-long-phrase-77"),
    ).rejects.toMatchObject({ field: "currentPassword" });
  });

  it("refuses a weak new password", async () => {
    await expect(settings.changePassword(actor, PASSWORD, "password1234")).rejects.toMatchObject({
      field: "newPassword",
    });
  });

  it("changes it, revokes other sessions and returns a fresh token", async () => {
    const revoke = vi.spyOn(auth, "revokeRefreshTokens");
    const idToken = await settings.changePassword(actor, PASSWORD, "copper-lantern-meadow-19");
    expect(idToken).toBeTruthy();
    expect(revoke).toHaveBeenCalledWith(actor.session.uid);
    await expect(signInWithPassword(email, PASSWORD)).rejects.toThrow();
    await expect(signInWithPassword(email, "copper-lantern-meadow-19")).resolves.toBeTruthy();
  });
});

describe("notifications", () => {
  it("saves the optional email preferences", async () => {
    await settings.updateNotifications(actor, { newOrders: false, productReviews: true });
    expect((await getMerchant(actor.vendorId))?.notifications).toEqual({
      newOrders: false,
      productReviews: true,
    });
  });
});
