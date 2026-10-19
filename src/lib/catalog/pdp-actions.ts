"use server";

import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { ActionError, runAction } from "@/lib/actions/run-action";
import { getUserProfile } from "@/lib/data/admin-records";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { reviewInputSchema } from "@/lib/validation";

/**
 * Review submission: signed-in customers only. Identity, verification,
 * status and votes are set here, never from the client; reviews wait for
 * moderation before they appear.
 */
export async function submitReview(input: unknown) {
  return runAction(input, {
    schema: reviewInputSchema.extend({
      title: z.string().trim().min(2, "Add a short title").max(120),
      body: z.string().trim().min(20, "Tell us a little more (at least 20 characters)").max(4000),
    }),
    access: { permission: "reviews.write" },
    handler: async (review, { session }) => {
      if (!session) throw new ActionError("unauthenticated", "Please sign in to write a review");
      const { db } = getFirebaseAdmin();
      const product = await db.collection("products").doc(review.productId).get();
      if (!product.exists)
        throw new ActionError("not_found", "This product is no longer available");

      const profile = await getUserProfile(session.uid);
      const displayName = profile
        ? `${profile.firstName} ${profile.lastName.charAt(0)}.`.trim()
        : "Texora customer";
      // Verified when the customer has an order containing this product.
      const orders = await db
        .collection("orders")
        .where("userId", "==", session.uid)
        .select("lines")
        .limit(50)
        .get();
      const verifiedPurchase = orders.docs.some((d) =>
        ((d.get("lines") as Array<{ productId: string }> | undefined) ?? []).some(
          (l) => l.productId === review.productId,
        ),
      );

      await db.collection("reviews").add({
        ...review,
        userId: session.uid,
        displayName,
        photos: [],
        verifiedPurchase,
        helpfulCount: 0,
        status: "pending",
        createdAt: new Date(),
      });
      return { status: "pending" as const };
    },
  });
}

/** Counts a "helpful" vote. The browser remembers votes so each review is voted once per device. */
export async function voteHelpful(input: unknown) {
  return runAction(input, {
    schema: z.object({ reviewId: z.string().min(1).max(128) }),
    access: { public: true },
    handler: async ({ reviewId }) => {
      const ref = getFirebaseAdmin().db.collection("reviews").doc(reviewId);
      const snapshot = await ref.get();
      if (!snapshot.exists || snapshot.get("status") !== "approved") {
        throw new ActionError("not_found", "Review not found");
      }
      await ref.update({ helpfulCount: FieldValue.increment(1) });
      return { helpfulCount: Number(snapshot.get("helpfulCount") ?? 0) + 1 };
    },
  });
}

/** Back-in-stock alert for one SKU. Idempotent per email + SKU. */
export async function notifyBackInStock(input: unknown) {
  return runAction(input, {
    schema: z.object({
      email: z.email("Enter a valid email address").max(254).toLowerCase(),
      productId: z.string().min(1).max(128),
      sku: z.string().min(1).max(64),
    }),
    access: { public: true },
    handler: async ({ email, productId, sku }) => {
      const id = `${sku}:${email}`.replace(/[/]/g, "_");
      await getFirebaseAdmin()
        .db.collection("notifications")
        .doc(id)
        .set(
          { type: "back_in_stock", email, productId, sku, createdAt: new Date() },
          { merge: true },
        );
      return { subscribed: true };
    },
  });
}
