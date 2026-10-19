"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useRef, useState, type PointerEvent, type WheelEvent } from "react";
import { ProductImage } from "@/components/commerce/ProductImage";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  MinusIcon,
  PlusIcon,
} from "@/components/icons";
import { IconButton } from "@/components/primitives";
import { cn } from "@/lib/utils/cn";

export interface GalleryImage {
  url: string;
  alt: string;
}

const MIN = 1;
const MAX = 3;
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

interface ZoomViewerProps {
  images: readonly GalleryImage[];
  index: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onIndexChange: (index: number) => void;
  productName: string;
}

/**
 * Full-screen zoom: click or double-tap to zoom at a point, wheel to zoom,
 * drag to pan, pinch on touch, arrow keys and thumbnails to change image.
 */
export function ZoomViewer({
  images,
  index,
  open,
  onOpenChange,
  onIndexChange,
  productName,
}: ZoomViewerProps) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const stage = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchStart = useRef<{ distance: number; scale: number } | null>(null);
  const dragStart = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const moved = useRef(false);
  const returnFocus = useRef<HTMLElement | null>(null);

  const image = images[index];
  const reset = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };
  const go = (delta: number) => {
    onIndexChange((index + delta + images.length) % images.length);
    reset();
  };

  /** Keeps the panned image covering the stage. */
  const bound = (x: number, y: number, s: number) => {
    const rect = stage.current?.getBoundingClientRect();
    if (!rect) return { x, y };
    const maxX = ((s - 1) * rect.width) / 2;
    const maxY = ((s - 1) * rect.height) / 2;
    return { x: clamp(x, -maxX, maxX), y: clamp(y, -maxY, maxY) };
  };

  const zoomAt = (next: number, clientX?: number, clientY?: number) => {
    const s = clamp(next, MIN, MAX);
    const rect = stage.current?.getBoundingClientRect();
    if (!rect || clientX === undefined || clientY === undefined || s === 1) {
      setScale(s);
      setOffset(s === 1 ? { x: 0, y: 0 } : bound(offset.x, offset.y, s));
      return;
    }
    // Keep the point under the cursor fixed while scaling.
    const px = clientX - rect.left - rect.width / 2;
    const py = clientY - rect.top - rect.height / 2;
    const ratio = s / scale;
    setScale(s);
    setOffset(bound(px - (px - offset.x) * ratio, py - (py - offset.y) * ratio, s));
  };

  const onPointerDown = (e: PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved.current = false;
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      if (a && b) pinchStart.current = { distance: Math.hypot(a.x - b.x, a.y - b.y), scale };
    } else {
      dragStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
    }
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && pinchStart.current) {
      const [a, b] = [...pointers.current.values()];
      if (a && b) {
        moved.current = true;
        zoomAt(
          (pinchStart.current.scale * Math.hypot(a.x - b.x, a.y - b.y)) /
            pinchStart.current.distance,
        );
      }
      return;
    }
    const start = dragStart.current;
    if (start && scale > 1) {
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) moved.current = true;
      setOffset(bound(start.ox + dx, start.oy + dy, scale));
    }
  };

  const onPointerUp = (e: PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchStart.current = null;
    if (pointers.current.size === 0) {
      if (!moved.current) zoomAt(scale > 1 ? 1 : 2.5, e.clientX, e.clientY);
      dragStart.current = null;
    }
  };

  const onWheel = (e: WheelEvent) =>
    zoomAt(scale * (e.deltaY < 0 ? 1.15 : 1 / 1.15), e.clientX, e.clientY);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <Dialog.Portal>
        <Dialog.Content
          aria-describedby={undefined}
          onOpenAutoFocus={() => {
            returnFocus.current =
              document.activeElement instanceof HTMLElement ? document.activeElement : null;
          }}
          onCloseAutoFocus={(event) => {
            if (returnFocus.current?.isConnected) {
              event.preventDefault();
              returnFocus.current.focus();
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") go(1);
            if (e.key === "ArrowLeft") go(-1);
            if (e.key === "+" || e.key === "=") zoomAt(scale + 0.5);
            if (e.key === "-") zoomAt(scale - 0.5);
          }}
          className="fixed inset-0 z-50 flex flex-col bg-canvas data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in"
        >
          <div className="flex h-16 shrink-0 items-center justify-between border-b border-line px-4">
            <Dialog.Title className="text-label">
              {productName}{" "}
              <span className="text-ink-subtle tabular-nums">
                · {index + 1} / {images.length}
              </span>
            </Dialog.Title>
            <div className="flex items-center gap-1">
              <IconButton
                label="Zoom out"
                icon={<MinusIcon />}
                onClick={() => zoomAt(scale - 0.5)}
                disabled={scale <= MIN}
              />
              <IconButton
                label="Zoom in"
                icon={<PlusIcon />}
                onClick={() => zoomAt(scale + 0.5)}
                disabled={scale >= MAX}
              />
              <Dialog.Close asChild>
                <IconButton label="Close zoom" icon={<CloseIcon size={24} />} />
              </Dialog.Close>
            </div>
          </div>

          <div
            ref={stage}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onWheel={onWheel}
            className={cn(
              "relative flex-1 touch-none overflow-hidden select-none",
              scale > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in",
            )}
          >
            {image && (
              <div
                className="absolute inset-0 transition-transform duration-fast ease-atelier"
                style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }}
              >
                <ProductImage
                  src={image.url}
                  alt={image.alt}
                  fill
                  sizes="100vw"
                  className="object-contain"
                  draggable={false}
                />
              </div>
            )}
            {images.length > 1 && (
              <>
                <IconButton
                  label="Previous image"
                  icon={<ChevronLeftIcon size={24} />}
                  variant="solid"
                  onPointerDown={(e) => e.stopPropagation()}
                  onPointerUp={(e) => e.stopPropagation()}
                  onClick={() => go(-1)}
                  className="absolute top-1/2 left-4 -translate-y-1/2"
                />
                <IconButton
                  label="Next image"
                  icon={<ChevronRightIcon size={24} />}
                  variant="solid"
                  onPointerDown={(e) => e.stopPropagation()}
                  onPointerUp={(e) => e.stopPropagation()}
                  onClick={() => go(1)}
                  className="absolute top-1/2 right-4 -translate-y-1/2"
                />
              </>
            )}
          </div>

          <ul
            aria-label="Images"
            className="flex shrink-0 justify-center gap-2 border-t border-line p-3"
          >
            {images.map((img, i) => (
              <li key={img.url}>
                <button
                  type="button"
                  aria-label={`Image ${i + 1} of ${images.length}`}
                  aria-current={i === index}
                  onClick={() => {
                    onIndexChange(i);
                    reset();
                  }}
                  className={cn(
                    "relative block aspect-3/4 w-12 border",
                    i === index ? "border-line-strong" : "border-transparent",
                  )}
                >
                  <ProductImage src={img.url} alt="" fill sizes="48px" />
                </button>
              </li>
            ))}
          </ul>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
