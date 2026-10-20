"use client";

import { useId, type ReactNode } from "react";
import { MinusIcon, PlusIcon } from "@/components/icons";
import { cn } from "@/lib/utils/cn";

interface RadioGroupShellProps {
  legend: string;
  /** Visible value next to the legend, e.g. the chosen colour name. */
  value?: ReactNode;
  action?: ReactNode;
  error?: string | undefined;
  children: ReactNode;
  className?: string;
}

/** Fieldset + legend shared by the pickers; native radios give arrow-key navigation. */
function RadioGroupShell({
  legend,
  value,
  action,
  error,
  children,
  className,
}: RadioGroupShellProps) {
  const errorId = useId();
  return (
    // The action sits beside the legend; it is positioned against this wrapper
    // because a fieldset renders its first-child legend inside its border.
    <div className={cn("relative min-w-0", className)}>
      <fieldset className="min-w-0" aria-describedby={error ? errorId : undefined}>
        <legend className="mb-3 text-sm">
          <span className="font-medium">{legend}</span>
          {value && <span className="ml-2 text-ink-soft">{value}</span>}
        </legend>
        {children}
        {error && (
          <p id={errorId} role="alert" className="mt-2 text-sm text-sale">
            {error}
          </p>
        )}
      </fieldset>
      {action && <div className="absolute top-0 right-0">{action}</div>}
    </div>
  );
}

export interface SwatchOption {
  value: string;
  label: string;
  swatch: string;
}

/** Colour swatches as a native radio group, with the chosen colour's name. */
export function SwatchPicker({
  name,
  options,
  value,
  onChange,
}: {
  name: string;
  options: readonly SwatchOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  const selected = options.find((o) => o.value === value);
  return (
    <RadioGroupShell legend="Colour" value={selected?.label}>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label key={o.value} className="cursor-pointer" title={o.label}>
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={o.value === value}
              onChange={() => onChange(o.value)}
              className="peer sr-only"
            />
            <span className="sr-only">{o.label}</span>
            <span
              aria-hidden
              className={cn(
                "flex size-10 items-center justify-center rounded-full border transition-colors duration-fast",
                "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus",
                o.value === value
                  ? "border-line-strong"
                  : "border-transparent hover:border-ink-subtle",
              )}
            >
              <span
                className="size-8 rounded-full border border-ink/15"
                style={{ background: o.swatch }}
              />
            </span>
          </label>
        ))}
      </div>
    </RadioGroupShell>
  );
}

const FIT_LABELS: Record<string, string> = {
  regular: "Regular",
  petite: "Petite",
  tall: "Tall",
  plus: "Plus",
};

/** Regular / Petite / Tall fit selector as a radio group styled as tabs. */
export function FitTabs({
  name,
  fits,
  value,
  onChange,
}: {
  name: string;
  fits: readonly string[];
  value: string;
  onChange: (value: string) => void;
}) {
  if (fits.length < 2) return null;
  return (
    <RadioGroupShell legend="Fit">
      <div className="inline-flex border border-ink-subtle">
        {fits.map((fit) => (
          <label key={fit} className="cursor-pointer">
            <input
              type="radio"
              name={name}
              value={fit}
              checked={fit === value}
              onChange={() => onChange(fit)}
              className="peer sr-only"
            />
            <span
              className={cn(
                "flex h-11 min-w-24 items-center justify-center px-4 text-label transition-colors duration-fast",
                "peer-focus-visible:outline-2 peer-focus-visible:-outline-offset-4 peer-focus-visible:outline-focus",
                fit === value ? "bg-ink text-surface" : "text-ink hover:bg-surface-muted",
              )}
            >
              {FIT_LABELS[fit] ?? fit}
            </span>
          </label>
        ))}
      </div>
    </RadioGroupShell>
  );
}

export interface SizeOptionView {
  size: string;
  inStock: boolean;
}

/** Out-of-stock sizes are crossed out but stay selectable, so they can offer "notify me". */
export function SizePicker({
  name,
  options,
  value,
  onChange,
  error,
  action,
}: {
  name: string;
  options: readonly SizeOptionView[];
  value: string | null;
  onChange: (value: string) => void;
  error?: string | undefined;
  action?: ReactNode;
}) {
  const wide = options.some((o) => o.size.includes("x"));
  return (
    <RadioGroupShell legend="Size" value={value?.replace("x", " × ")} action={action} error={error}>
      <div
        className={cn(
          "grid gap-2",
          wide ? "grid-cols-3 sm:grid-cols-4" : "grid-cols-4 sm:grid-cols-5",
        )}
      >
        {options.map((o) => (
          <label key={o.size} className="cursor-pointer">
            <input
              type="radio"
              name={name}
              value={o.size}
              checked={o.size === value}
              onChange={() => onChange(o.size)}
              className="peer sr-only"
            />
            <span
              className={cn(
                "relative flex h-12 items-center justify-center border text-sm tabular-nums transition-colors duration-fast",
                "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus",
                o.size === value
                  ? "border-line-strong bg-ink text-surface"
                  : "border-ink-subtle hover:border-ink",
                !o.inStock && "text-ink-subtle line-through",
                !o.inStock && o.size === value && "bg-surface-muted text-ink",
                error && o.size !== value && "border-sale",
              )}
            >
              {o.size.replace("x", " × ")}
              {!o.inStock && <span className="sr-only"> (out of stock, notify me)</span>}
            </span>
          </label>
        ))}
      </div>
    </RadioGroupShell>
  );
}

/** Minus / value / plus control, clamped between 1 and a maximum. */
export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 10,
  label = "Quantity",
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  label?: string;
}) {
  const id = useId();
  return (
    <div className="inline-flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div className="inline-flex h-12 items-center border border-ink-subtle">
        <button
          type="button"
          aria-label="Decrease quantity"
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
          className="flex size-12 items-center justify-center disabled:text-ink-subtle"
        >
          <MinusIcon />
        </button>
        <input
          id={id}
          inputMode="numeric"
          value={value}
          onChange={(e) => {
            const n = Number.parseInt(e.target.value, 10);
            if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
          }}
          className="h-full w-12 border-x border-line bg-transparent text-center tabular-nums outline-none"
        />
        <button
          type="button"
          aria-label="Increase quantity"
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
          className="flex size-12 items-center justify-center disabled:text-ink-subtle"
        >
          <PlusIcon />
        </button>
      </div>
    </div>
  );
}
