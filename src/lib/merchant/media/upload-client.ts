/**
 * Browser side of the media pipeline: signs the browser in to Firebase as
 * the merchant (custom token, in memory only) and uploads straight to the
 * merchant's tmp folder in Storage. It pulls in the Firebase SDK, so it's
 * loaded only when an upload starts (D-086); file checks are in file-checks.
 */
import { inMemoryPersistence, setPersistence, signInWithCustomToken } from "firebase/auth";
import { ref, uploadBytesResumable, type UploadTask } from "firebase/storage";
import { getFirebaseClient } from "@/lib/firebase/client";
import { getUploadTokenAction } from "@/lib/merchant/actions/media";

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
