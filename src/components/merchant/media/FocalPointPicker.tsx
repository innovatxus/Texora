"use client";

import Image from "next/image";
import { useId, type KeyboardEvent, type MouseEvent } from "react";

export interface FocalPoint {
  x: number;
  y: number;
}

const clamp = (n: number) => Math.min(1, Math.max(0, n));

/**
 * Marks the part of an image that must stay in view when it's cropped for
 * different screens. Click the image, or focus the marker and use the arrow
 * keys (Shift for bigger steps).
 */
export function FocalPointPicker({
  src,
  width,
  height,
  value,
  onChange,
  label = "Focal point",
}: {
  src: string;
  width: number;
  height: number;
  value: FocalPoint;
  onChange: (point: FocalPoint) => void;
  label?: string;
}) {
  const helpId = useId();

  const onClick = (event: MouseEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    onChange({
      x: clamp((event.clientX - box.left) / box.width),
      y: clamp((event.clientY - box.top) / box.height),
    });
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const step = event.shiftKey ? 0.1 : 0.02;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    onChange({ x: clamp(value.x + move[0]), y: clamp(value.y + move[1]) });
  };

  return (
    <div className="flex flex-col gap-2">
      <div
        className="relative cursor-crosshair overflow-hidden bg-surface-muted"
        style={{ aspectRatio: `${width} / ${height}` }}
        onClick={onClick}
      >
        <Image
          src={src}
          alt=""
          fill
          sizes="(min-width: 1024px) 40vw, 90vw"
          className="object-cover"
        />
        <button
          type="button"
          aria-label={`${label}: ${Math.round(value.x * 100)}% across, ${Math.round(value.y * 100)}% down`}
          aria-describedby={helpId}
          onKeyDown={onKeyDown}
          onClick={(e) => e.stopPropagation()}
          className="absolute size-11 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-ink/40 shadow-overlay focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          style={{ left: `${value.x * 100}%`, top: `${value.y * 100}%` }}
        />
      </div>
      <p id={helpId} className="text-sm text-ink-soft">
        Click the part that should always show, or focus the marker and use the arrow keys.
      </p>
    </div>
  );
}
