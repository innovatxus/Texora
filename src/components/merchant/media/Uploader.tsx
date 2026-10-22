"use client";

import { useId, useRef, useState, type DragEvent, type ReactNode } from "react";
import type { MediaKind } from "@/config/merchant";
import { acceptAttribute, cropAspect } from "@/lib/merchant/media/rules";
import { checkFile, readImageSize } from "@/lib/merchant/media/upload-client";
import type { CropRect } from "@/lib/merchant/media/rules";
import { cn } from "@/lib/utils/cn";
import { useUploadStore } from "@/stores/uploads";
import { ImageCropper } from "./ImageCropper";

interface PendingCrop {
  file: File;
  url: string;
  width: number;
  height: number;
}

/**
 * Drag-and-drop or pick files to upload. Each file is checked in the browser
 * first (type, size, dimensions) and, for logos and banners, cropped before
 * it joins the background queue. On phones, "Take a photo" opens the camera.
 */
export function Uploader({
  kind,
  shopId,
  ownerKey,
  multiple = false,
  instructions,
  cropTitle,
  alt,
  className,
}: {
  kind: MediaKind;
  shopId: string;
  ownerKey: string;
  multiple?: boolean;
  /** "Square, at least 512×512 px…" */
  instructions: ReactNode;
  cropTitle?: string;
  /** Suggested alt text for the uploaded files. */
  alt?: string;
  className?: string;
}) {
  const inputId = useId();
  const errorId = useId();
  const pickerRef = useRef<HTMLInputElement | null>(null);
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const enqueue = useUploadStore((s) => s.enqueue);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingCrop | null>(null);
  const aspect = cropAspect(kind);
  const needsCropStep = kind === "logo" || kind === "banner";

  const add = (file: File, crop?: CropRect) =>
    enqueue({ ownerKey, kind, shopId, file, ...(crop ? { crop } : {}), ...(alt ? { alt } : {}) });

  const handleFiles = async (list: FileList | null) => {
    setError(null);
    const chosen = [...(list ?? [])].slice(0, multiple ? undefined : 1);
    for (const file of chosen) {
      const problem = await checkFile(kind, file);
      if (problem) {
        setError(`${file.name}: ${problem}`);
        continue;
      }
      const size = await readImageSize(file);
      if (needsCropStep && aspect && size) {
        setPending({ file, url: URL.createObjectURL(file), ...size });
        return;
      }
      add(file);
    }
  };

  const closeCropper = () => {
    if (pending) URL.revokeObjectURL(pending.url);
    setPending(null);
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    void handleFiles(event.dataTransfer.files);
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "flex flex-col items-center gap-3 border border-dashed px-6 py-8 text-center text-sm transition-colors",
          dragging ? "border-ink bg-surface-muted" : "border-ink-subtle bg-surface",
          error && "border-sale",
        )}
      >
        <p>
          Drag {multiple ? "files" : "a file"} here or{" "}
          <label
            htmlFor={inputId}
            className="cursor-pointer font-medium underline underline-offset-4"
          >
            choose {multiple ? "files" : "a file"}
          </label>
          .
        </p>
        <p className="text-ink-soft">{instructions}</p>
        {kind === "productImage" && (
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            className="min-h-11 px-3 font-medium underline underline-offset-4 md:hidden"
          >
            Take a photo
          </button>
        )}
        <input
          ref={pickerRef}
          id={inputId}
          type="file"
          accept={acceptAttribute(kind)}
          multiple={multiple}
          aria-describedby={error ? errorId : undefined}
          className="sr-only"
          onChange={(e) => {
            void handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
        {kind === "productImage" && (
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            tabIndex={-1}
            aria-hidden="true"
            className="sr-only"
            onChange={(e) => {
              void handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
        )}
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-sm text-sale">
          {error}
        </p>
      )}
      {pending && aspect && (
        <ImageCropper
          open
          onOpenChange={(open) => !open && closeCropper()}
          src={pending.url}
          width={pending.width}
          height={pending.height}
          aspect={aspect}
          title={cropTitle ?? "Crop your image"}
          onConfirm={(crop) => {
            add(pending.file, crop);
            closeCropper();
          }}
        />
      )}
    </div>
  );
}
