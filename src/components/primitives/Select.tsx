import type { ComponentProps, ReactNode } from "react";
import type { VariantProps } from "class-variance-authority";
import { ChevronDownIcon } from "@/components/icons";
import { cn } from "@/lib/utils/cn";
import { describedBy, Field, useFieldIds } from "./Field";
import { controlVariants } from "./Input";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps
  extends
    Omit<ComponentProps<"select">, "size" | "children">,
    Omit<VariantProps<typeof controlVariants>, "invalid"> {
  label: ReactNode;
  options: readonly SelectOption[];
  /** Non-selectable first option shown when no value is chosen. */
  placeholder?: string;
  hint?: ReactNode;
  error?: ReactNode;
  hideLabel?: boolean;
}

/**
 * Native select: keeps the platform picker on mobile and full keyboard and
 * screen-reader support. Styled to match the other controls.
 */
export function Select({
  id,
  label,
  options,
  placeholder,
  hint,
  error,
  hideLabel,
  size,
  required,
  className,
  ...props
}: SelectProps) {
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
      <div className="relative">
        <select
          id={ids.control}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(ids, hint, error)}
          className={cn(
            controlVariants({ size, invalid: Boolean(error) }),
            "cursor-pointer appearance-none pr-11",
          )}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-ink" />
      </div>
    </Field>
  );
}
