"use client";

import NextLink from "next/link";
import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { Button } from "@/components/primitives";
import type { ActionResult } from "@/lib/actions/run-action";
import { formatTime } from "@/lib/stores/hours";

/** Whether a form is part of onboarding (save and continue) or shop settings (save in place). */
export type FormMode = "onboarding" | "settings";

/** "10:42" for the "Saved" status, in the merchant's own clock. */
export function savedAt(date: Date): string {
  return formatTime(
    `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`,
  );
}

/**
 * Puts server field errors on their fields; returns the form-level message
 * (or null when every error belonged to a field).
 */
export function applyServerErrors<T extends FieldValues>(
  result: Extract<ActionResult<unknown>, { ok: false }>,
  setError: UseFormSetError<T>,
  fields: readonly string[],
): string | null {
  const fieldErrors = result.error.fieldErrors ?? {};
  let unmatched = false;
  for (const [name, messages] of Object.entries(fieldErrors)) {
    const top = name.split(".")[0] ?? name;
    if ((fields.includes(name) || fields.includes(top)) && messages[0]) {
      setError(name as Path<T>, { message: messages[0] });
    } else {
      unmatched = true;
    }
  }
  // Field errors are shown inline; anything else (or an unknown field) shows as a form message.
  return Object.keys(fieldErrors).length > 0 && !unmatched ? null : result.error.message;
}

/**
 * Sticky footer for onboarding steps and settings forms: Back (onboarding),
 * the primary save button and the "Saved 10:42" status.
 */
export function StepFooter({
  mode,
  backHref,
  pending,
  savedTime,
  submitLabel,
}: {
  mode: FormMode;
  backHref?: string;
  pending: boolean;
  savedTime: string | null;
  submitLabel?: string;
}) {
  return (
    <div className="sticky bottom-16 z-10 -mx-4 flex flex-wrap items-center justify-between gap-4 border-t border-line bg-canvas/95 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6 lg:bottom-0">
      <div className="flex items-center gap-4">
        {mode === "onboarding" && backHref && (
          <NextLink
            href={backHref}
            className="min-h-11 content-center underline underline-offset-4"
          >
            Back
          </NextLink>
        )}
        <p role="status" className="text-sm text-ink-soft">
          {savedTime ? `Saved ${savedTime}` : ""}
        </p>
      </div>
      <Button type="submit" loading={pending}>
        {submitLabel ?? (mode === "onboarding" ? "Save and continue" : "Save changes")}
      </Button>
    </div>
  );
}
