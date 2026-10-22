import type { UploadTask } from "firebase/storage";
import { create } from "zustand";
import type { MediaKind } from "@/config/merchant";
import type { FinalizedMedia } from "@/lib/merchant/media/media-service";
import type { CropRect } from "@/lib/merchant/media/rules";
import { discardUploadAction, finalizeUploadAction } from "@/lib/merchant/actions/media";
import { checkFile } from "@/lib/merchant/media/file-checks";

export type UploadStatus = "checking" | "uploading" | "processing" | "done" | "error" | "cancelled";

/** One file in the queue. The File itself lives outside the store (it isn't serialisable). */
export interface UploadItem {
  id: string;
  /** What the upload is for, e.g. "logo" or "product:p1:navy"; components filter by it. */
  ownerKey: string;
  kind: MediaKind;
  shopId: string;
  fileName: string;
  status: UploadStatus;
  progress: number;
  error?: string;
  result?: FinalizedMedia;
  crop?: CropRect;
  alt?: string;
}

interface EnqueueInput {
  ownerKey: string;
  kind: MediaKind;
  shopId: string;
  file: File;
  crop?: CropRect;
  alt?: string;
}

interface UploadState {
  items: UploadItem[];
  enqueue: (input: EnqueueInput) => string;
  cancel: (id: string) => void;
  retry: (id: string) => void;
  remove: (id: string) => void;
}

const MAX_PARALLEL = 3;
const files = new Map<string, File>();
const tasks = new Map<string, UploadTask>();
/** Called when an upload finishes, so the editor can attach it (registered per ownerKey). */
const listeners = new Map<string, Set<(item: UploadItem) => void>>();

/** Registers a callback for finished uploads of an owner; returns the unsubscribe. */
export function onUploadDone(ownerKey: string, listener: (item: UploadItem) => void): () => void {
  const set = listeners.get(ownerKey) ?? new Set();
  set.add(listener);
  listeners.set(ownerKey, set);
  return () => set.delete(listener);
}

/**
 * The background upload queue. It lives at module level, so uploads keep
 * going while the merchant moves between editor sections or portal pages;
 * at most three run at once, failures can be retried, and every upload can
 * be cancelled.
 */
export const useUploadStore = create<UploadState>()((set, get) => {
  const patch = (id: string, changes: Partial<UploadItem>) =>
    set((state) => ({ items: state.items.map((i) => (i.id === id ? { ...i, ...changes } : i)) }));

  const pump = () => {
    const { items } = get();
    const running = items.filter(
      (i) => i.status === "uploading" || i.status === "processing",
    ).length;
    const next = items.filter((i) => i.status === "checking").slice(0, MAX_PARALLEL - running);
    for (const item of next) void run(item);
  };

  const run = async (item: UploadItem) => {
    const file = files.get(item.id);
    if (!file) return patch(item.id, { status: "error", error: "Choose the file again." });
    patch(item.id, { status: "uploading", progress: 0 });
    try {
      const problem = await checkFile(item.kind, file);
      if (problem) return patch(item.id, { status: "error", error: problem });
      // The Firebase SDK loads only once something is actually uploaded.
      const { ensureUploadAuth, startUpload } = await import("@/lib/merchant/media/upload-client");
      const vendorId = await ensureUploadAuth();
      const { task, done } = startUpload(vendorId, item.shopId, item.id, file, (progress) =>
        patch(item.id, { progress }),
      );
      tasks.set(item.id, task);
      await done;
      tasks.delete(item.id);
      patch(item.id, { status: "processing", progress: 1 });
      const result = await finalizeUploadAction({
        shopId: item.shopId,
        kind: item.kind,
        uploadId: item.id,
        ...(item.crop ? { crop: item.crop } : {}),
        ...(item.alt ? { alt: item.alt } : {}),
      });
      if (!result.ok) return patch(item.id, { status: "error", error: result.error.message });
      patch(item.id, { status: "done", result: result.data });
      const finished = get().items.find((i) => i.id === item.id);
      if (finished) for (const listener of listeners.get(item.ownerKey) ?? []) listener(finished);
      files.delete(item.id);
    } catch (error) {
      tasks.delete(item.id);
      if (get().items.find((i) => i.id === item.id)?.status === "cancelled") return;
      const offline = typeof navigator !== "undefined" && !navigator.onLine;
      patch(item.id, {
        status: "error",
        error: offline
          ? "You're offline. Retry when you're back."
          : error instanceof Error && error.message && !error.message.startsWith("Firebase")
            ? error.message
            : "The upload didn't finish. Try again.",
      });
    } finally {
      pump();
    }
  };

  return {
    items: [],
    enqueue: ({ file, ...input }) => {
      const id = crypto.randomUUID();
      files.set(id, file);
      set((state) => ({
        items: [
          ...state.items,
          { ...input, id, fileName: file.name, status: "checking", progress: 0 },
        ],
      }));
      pump();
      return id;
    },
    cancel: (id) => {
      const item = get().items.find((i) => i.id === id);
      if (!item) return;
      patch(id, { status: "cancelled" });
      tasks.get(id)?.cancel();
      tasks.delete(id);
      void discardUploadAction({ shopId: item.shopId, uploadId: id });
      pump();
    },
    retry: (id) => {
      const item = get().items.find((i) => i.id === id);
      const file = files.get(id);
      if (!item || !file) return;
      // A fresh id: the old tmp object may be half-written and is write-once.
      get().remove(id);
      get().enqueue({
        ownerKey: item.ownerKey,
        kind: item.kind,
        shopId: item.shopId,
        file,
        ...(item.crop ? { crop: item.crop } : {}),
        ...(item.alt ? { alt: item.alt } : {}),
      });
    },
    remove: (id) => {
      set((state) => ({ items: state.items.filter((i) => i.id !== id) }));
      if (get().items.every((i) => i.id !== id)) {
        // Keep the File for retry() until enqueue() has re-registered it.
        queueMicrotask(() => {
          if (!get().items.some((i) => i.id === id)) files.delete(id);
        });
      }
    },
  };
});
