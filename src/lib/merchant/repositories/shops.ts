import "server-only";
import type { Transaction } from "firebase-admin/firestore";
import { ActionError } from "@/lib/actions/run-action";
import { parseSnapshot } from "@/lib/data/firestore";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import {
  shopSchema,
  shopSlugLockSchema,
  shopSlugSchema,
  type Shop,
  type ShopSlugLock,
} from "@/lib/validation/merchant";

const db = () => getFirebaseAdmin().db;
const shops = () => db().collection("shops");
const shopSlugs = () => db().collection("shopSlugs");

/** Thrown when a shop address is already claimed by another shop. */
export class ShopSlugTakenError extends Error {
  constructor(public readonly slug: string) {
    super(`Shop address ${slug} is taken`);
    this.name = "ShopSlugTakenError";
  }
}

/** A shop by id, any status. */
export async function getShop(shopId: string): Promise<Shop | null> {
  return parseSnapshot(shopSchema, await shops().doc(shopId).get());
}

/**
 * A shop the merchant owns. Missing and not-owned look the same, so ids can't
 * be probed. `vendorId` must come from the session, never from the client.
 */
export async function getOwnedShop(vendorId: string, shopId: string): Promise<Shop> {
  const shop = await getShop(shopId);
  if (!shop || shop.vendorId !== vendorId) {
    throw new ActionError("not_found", "We couldn't find that shop.");
  }
  return shop;
}

/** A merchant's shops, oldest first (the first is the default). */
export async function listShopsForVendor(vendorId: string): Promise<Shop[]> {
  const snapshot = await shops().where("vendorId", "==", vendorId).get();
  return snapshot.docs
    .map((d) => parseSnapshot(shopSchema, d))
    .filter((s): s is Shop => s !== null)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

/** Shops in one status, longest waiting first (review queues). */
export async function listShopsByStatus(status: Shop["status"], limit = 100): Promise<Shop[]> {
  const snapshot = await shops()
    .where("status", "==", status)
    .orderBy("updatedAt", "asc")
    .limit(limit)
    .get();
  return snapshot.docs
    .map((d) => parseSnapshot(shopSchema, d))
    .filter((s): s is Shop => s !== null);
}

/** The lock for a shop address, or null if it is free. */
export async function getShopSlugLock(slug: string): Promise<ShopSlugLock | null> {
  return parseSnapshot(shopSlugLockSchema, await shopSlugs().doc(slug).get());
}

/** The shop at an address, any status; null when unknown. */
export async function getShopBySlug(slug: string): Promise<Shop | null> {
  const lock = await getShopSlugLock(slug);
  return lock ? getShop(lock.shopId) : null;
}

/** Whether a shop address can be claimed (free, or already held by `shopId`). Advisory. */
export async function isShopSlugAvailable(slug: string, shopId?: string): Promise<boolean> {
  const parsed = shopSlugSchema.safeParse(slug);
  if (!parsed.success) return false;
  const lock = await getShopSlugLock(parsed.data);
  return lock === null || lock.shopId === shopId;
}

/**
 * Claims a shop address in a transaction and releases the shop's previous one.
 * The lock document guarantees uniqueness. Reads happen before writes.
 */
export async function claimShopSlug(
  tx: Transaction,
  slug: string,
  owner: { shopId: string; vendorId: string },
  now: Date,
  previousSlug?: string,
): Promise<void> {
  const ref = shopSlugs().doc(slug);
  const previousRef = previousSlug && previousSlug !== slug ? shopSlugs().doc(previousSlug) : null;
  const existing = await tx.get(ref);
  const previous = previousRef ? await tx.get(previousRef) : null;
  if (existing.exists && existing.get("shopId") !== owner.shopId) {
    throw new ShopSlugTakenError(slug);
  }
  if (!existing.exists) {
    tx.create(ref, { shopId: owner.shopId, vendorId: owner.vendorId, createdAt: now });
  }
  if (previousRef && previous?.exists && previous.get("shopId") === owner.shopId) {
    tx.delete(previousRef);
  }
}
