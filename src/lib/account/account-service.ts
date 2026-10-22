import "server-only";
import { randomUUID } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { ActionError } from "@/lib/actions/run-action";
import { writeAuditLog } from "@/lib/audit/log";
import { IdentityError, signInWithPassword } from "@/lib/auth/identity";
import type { Session } from "@/lib/auth/session";
import { parseSnapshot } from "@/lib/data/firestore";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import type { AddressInput } from "@/lib/validation/account";
import { cartSchema, type Cart } from "@/lib/validation/commerce";
import {
  savedAddressSchema,
  userSchema,
  wishlistItemSchema,
  type SavedAddress,
  type User,
  type WishlistItem,
} from "@/lib/validation/customer";
import { returnSchema, type Return } from "@/lib/validation";

const db = () => getFirebaseAdmin().db;
const userRef = (uid: string) => db().collection("users").doc(uid);

/** A customer's profile; null when it doesn't exist (or no longer parses). */
export async function getAccountUser(uid: string): Promise<User | null> {
  return parseSnapshot(userSchema, await userRef(uid).get(), "uid");
}

async function requireUser(uid: string): Promise<User> {
  const user = await getAccountUser(uid);
  if (!user) throw new ActionError("not_found", "We couldn't find your account.");
  return user;
}

// ---------------------------------------------------------------- profile

export async function updateDetails(
  uid: string,
  details: { firstName: string; lastName: string; phone?: string | undefined },
  now = new Date(),
): Promise<void> {
  await requireUser(uid);
  await userRef(uid).update({
    firstName: details.firstName,
    lastName: details.lastName,
    // Absent, not null: the profile schema has no null phone.
    phone: details.phone || FieldValue.delete(),
    updatedAt: now,
  });
  await getFirebaseAdmin().auth.updateUser(uid, {
    displayName: `${details.firstName} ${details.lastName}`,
  });
}

export async function updateSizePreferences(
  uid: string,
  prefs: { fitFamily?: User["preferences"]["fitFamily"]; savedSizes: User["savedSizes"] },
  now = new Date(),
): Promise<void> {
  const user = await requireUser(uid);
  const savedSizes = Object.fromEntries(
    Object.entries(prefs.savedSizes).filter(([, size]) => typeof size === "string" && size),
  );
  const { fitFamily: _old, ...preferences } = user.preferences;
  await userRef(uid).update({
    preferences: { ...preferences, ...(prefs.fitFamily ? { fitFamily: prefs.fitFamily } : {}) },
    savedSizes,
    updatedAt: now,
  });
}

export async function updateCommunication(
  uid: string,
  prefs: { marketingEmail: boolean; marketingSms: boolean },
  now = new Date(),
): Promise<void> {
  const user = await requireUser(uid);
  await userRef(uid).update({ preferences: { ...user.preferences, ...prefs }, updatedAt: now });
}

// -------------------------------------------------------------- addresses

const addresses = (uid: string) => userRef(uid).collection("addresses");

export async function listAddresses(uid: string): Promise<SavedAddress[]> {
  const snap = await addresses(uid).get();
  return snap.docs
    .map((d) => parseSnapshot(savedAddressSchema, d))
    .filter((a): a is SavedAddress => a !== null)
    .sort(
      (a, b) =>
        Number(b.isDefaultShipping) - Number(a.isDefaultShipping) ||
        a.firstName.localeCompare(b.firstName),
    );
}

