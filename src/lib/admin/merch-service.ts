import "server-only";
import { randomInt } from "node:crypto";
import { ActionError } from "@/lib/actions/run-action";
import { writeAuditLog } from "@/lib/audit/log";
import type { Session } from "@/lib/auth/session";
import { summariseReviews } from "@/lib/catalog/variant-selection";
import { parseSnapshot } from "@/lib/data/firestore";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import {
  priceChangeRequestSchema,
  promoCodeSchema,
  promotionSchema,
  reviewSchema,
  type PriceChangeRequest,
  type PromoCode,
  type Promotion,
  type Review,
} from "@/lib/validation";
import { invalidate } from "./revalidate";

const db = () => getFirebaseAdmin().db;

// ------------------------------------------------------------ promotions

/** Every promotion, highest priority first. */
export async function listPromotions(): Promise<Promotion[]> {
  const snap = await db().collection("promotions").get();
  return snap.docs
    .map((d) => parseSnapshot(promotionSchema, d))
    .filter((p): p is Promotion => p !== null)
    .sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name));
}

/** Codes that unlock a promotion. */
export async function listPromoCodes(promotionId: string): Promise<PromoCode[]> {
  const snap = await db().collection("promoCodes").where("promotionId", "==", promotionId).get();
  return snap.docs
    .map((d) => parseSnapshot(promoCodeSchema, d, "code"))
    .filter((c): c is PromoCode => c !== null)
    .sort((a, b) => a.code.localeCompare(b.code));
}

/** Creates or updates a promotion. The id is derived from the name on create. */
export async function savePromotion(
  actor: Session,
  input: Omit<Promotion, "id"> & { id?: string | undefined },
): Promise<string> {
  const { id: given, ...fields } = input;
  const id =
    given ??
    `${fields.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40)}-${randomInt(1000, 9999)}`;
  const promotion = promotionSchema.parse({ id, ...fields });
  const ref = db().collection("promotions").doc(id);
  const before = await ref.get();
  const { id: _omit, ...doc } = promotion;
  await ref.set(doc);
  await writeAuditLog({
    actor,
    action: given ? "promotions.update" : "promotions.create",
    target: { type: "promotion", id },
    before: before.exists ? (before.data() as Record<string, unknown>) : null,
    after: doc as unknown as Record<string, unknown>,
  });
  invalidate("promotions");
  return id;
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * Generates unique single-use or limited codes for a promotion, e.g. for
 * an email campaign. Codes are PREFIX-XXXXXX; collisions are retried.
 */
export async function generatePromoCodes(
  actor: Session,
  promotionId: string,
  options: {
    prefix: string;
    count: number;
    usageLimit?: number | undefined;
    perCustomerLimit?: number | undefined;
  },
): Promise<string[]> {
  const promotion = await db().collection("promotions").doc(promotionId).get();
  if (!promotion.exists) throw new ActionError("not_found", "Promotion not found");
  const codes = new Set<string>();
  const random = () =>
    Array.from({ length: 6 }, () => CODE_ALPHABET.charAt(randomInt(CODE_ALPHABET.length))).join("");
  while (codes.size < options.count) codes.add(`${options.prefix}-${random()}`);
  const list = [...codes];
  const existing = await db().getAll(...list.map((c) => db().collection("promoCodes").doc(c)));
  const taken = new Set(existing.filter((s) => s.exists).map((s) => s.id));
  const fresh = list.filter((c) => !taken.has(c));
  const batch = db().batch();
  for (const code of fresh) {
    batch.create(db().collection("promoCodes").doc(code), {
      promotionId,
      ...(options.usageLimit ? { usageLimit: options.usageLimit } : {}),
      ...(options.perCustomerLimit ? { perCustomerLimit: options.perCustomerLimit } : {}),
      usedCount: 0,
      active: true,
    });
  }
  await batch.commit();
  await writeAuditLog({
    actor,
    action: "promotions.generate_codes",
    target: { type: "promotion", id: promotionId },
    after: { count: fresh.length, prefix: options.prefix },
  });
  return fresh;
}

/** Turns a code on or off without deleting its usage history. */
export async function setPromoCodeActive(
  actor: Session,
  code: string,
  active: boolean,
): Promise<void> {
  const ref = db().collection("promoCodes").doc(code);
  if (!(await ref.get()).exists) throw new ActionError("not_found", "Code not found");
  await ref.update({ active });
  await writeAuditLog({
    actor,
    action: "promotions.set_code_active",
    target: { type: "promo_code", id: code },
    after: { active },
  });
}

// --------------------------------------------------------- price changes

/** Price change requests by status, newest first. */
export async function listPriceRequests(
  status: PriceChangeRequest["status"],
): Promise<PriceChangeRequest[]> {
  const snap = await db()
    .collection("priceChangeRequests")
    .where("status", "==", status)
    .orderBy("createdAt", "desc")
    .limit(100)
    .get();
  return snap.docs
    .map((d) => parseSnapshot(priceChangeRequestSchema, d))
    .filter((r): r is PriceChangeRequest => r !== null);
}

// --------------------------------------------------------------- reviews

/** Reviews waiting for moderation, oldest first. */
export async function listReviewQueue(): Promise<Review[]> {
  const snap = await db()
    .collection("reviews")
    .where("status", "==", "pending")
    .orderBy("createdAt", "asc")
    .limit(50)
    .get();
  return snap.docs
    .map((d) => parseSnapshot(reviewSchema, d))
    .filter((r): r is Review => r !== null);
}

/**
 * Approves or rejects a review. Approving (or un-approving) recalculates
 * the product's rating, review count and fit score from approved reviews.
 */
export async function moderateReview(
  actor: Session,
  reviewId: string,
  decision: "approved" | "rejected",
): Promise<void> {
  const ref = db().collection("reviews").doc(reviewId);
  const review = parseSnapshot(reviewSchema, await ref.get());
  if (!review) throw new ActionError("not_found", "Review not found");
  await ref.update({ status: decision, moderatedBy: actor.uid });

  const approved = await db()
    .collection("reviews")
    .where("productId", "==", review.productId)
    .where("status", "==", "approved")
    .select("rating", "fit")
    .get();
  const summary = summariseReviews(
    approved.docs.map((d) => ({
      rating: Number(d.get("rating")),
      fit: d.get("fit") as number | undefined,
    })),
  );
  const productRef = db().collection("products").doc(review.productId);
  const product = await productRef.get();
  await productRef.update({
    ratingAvg: Math.round(summary.average * 10) / 10,
    ratingCount: summary.count,
    ...(summary.fit !== null ? { fitScore: summary.fit } : {}),
  });
  await writeAuditLog({
    actor,
    action: `reviews.${decision === "approved" ? "approve" : "reject"}`,
    target: { type: "review", id: reviewId },
    before: { status: review.status },
    after: { status: decision },
  });
  invalidate("reviews", "products", `product:${String(product.get("slug"))}`);
}
