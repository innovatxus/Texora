"use client";

import { useShallow } from "zustand/react/shallow";
import { useUploadStore, type UploadItem } from "@/stores/uploads";

const STATUS: Record<UploadItem["status"], string> = {
  checking: "Waiting",
  uploading: "Uploading",
  processing: "Processing",
  done: "Uploaded",
  error: "Failed",
  cancelled: "Cancelled",
};

/**
 * Progress for an owner's uploads (e.g. one colour's photos): a progress bar
 * per file, Cancel while uploading, Retry on failure, and a polite live
 * summary ("3 of 5 uploaded").
 */
export function UploadQueue({
  ownerKey,
  hideDone = true,
}: {
  ownerKey: string;
  hideDone?: boolean;
}) {
  const items = useUploadStore(useShallow((s) => s.items.filter((i) => i.ownerKey === ownerKey)));
  const { cancel, retry, remove } = useUploadStore(
    useShallow((s) => ({ cancel: s.cancel, retry: s.retry, remove: s.remove })),
  );
  const active = items.filter((i) => i.status !== "cancelled");
  const done = active.filter((i) => i.status === "done").length;
  const visible = items.filter(
    (i) => i.status !== "cancelled" && !(hideDone && i.status === "done"),
  );

  return (
    <div className="flex flex-col gap-3">
      <p aria-live="polite" className="sr-only">
        {active.length > 0 ? `${done} of ${active.length} uploaded` : ""}
      </p>
      {visible.length > 0 && (
        <ul className="flex flex-col gap-3">
          {visible.map((item) => (
            <li
              key={item.id}
              className="flex flex-col gap-2 border border-line bg-surface p-3 text-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="truncate font-medium">{item.fileName}</span>
                <span className={item.status === "error" ? "text-sale" : "text-ink-soft"}>
                  {STATUS[item.status]}
                  {item.status === "uploading" && ` ${Math.round(item.progress * 100)}%`}
                </span>
              </div>
              {(item.status === "uploading" || item.status === "processing") && (
                <div
                  role="progressbar"
                  aria-label={`Uploading ${item.fileName}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(item.progress * 100)}
                  className="h-1 w-full bg-line"
                >
                  <div
                    className="h-1 bg-ink transition-[width]"
                    style={{ width: `${item.progress * 100}%` }}
                  />
                </div>
              )}
              {item.error && <p className="text-sale">{item.error}</p>}
              <div className="flex gap-4">
                {(item.status === "uploading" || item.status === "checking") && (
                  <button
                    type="button"
                    onClick={() => cancel(item.id)}
                    className="min-h-11 underline underline-offset-4"
                  >
                    Cancel<span className="sr-only"> {item.fileName}</span>
                  </button>
                )}
                {item.status === "error" && (
                  <>
                    <button
                      type="button"
                      onClick={() => retry(item.id)}
                      className="min-h-11 font-medium underline underline-offset-4"
                    >
                      Retry<span className="sr-only"> {item.fileName}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(item.id)}
                      className="min-h-11 underline underline-offset-4"
                    >
                      Dismiss<span className="sr-only"> {item.fileName}</span>
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
