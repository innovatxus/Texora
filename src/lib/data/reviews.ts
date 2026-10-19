import "server-only";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { reviewSchema, type Review } from "@/lib/validation";
import { paginate, parseSnapshot, type Page, type PageRequest } from "./firestore";

export const REVIEW_SORTS = {
  newest: [{ field: "createdAt", direction: "desc" }],
  most_helpful: [{ field: "helpfulCount", direction: "desc" }],
  highest: [{ field: "rating", direction: "desc" }],
  lowest: [{ field: "rating", direction: "asc" }],
} as const satisfies Record<string, ReadonlyArray<{ field: string; direction: "asc" | "desc" }>>;

export type ReviewSort = keyof typeof REVIEW_SORTS;

export async function listApprovedReviews(
  productId: string,
  { sort, ...page }: PageRequest & { sort: ReviewSort },
): Promise<Page<Review>> {
  const base = getFirebaseAdmin()
    .db.collection("reviews")
    .where("productId", "==", productId)
    .where("status", "==", "approved");
  return paginate(base, REVIEW_SORTS[sort], page, (s) => parseSnapshot(reviewSchema, s));
}

export async function listPendingReviews(page: PageRequest): Promise<Page<Review>> {
  const base = getFirebaseAdmin().db.collection("reviews").where("status", "==", "pending");
  return paginate(base, [{ field: "createdAt", direction: "asc" }], page, (s) =>
    parseSnapshot(reviewSchema, s),
  );
}
