"use client";

import Image from "next/image";
import { useState, type DragEvent } from "react";
import { cn } from "@/lib/utils/cn";

export interface GridImage {
  mediaId: string;
  url: string;
  alt: string;
  width: number;
  height: number;
  blurDataURL?: string;
}

/** Moves an item from one index to another; pure, so reorders are predictable and testable. */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) {
    return [...items];
  }
  const next = [...items];
  const [moved] = next.splice(from, 1);
  if (moved !== undefined) next.splice(to, 0, moved);
  return next;
}

const ROLE_LABELS = ["Main", "Hover"];

/**
 * Ordered images: drag to reorder, or use Move earlier / Move later (every
 * drag has a button equivalent). The first is the main image, the second
 * shows on hover. Reorders are applied optimistically by the parent.
 */
export function MediaGrid({
  images,
  onReorder,
  onRemove,
  label,
}: {
  images: readonly GridImage[];
  onReorder: (next: GridImage[]) => void;
  onRemove: (mediaId: string) => void;
  label: string;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const move = (from: number, to: number) => {
    const next = moveItem(images, from, to);
    onReorder(next);
    setAnnouncement(`Moved to position ${to + 1} of ${images.length}`);
  };

  const onDrop = (event: DragEvent, to: number) => {
    event.preventDefault();
    if (dragIndex !== null) move(dragIndex, to);
    setDragIndex(null);
  };

  if (images.length === 0) return null;

  return (
    <div>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
      <ol aria-label={label} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {images.map((image, index) => (
          <li
            key={image.mediaId}
            draggable
            onDragStart={() => setDragIndex(index)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => onDrop(e, index)}
            onDragEnd={() => setDragIndex(null)}
            className={cn(
              "flex flex-col gap-2 border border-line bg-surface p-2",
              dragIndex === index && "opacity-50",
            )}
          >
            <div className="relative aspect-[3/4] overflow-hidden bg-surface-muted">
              <Image
                src={image.url}
                alt={image.alt}
                fill
                sizes="(min-width: 1024px) 15vw, 45vw"
                className="object-cover"
                {...(image.blurDataURL
                  ? { placeholder: "blur" as const, blurDataURL: image.blurDataURL }
                  : {})}
              />
              {ROLE_LABELS[index] && (
                <span className="absolute top-1 left-1 bg-ink px-2 py-0.5 text-xs text-surface">
                  {ROLE_LABELS[index]}
                </span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-1 text-xs">
              <button
                type="button"
                disabled={index === 0}
                onClick={() => move(index, index - 1)}
                aria-label={`Move image ${index + 1} earlier`}
                className="min-h-11 border border-ink-subtle disabled:border-line disabled:text-ink-subtle"
              >
                Earlier
              </button>
              <button
                type="button"
                disabled={index === images.length - 1}
                onClick={() => move(index, index + 1)}
                aria-label={`Move image ${index + 1} later`}
                className="min-h-11 border border-ink-subtle disabled:border-line disabled:text-ink-subtle"
              >
                Later
              </button>
              <button
                type="button"
                onClick={() => onRemove(image.mediaId)}
                aria-label={`Remove image ${index + 1}`}
                className="min-h-11 border border-ink-subtle text-sale"
              >
                Remove
              </button>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
