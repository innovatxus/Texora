"use client";

import { useDeferredValue } from "react";
import { PASSWORD_SCORE_LABELS, passwordScore } from "@/lib/auth/password";
import { cn } from "@/lib/utils/cn";

const BAR_TONES = ["bg-sale", "bg-sale", "bg-warning", "bg-success", "bg-success"] as const;

/**
 * Four-bar strength meter with a text label, so strength is never shown by
 * colour alone. Uses the same scorer as the server; announced politely.
 */
export function PasswordStrength({
  password,
  userInputs,
  id,
}: {
  password: string;
  /** Email and username, which make a password weaker. */
  userInputs: readonly string[];
  id: string;
}) {
  const deferred = useDeferredValue(password);
  if (!deferred) return <p id={id} className="sr-only" aria-live="polite" />;
  const score = passwordScore(deferred, userInputs);
  const filled = Math.max(1, score);
  const label = PASSWORD_SCORE_LABELS[score];

  return (
    <div className="flex items-center gap-3">
      <div aria-hidden="true" className="grid flex-1 grid-cols-4 gap-1">
        {[1, 2, 3, 4].map((bar) => (
          <span key={bar} className={cn("h-1", bar <= filled ? BAR_TONES[score] : "bg-line")} />
        ))}
      </div>
      <p id={id} aria-live="polite" className="min-w-16 text-right text-sm text-ink-soft">
        <span className="sr-only">Password strength: </span>
        {label}
      </p>
    </div>
  );
}
