import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import { describedBy, FieldError, FieldHint, useFieldIds } from "./Field";

export interface RadioProps extends Omit<ComponentProps<"input">, "type"> {
  label: ReactNode;
  hint?: ReactNode;
}

/**
 * Radios stay circular (the one exception to the sharp-corner rule) because
 * the shape is how people tell single-choice from multi-choice controls.
 */
export function Radio({ id, label, hint, disabled, className, ...props }: RadioProps) {
  const ids = useFieldIds(id);
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <input
        id={ids.control}
        type="radio"
        disabled={disabled}
        aria-describedby={describedBy(ids, hint)}
        className={cn(
          "mt-px size-5 shrink-0 cursor-pointer appearance-none rounded-full border border-ink-subtle bg-surface",
          "transition-[border-color,border-width] duration-fast ease-atelier",
          "checked:border-[6px] checked:border-ink not-disabled:hover:border-ink",
          "disabled:cursor-not-allowed disabled:border-line disabled:bg-surface-muted disabled:checked:border-ink-subtle",
        )}
        {...props}
      />
      <span className="flex flex-col gap-1">
        <label
          htmlFor={ids.control}
          className={cn(
            "text-sm",
            disabled ? "cursor-not-allowed text-ink-subtle" : "cursor-pointer text-ink",
          )}
        >
          {label}
        </label>
        {hint && <FieldHint id={ids.hint}>{hint}</FieldHint>}
      </span>
    </div>
  );
}

export interface RadioGroupProps extends ComponentProps<"fieldset"> {
  legend: ReactNode;
  hideLegend?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
  orientation?: "vertical" | "horizontal";
  required?: boolean;
}

/**
 * Fieldset + legend exposed as a radiogroup, so the set has one accessible
 * name and can carry aria-required / aria-invalid.
 */
export function RadioGroup({
  id,
  legend,
  hideLegend = false,
  hint,
  error,
  orientation = "vertical",
  required,
  className,
  children,
  ...props
}: RadioGroupProps) {
  const ids = useFieldIds(id);
  return (
    <fieldset
      id={ids.control}
      role="radiogroup"
      aria-describedby={describedBy(ids, hint, error)}
      aria-invalid={error ? true : undefined}
      aria-required={required || undefined}
      className={cn("flex flex-col gap-3", className)}
      {...props}
    >
      <legend className={cn("mb-3 text-sm font-medium text-ink", hideLegend && "sr-only")}>
        {legend}
        {required && (
          <span aria-hidden className="ml-0.5 text-ink-subtle">
            *
          </span>
        )}
      </legend>
      <div
        className={cn(
          "flex gap-3",
          orientation === "vertical" ? "flex-col" : "flex-row flex-wrap gap-6",
        )}
      >
        {children}
      </div>
      {hint && <FieldHint id={ids.hint}>{hint}</FieldHint>}
      {error && <FieldError id={ids.error}>{error}</FieldError>}
    </fieldset>
  );
}
