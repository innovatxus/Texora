import "server-only";
import { parseSnapshot } from "@/lib/data/firestore";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { merchantMediaSchema, type MerchantMedia } from "@/lib/validation/merchant";

const media = () => getFirebaseAdmin().db.collection("merchantMedia");

/** One media record. */
export async function getMedia(mediaId: string): Promise<MerchantMedia | null> {
  return parseSnapshot(merchantMediaSchema, await media().doc(mediaId).get());
}

/** A media record the merchant owns; null when missing or someone else's. */
export async function getOwnedMedia(
  vendorId: string,
  mediaId: string,
): Promise<MerchantMedia | null> {
  const record = await getMedia(mediaId);
  return record && record.vendorId === vendorId ? record : null;
}

/** Uploads never attached to anything, older than `before` (for the cleanup cron). */
export async function listStaleMedia(before: Date, limit = 200): Promise<MerchantMedia[]> {
  const snapshot = await media()
    .where("status", "in", ["tmp", "orphaned"])
    .where("createdAt", "<", before)
    .orderBy("createdAt", "asc")
    .limit(limit)
    .get();
  return snapshot.docs
    .map((d) => parseSnapshot(merchantMediaSchema, d))
    .filter((m): m is MerchantMedia => m !== null);
}
