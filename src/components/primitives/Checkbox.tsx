import type { ComponentProps, ReactNode } from "react";
import { CheckIcon } from "@/components/icons";
import { cn } from "@/lib/utils/cn";
import { describedBy, FieldError, FieldHint, useFieldIds } from "./Field";

export interface CheckboxProps extends Omit<ComponentProps<"input">, "type"> {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
}

export function Checkbox({ id, label, hint, error, disabled, className, ...props }: CheckboxProps) {
  const ids = useFieldIds(id);
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <span className="relative mt-px inline-flex size-5 shrink-0">
        <input
          id={ids.control}
          type="checkbox"
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(ids, hint, error)}
          className={cn(
            "peer size-5 cursor-pointer appearance-none rounded-none border bg-surface",
            "transition-colors duration-fast ease-atelier",
            "checked:border-ink checked:bg-ink not-disabled:hover:border-ink",
            "disabled:cursor-not-allowed disabled:border-line disabled:bg-surface-muted",
            "disabled:checked:border-ink-subtle disabled:checked:bg-ink-subtle",
            error ? "border-sale" : "border-ink-subtle",
          )}
          {...props}
        />
        <CheckIcon className="pointer-events-none absolute inset-0 text-surface opacity-0 peer-checked:opacity-100" />
      </span>
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
        {error && <FieldError id={ids.error}>{error}</FieldError>}
      </span>
    </div>
  );
}
