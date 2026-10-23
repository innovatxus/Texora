import { LOCALE, TIME_ZONE } from "@/config/locale";
import "server-only";
import { MERCHANT_LIMITS } from "@/config/merchant";
import { ActionError } from "@/lib/actions/run-action";
import { writeAuditLog } from "@/lib/audit/log";
import { IdentityError, signInWithPassword } from "@/lib/auth/identity";
import { passwordProblem } from "@/lib/auth/password";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { sendMerchantVerification } from "./account-service";
import { claimUsername, getMerchant, UsernameTakenError } from "./repositories/merchants";
import type { MerchantActor } from "./shop-service";

const merchants = () => getFirebaseAdmin().db.collection("merchants");

async function load(actor: MerchantActor) {
  const merchant = await getMerchant(actor.vendorId);
  if (!merchant || merchant.ownerUid !== actor.session.uid) {
    throw new ActionError("not_found", "We couldn't find your merchant account.");
  }
  return merchant;
}

/** Display name shown in the portal and to Texora staff. */
export async function updateDisplayName(
  actor: MerchantActor,
  displayName: string,
  now = new Date(),
): Promise<void> {
  const merchant = await load(actor);
  await merchants().doc(merchant.id).update({ displayName, updatedAt: now });
}

/**
 * Changes the sign-in email: the address must be re-verified, so submitting
 * and publishing pause until the new link is opened.
 */
export async function changeEmail(
  actor: MerchantActor,
  email: string,
  now = new Date(),
): Promise<void> {
  const merchant = await load(actor);
  if (email === merchant.email) return;
  const { auth, db } = getFirebaseAdmin();
  try {
    await auth.updateUser(actor.session.uid, { email, emailVerified: false });
  } catch (error) {
    if ((error as { code?: string }).code === "auth/email-already-exists") {
      throw new ActionError("conflict", "Another account already uses that email.", "email");
    }
    throw error;
  }
  await merchants().doc(merchant.id).update({ email, emailVerified: false, updatedAt: now });
  await db
    .collection("users")
    .doc(actor.session.uid)
    .set({ email, updatedAt: now }, { merge: true });
  await writeAuditLog({
    actor: actor.session,
    action: "merchants.change_email",
    target: { type: "merchant", id: merchant.id },
    before: { email: merchant.email },
    after: { email },
  });
  await sendMerchantVerification(email, merchant.username);
}

/** Changes the username (the lock moves in one transaction), at most once every 30 days. */
export async function changeUsername(
  actor: MerchantActor,
  username: string,
  now = new Date(),
): Promise<void> {
  const merchant = await load(actor);
  if (username === merchant.username) return;
  const days = MERCHANT_LIMITS.username.changeEveryDays;
  if (merchant.usernameChangedAt) {
    const next = new Date(merchant.usernameChangedAt.getTime() + days * 86_400_000);
    if (next > now) {
      const fmt = new Intl.DateTimeFormat(LOCALE, {
        timeZone: TIME_ZONE,
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      throw new ActionError(
        "conflict",
        `You changed your username on ${fmt.format(merchant.usernameChangedAt)}. You can change it again on ${fmt.format(next)}.`,
        "username",
      );
    }
  }
  const { db } = getFirebaseAdmin();
  try {
    await db.runTransaction(async (tx) => {
      const oldRef = db.collection("usernames").doc(merchant.username);
      const old = await tx.get(oldRef);
      await claimUsername(tx, username, { uid: actor.session.uid, vendorId: merchant.id }, now);
      if (old.exists && old.get("uid") === actor.session.uid) tx.delete(oldRef);
      tx.update(merchants().doc(merchant.id), { username, usernameChangedAt: now, updatedAt: now });
    });
  } catch (error) {
    if (error instanceof UsernameTakenError)
      throw new ActionError("conflict", "That username is taken", "username");
    throw error;
  }
  await writeAuditLog({
    actor: actor.session,
    action: "merchants.change_username",
    target: { type: "merchant", id: merchant.id },
    before: { username: merchant.username },
    after: { username },
  });
}

/**
 * Changes the password after checking the current one. Every other device
 * is signed out; returns a fresh ID token so this device stays signed in.
 */
export async function changePassword(
  actor: MerchantActor,
  current: string,
  next: string,
): Promise<string> {
  const merchant = await load(actor);
  try {
    await signInWithPassword(merchant.email, current);
  } catch (error) {
    if (error instanceof IdentityError) {
      throw new ActionError("conflict", "Your current password isn't right.", "currentPassword");
    }
    throw error;
  }
  const problem = passwordProblem(next, [merchant.email, merchant.username]);
  if (problem) throw new ActionError("conflict", problem, "newPassword");
  const { auth } = getFirebaseAdmin();
  await auth.updateUser(actor.session.uid, { password: next });
  await auth.revokeRefreshTokens(actor.session.uid);
  await writeAuditLog({
    actor: actor.session,
    action: "merchants.change_password",
    target: { type: "user", id: actor.session.uid },
  });
  return (await signInWithPassword(merchant.email, next)).idToken;
}

/** Optional email preferences (shop status emails can't be turned off). */
export async function updateNotifications(
  actor: MerchantActor,
  prefs: { newOrders: boolean; productReviews: boolean },
  now = new Date(),
): Promise<void> {
  const merchant = await load(actor);
  await merchants().doc(merchant.id).update({ notifications: prefs, updatedAt: now });
}
