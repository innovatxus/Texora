import "server-only";
import type { Transaction } from "firebase-admin/firestore";
import { parseSnapshot } from "@/lib/data/firestore";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import {
  merchantSchema,
  usernameLockSchema,
  usernameSchema,
  type Merchant,
  type UsernameLock,
} from "@/lib/validation/merchant";

const db = () => getFirebaseAdmin().db;
const merchants = () => db().collection("merchants");
const usernames = () => db().collection("usernames");

/** Thrown when a username is already claimed by someone else. */
export class UsernameTakenError extends Error {
  constructor(public readonly username: string) {
    super(`Username ${username} is taken`);
    this.name = "UsernameTakenError";
  }
}

/** A merchant by vendor id. */
export async function getMerchant(vendorId: string): Promise<Merchant | null> {
  return parseSnapshot(merchantSchema, await merchants().doc(vendorId).get());
}

/** The merchant account a user owns, if any. */
export async function getMerchantByOwner(uid: string): Promise<Merchant | null> {
  const snapshot = await merchants().where("ownerUid", "==", uid).limit(1).get();
  const doc = snapshot.docs[0];
  return doc ? parseSnapshot(merchantSchema, doc) : null;
}

/** The lock for a username, or null if it is free. */
export async function getUsernameLock(username: string): Promise<UsernameLock | null> {
  return parseSnapshot(usernameLockSchema, await usernames().doc(username).get());
}

/**
 * Whether a username can be claimed: well-formed, not reserved and not locked
 * (or locked by `uid` itself). Advisory only; the claim transaction decides.
 */
export async function isUsernameAvailable(username: string, uid?: string): Promise<boolean> {
  const parsed = usernameSchema.safeParse(username);
  if (!parsed.success) return false;
  const lock = await getUsernameLock(parsed.data);
  return lock === null || lock.uid === uid;
}

/**
 * Claims a username inside a transaction: the lock document is the guarantee
 * of uniqueness, never a query. Re-claiming your own username is a no-op.
 * Reads happen first, as Firestore transactions require.
 */
export async function claimUsername(
  tx: Transaction,
  username: string,
  owner: { uid: string; vendorId: string },
  now: Date,
): Promise<void> {
  const ref = usernames().doc(username);
  const existing = await tx.get(ref);
  if (existing.exists) {
    if (existing.get("uid") === owner.uid) return;
    throw new UsernameTakenError(username);
  }
  tx.create(ref, { uid: owner.uid, vendorId: owner.vendorId, createdAt: now });
}

/** Releases a username, only if `uid` holds it (used by registration rollback). */
export async function releaseUsername(username: string, uid: string): Promise<void> {
  await db().runTransaction(async (tx) => {
    const ref = usernames().doc(username);
    const lock = await tx.get(ref);
    if (lock.exists && lock.get("uid") === uid) tx.delete(ref);
  });
}

/** Resolves a username to the account email for sign-in; null when unknown. */
export async function emailForUsername(username: string): Promise<string | null> {
  const parsed = usernameSchema.safeParse(username);
  if (!parsed.success) return null;
  const lock = await getUsernameLock(parsed.data);
  if (!lock) return null;
  return (await getMerchant(lock.vendorId))?.email ?? null;
}
