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

/**
 * Media to delete (for the cleanup cron): processed but never attached since
 * before `before`, or orphaned (replaced or removed) since before `before`.
 */
export async function listStaleMedia(before: Date, limit = 200): Promise<MerchantMedia[]> {
  const [unused, orphaned] = await Promise.all([
    media()
      .where("status", "==", "tmp")
      .where("createdAt", "<", before)
      .orderBy("createdAt", "asc")
      .limit(limit)
      .get(),
    media()
      .where("status", "==", "orphaned")
      .where("orphanedAt", "<", before)
      .orderBy("orphanedAt", "asc")
      .limit(limit)
      .get(),
  ]);
  return [...unused.docs, ...orphaned.docs]
    .map((d) => parseSnapshot(merchantMediaSchema, d))
    .filter((m): m is MerchantMedia => m !== null);
}
