"use client";

import { CheckIcon } from "@/components/icons";
import type { Facet } from "@/lib/catalog/listing";
import { cn } from "@/lib/utils/cn";

interface FacetControlsProps {
  facet: Facet;
  onToggle: (key: string, value: string) => void;
  idPrefix: string;
}

/** The options of one facet group, rendered by type (list, swatch, size, toggle). */
export function FacetControls({ facet, onToggle, idPrefix }: FacetControlsProps) {
  if (facet.type === "size") {
    return (
      <ul className="grid grid-cols-4 gap-1.5">
        {facet.options.map((o) => (
          <li key={o.value}>
            <button
              type="button"
              aria-pressed={o.selected}
              aria-label={`Size ${o.label}, ${o.count} products`}
              onClick={() => onToggle(facet.key, o.value)}
              className={cn(
                "h-10 w-full border text-xs tabular-nums transition-colors duration-fast",
                o.selected
                  ? "border-ink bg-ink text-surface"
                  : "border-ink-subtle hover:border-ink",
              )}
            >
              {o.label}
            </button>
          </li>
        ))}
      </ul>
    );
  }

  if (facet.type === "swatch") {
    return (
      <ul className="grid grid-cols-2 gap-x-3 gap-y-2.5">
        {facet.options.map((o) => (
          <li key={o.value}>
            <button
              type="button"
              aria-pressed={o.selected}
              onClick={() => onToggle(facet.key, o.value)}
              className="flex w-full items-center gap-2.5 text-left text-sm"
            >
              <span
                className={cn(
                  "relative flex size-6 shrink-0 items-center justify-center rounded-full border",
                  o.selected ? "border-line-strong" : "border-transparent",
                )}
              >
                <span
                  className="size-5 rounded-full border border-ink/15"
                  style={{ background: o.swatch }}
                />
                {o.selected && (
                  <CheckIcon
                    size={20}
                    className="absolute size-3.5 text-surface mix-blend-difference"
                  />
                )}
              </span>
              <span className={cn(o.selected && "font-medium")}>{o.label}</span>
              <span className="ml-auto text-xs text-ink-subtle tabular-nums">{o.count}</span>
            </button>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul className="flex flex-col gap-3 pt-1">
      {facet.options.map((o) => {
        const id = `${idPrefix}-${facet.key}-${o.value}`;
        const disabled = o.count === 0 && !o.selected;
        return (
          <li key={o.value} className="flex items-center gap-3">
            <input
              id={id}
              type="checkbox"
              checked={o.selected}
              disabled={disabled}
              onChange={() => onToggle(facet.key === "toggles" ? o.value : facet.key, o.value)}
              className="peer size-5 shrink-0 cursor-pointer appearance-none border border-ink-subtle bg-surface checked:border-ink checked:bg-ink disabled:cursor-not-allowed disabled:border-line"
            />
            <label
              htmlFor={id}
              className={cn(
                "flex flex-1 cursor-pointer items-center text-sm",
                disabled && "cursor-not-allowed text-ink-subtle",
              )}
            >
              {o.label}
              <span className="ml-auto text-xs text-ink-subtle tabular-nums">{o.count}</span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}
