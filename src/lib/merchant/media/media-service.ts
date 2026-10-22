import "server-only";
import { randomUUID } from "node:crypto";
import type { Transaction } from "firebase-admin/firestore";
import { MERCHANT_LIMITS, type MediaKind } from "@/config/merchant";
import { ActionError } from "@/lib/actions/run-action";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { logger } from "@/lib/observability/logger";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import type { MerchantImage, MerchantMedia } from "@/lib/validation/merchant";
import { getOwnedMedia, listStaleMedia } from "../repositories/media";
import { getOwnedShop } from "../repositories/shops";
import { MediaRejectedError, processUpload } from "./process";
import { maxBytes, type CropRect } from "./rules";

/** Where the browser uploads raw files (Storage rules allow only this). */
export function tmpPath(vendorId: string, shopId: string, uploadId: string): string {
  return `merchant-media/${vendorId}/${shopId}/tmp/${uploadId}`;
}

/** Where processed files live; served by `/media/m/...` (D-064). */
export function mediaPath(vendorId: string, shopId: string, file: string): string {
  return `merchant-media/${vendorId}/${shopId}/media/${file}`;
}

/** The public URL of a processed file, as `next/image` and `<video>` use it. */
export function mediaUrl(vendorId: string, shopId: string, file: string): string {
  return `/media/m/${vendorId}/${shopId}/${file}`;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const bucket = () => getFirebaseAdmin().storage.bucket();
const mediaCollection = () => getFirebaseAdmin().db.collection("merchantMedia");

/**
 * A short-lived Firebase custom token, so the browser can upload straight to
 * Storage as this merchant. The role and vendorId claims come from the user
 * record, which is what the Storage rules check.
 */
export async function issueUploadToken(uid: string): Promise<string> {
  return getFirebaseAdmin().auth.createCustomToken(uid);
}

export interface FinalizeInput {
  vendorId: string;
  ownerUid: string;
  shopId: string;
  kind: MediaKind;
  uploadId: string;
  crop?: CropRect | undefined;
  alt?: string | undefined;
}

/** What the editor gets back: the stored record plus its URL. */
export type FinalizedMedia =
  | { kind: "image"; media: MerchantMedia; image: MerchantImage }
  | { kind: "video"; media: MerchantMedia; url: string };

/**
 * Validates and processes a raw upload: checks the shop is the merchant's,
 * re-validates type, size and dimensions from the bytes, processes it,
 * stores the result, deletes the upload and records it as `tmp` (not yet
 * attached). Rejected files are deleted and the reason is returned as copy.
 */
export async function finalizeUpload(
  input: FinalizeInput,
  now = new Date(),
): Promise<FinalizedMedia> {
  if (!UUID.test(input.uploadId))
    throw new ActionError("not_found", "We couldn't find that upload.");
  await getOwnedShop(input.vendorId, input.shopId);
  if (!(await consumeRateLimit("upload", input.vendorId)).allowed) {
    throw new ActionError(
      "limit_exceeded",
      "You've uploaded a lot in the last hour. Try again later.",
    );
  }

  const source = bucket().file(tmpPath(input.vendorId, input.shopId, input.uploadId));
  const [exists] = await source.exists();
  if (!exists) throw new ActionError("not_found", "That upload didn't finish. Try again.");

  try {
    // Check the stored size before downloading, so an oversized object is never read.
    const [metadata] = await source.getMetadata();
    if (Number(metadata.size ?? 0) > maxBytes(input.kind)) {
      throw new MediaRejectedError(
        `That file is too large — the limit is ${Math.round(maxBytes(input.kind) / 1024 / 1024)} MB.`,
      );
    }
    const [bytes] = await source.download();
    const processed = await processUpload(input.kind, new Uint8Array(bytes), { crop: input.crop });

    const mediaId = randomUUID();
    const file = `${mediaId}.${processed.extension}`;
    const path = mediaPath(input.vendorId, input.shopId, file);
    await bucket()
      .file(path)
      .save(processed.buffer, {
        contentType: processed.contentType,
        resumable: false,
        metadata: { cacheControl: "public, max-age=31536000, immutable" },
      });

    const alt = (input.alt ?? "").trim().slice(0, 200);
    const record: MerchantMedia = {
      id: mediaId,
      vendorId: input.vendorId,
      shopId: input.shopId,
      ownerUid: input.ownerUid,
      kind: input.kind,
      path,
      contentType: processed.contentType,
      bytes: processed.buffer.byteLength,
      alt,
      status: "tmp",
      createdAt: now,
      processedAt: now,
      ...(processed.type === "image"
        ? {
            width: processed.width,
            height: processed.height,
            blurDataURL: processed.blurDataURL,
            dominantColor: processed.dominantColor,
          }
        : { durationSeconds: processed.durationSeconds }),
    };
    const { id: _id, ...doc } = record;
    await mediaCollection().doc(mediaId).set(doc);

    const url = mediaUrl(input.vendorId, input.shopId, file);
    if (processed.type === "video") return { kind: "video", media: record, url };
    return {
      kind: "image",
      media: record,
      image: {
        mediaId,
        url,
        alt,
        width: processed.width,
        height: processed.height,
        blurDataURL: processed.blurDataURL,
        dominantColor: processed.dominantColor,
      },
    };
  } catch (error) {
    if (error instanceof MediaRejectedError) throw new ActionError("conflict", error.message);
    throw error;
  } finally {
    await source.delete({ ignoreNotFound: true }).catch(() => {});
  }
}

/** Cancels an upload: deletes the raw file if it's still there. */
export async function discardUpload(
  vendorId: string,
  shopId: string,
  uploadId: string,
): Promise<void> {
  if (!UUID.test(uploadId)) return;
  await getOwnedShop(vendorId, shopId);
  await bucket()
    .file(tmpPath(vendorId, shopId, uploadId))
    .delete({ ignoreNotFound: true });
}

/** Loads media the merchant owns for attaching; refuses anything else. */
export async function requireOwnedMedia(
  vendorId: string,
  mediaIds: readonly string[],
): Promise<MerchantMedia[]> {
  const records = await Promise.all(mediaIds.map((id) => getOwnedMedia(vendorId, id)));
  if (records.some((r) => r === null)) {
    throw new ActionError(
      "not_found",
      "One of those images is no longer available. Upload it again.",
    );
  }
  return records as MerchantMedia[];
}

/** Marks media as in use (inside the caller's transaction). */
export function attachMedia(tx: Transaction, mediaIds: readonly string[]): void {
  for (const id of new Set(mediaIds)) tx.update(mediaCollection().doc(id), { status: "attached" });
}

/** Marks media no longer in use; the cleanup job deletes it after the grace period. */
export function orphanMedia(tx: Transaction, mediaIds: readonly string[], now: Date): void {
  for (const id of new Set(mediaIds)) {
    tx.update(mediaCollection().doc(id), { status: "orphaned", orphanedAt: now });
  }
}

/**
 * Scheduled cleanup: deletes processed media that was never attached (or was
 * replaced) and raw uploads that were never finalised, once older than the
 * grace period (24h).
 */
export async function cleanupStaleMedia(
  now = new Date(),
): Promise<{ records: number; uploads: number }> {
  const cutoff = new Date(now.getTime() - MERCHANT_LIMITS.tmpMediaMaxAgeHours * 3_600_000);
  let records = 0;
  for (const media of await listStaleMedia(cutoff)) {
    await bucket().file(media.path).delete({ ignoreNotFound: true });
    await mediaCollection().doc(media.id).delete();
    records++;
  }

  let uploads = 0;
  const [files] = await bucket().getFiles({ prefix: "merchant-media/" });
  for (const file of files) {
    if (!file.name.includes("/tmp/")) continue;
    const created = new Date(String(file.metadata.timeCreated ?? now.toISOString()));
    if (created < cutoff) {
      await file.delete({ ignoreNotFound: true }).catch((error: unknown) => {
        logger.error("media.cleanup_failed", { path: file.name, error });
      });
      uploads++;
    }
  }
  return { records, uploads };
}
