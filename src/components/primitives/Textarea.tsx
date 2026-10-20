import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import { describedBy, Field, useFieldIds } from "./Field";
import { controlVariants } from "./Input";

export interface TextareaProps extends ComponentProps<"textarea"> {
  label: ReactNode;
  hint?: ReactNode;
  /** Inline error message. Its presence marks the field invalid. */
  error?: ReactNode;
  hideLabel?: boolean;
  /** Shows "used / max" under the field when maxLength is set. */
  showCount?: boolean;
}

/** Multi-line text with the same look, labelling and error handling as Input. */
export function Textarea({
  id,
  label,
  hint,
  error,
  hideLabel,
  required,
  showCount,
  maxLength,
  value,
  rows = 5,
  className,
  ...props
}: TextareaProps) {
  const ids = useFieldIds(id);
  const count =
    showCount && maxLength !== undefined && typeof value === "string" ? (
      <span aria-hidden className="self-end text-xs text-ink-subtle tabular-nums">
        {value.length}/{maxLength}
      </span>
    ) : null;
  return (
    <Field
      ids={ids}
      label={label}
      hint={hint}
      error={error}
      required={required}
      hideLabel={hideLabel}
      className={className}
    >
      <textarea
        id={ids.control}
        required={required}
        rows={rows}
        maxLength={maxLength}
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(ids, hint, error)}
        className={cn(controlVariants({ invalid: Boolean(error) }), "h-auto resize-y py-3")}
        {...props}
      />
      {count}
    </Field>
  );
}