/** Creates or updates an address; setting a default clears it from the others. */
export async function saveAddress(uid: string, input: AddressInput): Promise<string> {
  const id = input.id || randomUUID();
  const existing = await listAddresses(uid);
  if (input.id && !existing.some((a) => a.id === input.id)) {
    throw new ActionError("not_found", "We couldn't find that address.");
  }
  if (!input.id && existing.length >= 20) {
    throw new ActionError("conflict", "You can save up to 20 addresses. Remove one first.");
  }
  // The first address becomes the default for both.
  const first = existing.length === 0;
  const { id: _id, ...fields } = input;
  const address = savedAddressSchema.parse({
    ...fields,
    id,
    isDefaultShipping: first || Boolean(input.isDefaultShipping),
    isDefaultBilling: first || Boolean(input.isDefaultBilling),
  });
  const batch = db().batch();
  for (const other of existing) {
    if (other.id === id) continue;
    const clear: Record<string, boolean> = {};
    if (address.isDefaultShipping && other.isDefaultShipping) clear.isDefaultShipping = false;
    if (address.isDefaultBilling && other.isDefaultBilling) clear.isDefaultBilling = false;
    if (Object.keys(clear).length) batch.update(addresses(uid).doc(other.id), clear);
  }
  const { id: _ignored, ...data } = address;
  batch.set(addresses(uid).doc(id), data);
  await batch.commit();
  return id;
}

/** Removes an address; if it was a default, the next address takes over. */
export async function deleteAddress(uid: string, id: string): Promise<void> {
  const existing = await listAddresses(uid);
  const target = existing.find((a) => a.id === id);
  if (!target) throw new ActionError("not_found", "We couldn't find that address.");
  const rest = existing.filter((a) => a.id !== id);
  const batch = db().batch();
  batch.delete(addresses(uid).doc(id));
  const heir = rest[0];
  if (heir && (target.isDefaultShipping || target.isDefaultBilling)) {
    batch.update(addresses(uid).doc(heir.id), {
      ...(target.isDefaultShipping ? { isDefaultShipping: true } : {}),
      ...(target.isDefaultBilling ? { isDefaultBilling: true } : {}),
    });
  }
  await batch.commit();
}

// --------------------------------------------------------------- wishlist

const wishlist = (uid: string) => userRef(uid).collection("wishlist");

export async function listWishlist(uid: string): Promise<WishlistItem[]> {
  const snap = await wishlist(uid).orderBy("addedAt", "desc").limit(200).get();
  return snap.docs
    .map((d) => parseSnapshot(wishlistItemSchema, d))
    .filter((w): w is WishlistItem => w !== null);
}

/** Adds items (one per product; the earliest save keeps its price-drop baseline). */
export async function mergeWishlist(
  uid: string,
  items: ReadonlyArray<{ productId: string; color?: string; priceAtAdd: number; addedAt: number }>,
): Promise<WishlistItem[]> {
  const current = new Map((await listWishlist(uid)).map((w) => [w.productId, w]));
  const batch = db().batch();
  let writes = 0;
  for (const item of items.slice(0, 200)) {
    if (current.has(item.productId)) continue;
    const doc = wishlistItemSchema.parse({
      id: item.productId,
      productId: item.productId,
      ...(item.color ? { color: item.color } : {}),
      priceAtAdd: item.priceAtAdd,
      addedAt: new Date(item.addedAt),
    });
    const { id: _id, ...data } = doc;
    batch.set(wishlist(uid).doc(item.productId), data);
    writes++;
  }
  if (writes) await batch.commit();
  return listWishlist(uid);
}

export async function removeFromWishlist(uid: string, productId: string): Promise<void> {
  await wishlist(uid).doc(productId).delete();
}

// ------------------------------------------------------------------- bag

const cartRef = (uid: string) => db().collection("carts").doc(uid);

/** The signed-in shopper's saved bag (cross-device), or null. */
export async function getSavedCart(uid: string): Promise<Cart | null> {
  return parseSnapshot(cartSchema, await cartRef(uid).get());
}

/** Replaces the saved bag with this device's bag (the client merges first). */
export async function saveCart(
  uid: string,
  lines: Cart["lines"],
  promoCodes: string[],
  now = new Date(),
): Promise<void> {
  const cart = cartSchema.parse({ id: uid, ownerUid: uid, lines, promoCodes, updatedAt: now });
  const { id: _id, ...data } = cart;
  await cartRef(uid).set(data);
}

