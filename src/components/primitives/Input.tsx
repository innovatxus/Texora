import type { ComponentProps, ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";
import { describedBy, Field, useFieldIds } from "./Field";

/**
 * Shared look for text-like controls. Borders use ink-subtle, not `line`,
 * so the control boundary meets the 3:1 non-text contrast requirement.
 */
export const controlVariants = cva(
  [
    "w-full rounded-none border bg-surface px-4 text-base text-ink",
    "placeholder:text-ink-subtle",
    "transition-colors duration-fast ease-atelier",
    "hover:border-ink focus-visible:border-ink",
    "disabled:cursor-not-allowed disabled:border-line disabled:bg-surface-muted disabled:text-ink-subtle",
  ],
  {
    variants: {
      size: {
        md: "h-12",
        lg: "h-14",
      },
      invalid: {
        true: "border-sale hover:border-sale",
        false: "border-ink-subtle",
      },
    },
    defaultVariants: { size: "md", invalid: false },
  },
);

export interface InputProps
  extends
    Omit<ComponentProps<"input">, "size">,
    Omit<VariantProps<typeof controlVariants>, "invalid"> {
  label: ReactNode;
  hint?: ReactNode;
  /** Inline error message. Its presence marks the field invalid. */
  error?: ReactNode;
  hideLabel?: boolean;
  /** Classes for the input element; `className` styles the wrapper. */
  inputClassName?: string;
}

export function Input({
  id,
  label,
  hint,
  error,
  hideLabel,
  size,
  required,
  className,
  inputClassName,
  ...props
}: InputProps) {
  const ids = useFieldIds(id);
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
      <input
        id={ids.control}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(ids, hint, error)}
        className={cn(controlVariants({ size, invalid: Boolean(error) }), inputClassName)}
        {...props}
      />
    </Field>
  );
}
