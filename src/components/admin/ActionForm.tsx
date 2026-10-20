"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition, type FormEvent } from "react";
import { Button, type ButtonProps } from "@/components/primitives";
import type { ActionResult } from "@/lib/actions/run-action";
import { cn } from "@/lib/utils/cn";
import { adminControl } from "./ui";

export type ActionField =
  | {
      name: string;
      label: string;
      type: "text" | "number" | "email" | "date" | "datetime-local";
      required?: boolean;
      placeholder?: string;
      defaultValue?: string;
      hint?: string;
      /** Number fields: step, e.g. "0.01" for money. */
      step?: string;
    }
  | {
      name: string;
      label: string;
      type: "textarea";
      required?: boolean;
      placeholder?: string;
      defaultValue?: string;
      hint?: string;
      rows?: number;
    }
  | {
      name: string;
      label: string;
      type: "select";
      options: ReadonlyArray<{ value: string; label: string }>;
      required?: boolean;
      defaultValue?: string;
      hint?: string;
    }
  | { name: string; label: string; type: "checkbox"; defaultChecked?: boolean; hint?: string };

/**
 * A small form that sends its fields (plus a fixed payload) to a Server
 * Action, shows field and form errors from the action's result, and
 * refreshes the page on success. Used for every back office mutation that
 * needs input: refunds, notes, shipments, stock adjustments…
 */
export function ActionForm<T>({
  action,
  payload = {},
  fields,
  submitLabel,
  confirm,
  done = "Saved",
  variant = "secondary",
  className,
  layout = "stack",
  resetOnSuccess = true,
}: {
  action: (input: unknown) => Promise<ActionResult<T>>;
  payload?: Record<string, unknown>;
  fields: readonly ActionField[];
  submitLabel: string;
  confirm?: string;
  done?: string;
  variant?: ButtonProps["variant"];
  className?: string;
  layout?: "stack" | "inline";
  resetOnSuccess?: boolean;
}) {
  const router = useRouter();
  const id = useId();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const values: Record<string, unknown> = { ...payload };
    for (const field of fields) {
      if (field.type === "checkbox") values[field.name] = data.get(field.name) === "on";
      else {
        const raw = String(data.get(field.name) ?? "").trim();
        if (raw !== "") values[field.name] = raw;
      }
    }
    if (confirm && !window.confirm(confirm)) return;
    startTransition(async () => {
      const result = await action(values);
      if (result.ok) {
        setErrors({});
        setStatus({ ok: true, message: done });
        if (resetOnSuccess) form.reset();
        router.refresh();
        return;
      }
      const fieldErrors = result.error.fieldErrors ?? {};
      setErrors(Object.fromEntries(Object.entries(fieldErrors).map(([k, v]) => [k, v[0] ?? ""])));
      setStatus(
        result.error.code === "validation" ? null : { ok: false, message: result.error.message },
      );
    });
  };

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className={cn(
        "flex gap-3 text-sm",
        layout === "inline" ? "flex-wrap items-end" : "flex-col",
        className,
      )}
    >
      {fields.map((field) => {
        const fieldId = `${id}-${field.name}`;
        const error = errors[field.name];
        const describedBy =
          [field.hint ? `${fieldId}-hint` : null, error ? `${fieldId}-error` : null]
            .filter(Boolean)
            .join(" ") || undefined;
        if (field.type === "checkbox") {
          return (
            <label key={field.name} className="flex items-center gap-2">
              <input
                id={fieldId}
                type="checkbox"
                name={field.name}
                defaultChecked={field.defaultChecked}
                className="size-4 accent-ink"
              />
              {field.label}
            </label>
          );
        }
        const control =
          field.type === "textarea" ? (
            <textarea
              id={fieldId}
              name={field.name}
              rows={field.rows ?? 3}
              required={field.required}
              placeholder={field.placeholder}
              defaultValue={field.defaultValue}
              aria-invalid={error ? true : undefined}
              aria-describedby={describedBy}
              className={cn(adminControl, "h-auto py-2")}
            />
          ) : field.type === "select" ? (
            <select
              id={fieldId}
              name={field.name}
              required={field.required}
              defaultValue={field.defaultValue ?? ""}
              aria-invalid={error ? true : undefined}
              aria-describedby={describedBy}
              className={adminControl}
            >
              {!field.required && <option value="">—</option>}
              {field.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              id={fieldId}
              name={field.name}
              type={field.type}
              step={field.type === "number" ? (field.step ?? "1") : undefined}
              required={field.required}
              placeholder={field.placeholder}
              defaultValue={field.defaultValue}
              aria-invalid={error ? true : undefined}
              aria-describedby={describedBy}
              className={adminControl}
            />
          );
        return (
          <div key={field.name} className="flex min-w-0 flex-col gap-1">
            <label htmlFor={fieldId} className="text-xs text-ink-soft">
              {field.label}
              {"required" in field && field.required && (
                <span aria-hidden className="text-ink-subtle">
                  {" "}
                  *
                </span>
              )}
            </label>
            {control}
            {field.hint && (
              <span id={`${fieldId}-hint`} className="text-xs text-ink-subtle">
                {field.hint}
              </span>
            )}
            {error && (
              <span id={`${fieldId}-error`} className="text-xs text-sale">
                {error}
              </span>
            )}
          </div>
        );
      })}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant={variant} size="sm" loading={pending}>
          {submitLabel}
        </Button>
        {status && (
          <span role="status" className={status.ok ? "text-xs text-success" : "text-xs text-sale"}>
            {status.message}
          </span>
        )}
      </div>
    </form>
  );
}