// ---------------------------------------------------------------- returns

export async function listReturnsForUser(uid: string): Promise<Return[]> {
  const snap = await db()
    .collection("returns")
    .where("userId", "==", uid)
    .orderBy("createdAt", "desc")
    .limit(50)
    .get();
  return snap.docs.map((d) => parseSnapshot(returnSchema, d)).filter((r): r is Return => !!r);
}

// --------------------------------------------------------------- security

/** Checks the current password; wrong ones fail on the field, not the form. */
async function verifyPassword(email: string, password: string, field: string): Promise<void> {
  try {
    await signInWithPassword(email, password);
  } catch (error) {
    if (error instanceof IdentityError) {
      throw new ActionError("conflict", "That password isn't right.", field);
    }
    throw error;
  }
}

/**
 * Changes the password after checking the current one. Every other device
 * is signed out; returns a fresh ID token so this device stays signed in.
 */
export async function changePassword(
  session: Session,
  current: string,
  next: string,
): Promise<string> {
  const user = await requireUser(session.uid);
  await verifyPassword(user.email, current, "currentPassword");
  const { auth } = getFirebaseAdmin();
  await auth.updateUser(session.uid, { password: next });
  await auth.revokeRefreshTokens(session.uid);
  await writeAuditLog({
    actor: session,
    action: "account.change_password",
    target: { type: "user", id: session.uid },
  });
  return (await signInWithPassword(user.email, next)).idToken;
}

/** Everything we hold about the customer, as one JSON document (data export). */
export async function exportAccountData(uid: string): Promise<Record<string, unknown>> {
  const user = await requireUser(uid);
  const [addressList, wishlistItems, returns, ledger, orders] = await Promise.all([
    listAddresses(uid),
    listWishlist(uid),
    listReturnsForUser(uid),
    userRef(uid).collection("loyaltyLedger").orderBy("at", "desc").limit(500).get(),
    db()
      .collection("orders")
      .where("userId", "==", uid)
      .orderBy("placedAt", "desc")
      .limit(500)
      .get(),
  ]);
  return {
    exportedAt: new Date().toISOString(),
    profile: user,
    addresses: addressList,
    wishlist: wishlistItems,
    orders: orders.docs.map((d) => {
      const data = d.data();
      // Payment provider references stay internal.
      const { payments: _payments, idempotencyKey: _key, ...rest } = data;
      return { id: d.id, ...rest };
    }),
    returns,
    rewardsHistory: ledger.docs.map((d) => ({ id: d.id, ...d.data() })),
  };
}

/**
 * Deletes the account after checking the password: the sign-in, profile,
 * addresses, wishlist, saved bag and rewards history go. Orders and returns
 * are kept (tax and consumer law) but no longer linked to a profile.
 */
export async function deleteAccount(session: Session, password: string): Promise<void> {
  const user = await requireUser(session.uid);
  await verifyPassword(user.email, password, "password");
  if (session.role !== "customer" && session.role !== "loyalty_member") {
    throw new ActionError(
      "forbidden",
      "Staff and merchant accounts are closed by an administrator. Contact support.",
    );
  }
  const { auth } = getFirebaseAdmin();
  const firestore = db();
  for (const sub of ["addresses", "wishlist", "paymentMethods", "loyaltyLedger"]) {
    const docs = await userRef(session.uid).collection(sub).listDocuments();
    for (let i = 0; i < docs.length; i += 400) {
      const batch = firestore.batch();
      for (const doc of docs.slice(i, i + 400)) batch.delete(doc);
      await batch.commit();
    }
  }
  await cartRef(session.uid).delete();
  await userRef(session.uid).delete();
  await auth.deleteUser(session.uid);
  await writeAuditLog({
    actor: session,
    action: "account.delete",
    target: { type: "user", id: session.uid },
  });
}
