/**
 * Browser side of the media pipeline: signs the browser in to Firebase as
 * the merchant (custom token, in memory only), checks a file before sending
 * it, and uploads it straight to the merchant's tmp folder in Storage.
 */
import { inMemoryPersistence, setPersistence, signInWithCustomToken } from "firebase/auth";
import { ref, uploadBytesResumable, type UploadTask } from "firebase/storage";
import type { MediaKind } from "@/config/merchant";
import { getFirebaseClient } from "@/lib/firebase/client";
import { getUploadTokenAction } from "@/lib/merchant/actions/media";
import { dimensionProblem, fileProblem } from "./rules";

let signedInVendor: Promise<string> | null = null;

/** Signs in once per page session; the token never touches storage on disk. */
export function ensureUploadAuth(): Promise<string> {
  signedInVendor ??= (async () => {
    const result = await getUploadTokenAction({});
    if (!result.ok) throw new Error(result.error.message);
    const { auth } = getFirebaseClient();
    await setPersistence(auth, inMemoryPersistence);
    await signInWithCustomToken(auth, result.data.token);
    return result.data.vendorId;
  })().catch((error: unknown) => {
    signedInVendor = null;
    throw error;
  });
  return signedInVendor;
}

/** Natural size of an image file, or null when the browser can't decode it (or it's SVG). */
export async function readImageSize(file: File): Promise<{ width: number; height: number } | null> {
  if (file.type === "image/svg+xml") return null;
  try {
    const bitmap = await createImageBitmap(file);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  } catch {
    return null;
  }
}

/** The client-side check: type, size and dimensions. The server checks all of it again. */
export async function checkFile(kind: MediaKind, file: File): Promise<string | null> {
  const basic = fileProblem(kind, file.type, file.size);
  if (basic) return basic;
  if (kind === "productVideo") return null;
  const size = await readImageSize(file);
  if (!size)
    return file.type === "image/svg+xml" ? null : "We couldn't open that image. Try another file.";
  return dimensionProblem(kind, size.width, size.height, file.type);
}

/** Starts a resumable upload to the merchant's tmp folder; the task supports cancel. */
export function startUpload(
  vendorId: string,
  shopId: string,
  uploadId: string,
  file: File,
  onProgress: (fraction: number) => void,
): { task: UploadTask; done: Promise<void> } {
  const { storage } = getFirebaseClient();
  const task = uploadBytesResumable(
    ref(storage, `merchant-media/${vendorId}/${shopId}/tmp/${uploadId}`),
    file,
    { contentType: file.type },
  );
  const done = new Promise<void>((resolve, reject) => {
    task.on(
      "state_changed",
      (snapshot) =>
        onProgress(snapshot.totalBytes ? snapshot.bytesTransferred / snapshot.totalBytes : 0),
      reject,
      () => resolve(),
    );
  });
  return { task, done };
}
