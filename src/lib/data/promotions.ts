import "server-only";
import { createHash } from "node:crypto";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import {
  giftCardSchema,
  promoCodeSchema,
  promotionSchema,
  type GiftCard,
  type PromoCode,
  type Promotion,
} from "@/lib/validation";
import { parseSnapshot } from "./firestore";

const db = () => getFirebaseAdmin().db;

/** Whether a promotion's schedule includes this moment. */
export function isScheduledNow(promotion: Pick<Promotion, "schedule">, now: number): boolean {
  const { startsAt, endsAt } = promotion.schedule;
  return (!startsAt || startsAt.getTime() <= now) && (!endsAt || endsAt.getTime() > now);
}

/** Active promotions inside their schedule window. */
export async function listActivePromotions(now: number): Promise<Promotion[]> {
  const snapshot = await db().collection("promotions").where("active", "==", true).get();
  return snapshot.docs
    .map((s) => parseSnapshot(promotionSchema, s))
    .filter((p): p is Promotion => p !== null && isScheduledNow(p, now));
}

/** A promotion by id. */
export async function getPromotion(id: string): Promise<Promotion | null> {
  return parseSnapshot(promotionSchema, await db().collection("promotions").doc(id).get());
}

/** Upper-cases a code and removes spaces, as codes are stored. */
export function normaliseCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

/** A promo code record; null for unknown or malformed codes. */
export async function getPromoCode(code: string): Promise<PromoCode | null> {
  const id = normaliseCode(code);
  if (!/^[A-Z0-9-]{3,40}$/.test(id)) return null;
  return parseSnapshot(promoCodeSchema, await db().collection("promoCodes").doc(id).get(), "code");
}

/** SHA-256 of a normalised gift card code: the card's document id. */
export function hashGiftCardCode(code: string): string {
  return createHash("sha256").update(normaliseCode(code)).digest("hex");
}

/** Looks a gift card up by the hash of its code; the code itself is never stored. */
export async function getGiftCardByCode(code: string): Promise<GiftCard | null> {
  return parseSnapshot(
    giftCardSchema,
    await db().collection("giftCards").doc(hashGiftCardCode(code)).get(),
  );
}
