import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export interface FieldIds {
  control: string;
  hint: string;
  error: string;
}

/** Stable ids linking a control to its label, hint and error text. */
export function useFieldIds(id?: string): FieldIds {
  const generated = useId();
  const control = id ?? generated;
  return { control, hint: `${control}-hint`, error: `${control}-error` };
}

/** Value for aria-describedby: only the messages that are actually rendered. */
export function describedBy(
  ids: FieldIds,
  hint?: ReactNode,
  error?: ReactNode,
): string | undefined {
  const parts = [hint ? ids.hint : null, error ? ids.error : null].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : undefined;
}

export function FieldHint({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="text-sm text-ink-subtle">
      {children}
    </p>
  );
}

export function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="text-sm text-sale">
      {children}
    </p>
  );
}

export function RequiredMark() {
  return (
    <span aria-hidden className="ml-0.5 text-ink-subtle">
      *
    </span>
  );
}

export interface FieldProps {
  ids: FieldIds;
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  /** Keep the label for assistive tech but hide it visually (e.g. search inputs). */
  hideLabel?: boolean;
  className?: string;
  children: ReactNode;
}

/** Label + control + hint + error layout shared by text-like form controls. */
export function Field({
  ids,
  label,
  hint,
  error,
  required,
  hideLabel = false,
  className,
  children,
}: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label
        htmlFor={ids.control}
        className={cn("text-sm font-medium text-ink", hideLabel && "sr-only")}
      >
        {label}
        {required && <RequiredMark />}
      </label>
      {children}
      {hint && <FieldHint id={ids.hint}>{hint}</FieldHint>}
      {error && <FieldError id={ids.error}>{error}</FieldError>}
    </div>
  );
}
