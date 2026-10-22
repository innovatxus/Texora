"use client";

import { useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Modal } from "@/components/feedback/Modal";
import { Button } from "@/components/primitives";
import { clampCrop, defaultCrop, type CropRect } from "@/lib/merchant/media/rules";

const MIN_SCALE = 0.2;

/** Crop at a given scale (0.2–1 of the largest crop) and centre, keeping the aspect. */
function cropAt(base: CropRect, scale: number, centre: { x: number; y: number }): CropRect {
  const width = base.width * scale;
  const height = base.height * scale;
  return clampCrop({ x: centre.x - width / 2, y: centre.y - height / 2, width, height }, 0.01);
}

/**
 * Crop dialog for logos (square), banners (3:1) and product photos (3:4).
 * Drag the frame, or use the keyboard: arrow keys move it (Shift for bigger
 * steps), + and − resize it; the zoom slider does the same. Output is a
 * normalised rectangle the server applies to the full-resolution file.
 */
export function ImageCropper({
  open,
  onOpenChange,
  src,
  width,
  height,
  aspect,
  title,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Object URL of the chosen file. */
  src: string;
  width: number;
  height: number;
  aspect: number;
  title: string;
  onConfirm: (crop: CropRect) => void;
}) {
  const helpId = useId();
  const base = defaultCrop(width, height, aspect);
  const [scale, setScale] = useState(1);
  const [centre, setCentre] = useState({ x: 0.5, y: 0.5 });
  const frame = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{ x: number; y: number; centre: { x: number; y: number } } | null>(null);
  const crop = cropAt(base, scale, centre);

  const moveBy = (dx: number, dy: number) =>
    setCentre((c) => {
      const next = cropAt(base, scale, { x: c.x + dx, y: c.y + dy });
      return { x: next.x + next.width / 2, y: next.y + next.height / 2 };
    });

  const onKeyDown = (event: KeyboardEvent) => {
    const step = event.shiftKey ? 0.05 : 0.01;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      moveBy(move[0], move[1]);
    } else if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      setScale((s) => Math.min(1, s + 0.05));
    } else if (event.key === "-" || event.key === "_") {
      event.preventDefault();
      setScale((s) => Math.max(MIN_SCALE, s - 0.05));
    }
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY, centre };
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    const box = frame.current?.getBoundingClientRect();
    if (!start || !box) return;
    const next = cropAt(base, scale, {
      x: start.centre.x + (event.clientX - start.x) / box.width,
      y: start.centre.y + (event.clientY - start.y) / box.height,
    });
    setCentre({ x: next.x + next.width / 2, y: next.y + next.height / 2 });
  };
  const endDrag = () => {
    drag.current = null;
  };

  const pct = (n: number) => `${(n * 100).toFixed(2)}%`;

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={title} className="max-w-2xl">
      <div className="flex flex-col gap-5">
        <div
          ref={frame}
          className="relative mx-auto w-full overflow-hidden bg-surface-muted select-none"
          style={{ aspectRatio: `${width} / ${height}`, maxHeight: "60dvh" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- a local object URL being edited, not a served image */}
          <img
            src={src}
            alt=""
            className="absolute inset-0 size-full object-contain"
            draggable={false}
          />
          <div
            role="group"
            tabIndex={0}
            aria-label={`Crop area: ${Math.round(crop.x * 100)}% from the left, ${Math.round(crop.y * 100)}% from the top, ${Math.round(scale * 100)}% size`}
            aria-describedby={helpId}
            onKeyDown={onKeyDown}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            className="absolute cursor-move touch-none border-2 border-surface shadow-[0_0_0_9999px_rgb(26_26_26/0.55)] outline-offset-2 focus-visible:outline-2 focus-visible:outline-focus"
            style={{
              left: pct(crop.x),
              top: pct(crop.y),
              width: pct(crop.width),
              height: pct(crop.height),
            }}
          />
        </div>
        <p id={helpId} className="text-sm text-ink-soft">
          Drag the frame, or focus it and use the arrow keys to move it (hold Shift to move faster)
          and + or − to resize.
        </p>
        <label className="flex items-center gap-4 text-sm">
          <span className="shrink-0 font-medium">Zoom</span>
          <input
            type="range"
            min={MIN_SCALE}
            max={1}
            step={0.01}
            value={scale}
            onChange={(e) => setScale(Number(e.target.value))}
            className="min-h-11 w-full accent-ink"
          />
        </label>
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => onConfirm(crop)}>Use this crop</Button>
        </div>
      </div>
    </Modal>
  );
}
