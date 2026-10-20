"use client";

import { useState, type ComponentProps, type ReactNode } from "react";
import { describedBy, Field, useFieldIds } from "@/components/primitives/Field";
import { controlVariants } from "@/components/primitives/Input";
import { cn } from "@/lib/utils/cn";

export interface PasswordFieldProps extends Omit<ComponentProps<"input">, "type" | "size"> {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  /** Rendered under the input, e.g. the strength meter; give it `meterId` for aria-describedby. */
  meter?: ReactNode;
  meterId?: string;
}

/** Password input with a show/hide toggle (a pressed-state button, 44px target). */
export function PasswordField({
  id,
  label,
  hint,
  error,
  meter,
  meterId,
  required,
  className,
  ...props
}: PasswordFieldProps) {
  const ids = useFieldIds(id);
  const [visible, setVisible] = useState(false);
  const described = [describedBy(ids, hint, error), meter ? meterId : undefined]
    .filter(Boolean)
    .join(" ");

  return (
    <Field
      ids={ids}
      label={label}
      hint={hint}
      error={error}
      required={required}
      className={className}
    >
      <div className="relative">
        <input
          id={ids.control}
          type={visible ? "text" : "password"}
          required={required}
          spellCheck={false}
          autoCapitalize="none"
          aria-invalid={error ? true : undefined}
          aria-describedby={described || undefined}
          className={cn(controlVariants({ invalid: Boolean(error) }), "pr-20")}
          {...props}
        />
        <button
          type="button"
          aria-pressed={visible}
          aria-controls={ids.control}
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 right-0 flex min-w-11 items-center justify-center px-4 text-sm underline underline-offset-4"
        >
          {visible ? "Hide" : "Show"}
          <span className="sr-only"> password</span>
        </button>
      </div>
      {meter}
    </Field>
  );
}
