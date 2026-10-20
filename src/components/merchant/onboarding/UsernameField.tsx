"use client";

import { useEffect, useState, type ComponentProps } from "react";
import { CheckIcon } from "@/components/icons";
import { Input } from "@/components/primitives";
import { MERCHANT_LIMITS } from "@/config/merchant";
import { checkUsernameAvailability } from "@/lib/merchant/actions/account";
import { cn } from "@/lib/utils/cn";

/** The server's answer for one username. */
export interface UsernameAvailability {
  username: string;
  available: boolean;
  message: string;
}

const { min, max } = MERCHANT_LIMITS.username;

/**
 * Username input with a live availability check: 300ms after typing stops it
 * asks the server (rate-limited) and announces the answer politely. The
 * check is advisory; the registration transaction is what guarantees uniqueness.
 */
export function UsernameField({
  value,
  error,
  onAvailability,
  ...inputProps
}: Omit<ComponentProps<typeof Input>, "label" | "value"> & {
  value: string;
  /** Reports each answer, so the form can block submit while a name is known to be taken. */
  onAvailability?: (result: UsernameAvailability) => void;
}) {
  const [result, setResult] = useState<UsernameAvailability | null>(null);
  const normalised = value.trim().toLowerCase();
  const tooShort = normalised.length < min;

  useEffect(() => {
    if (tooShort) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const response = await checkUsernameAvailability({ username: normalised });
      // Rate limited or offline: say nothing; the server checks again on submit.
      if (cancelled || !response.ok) return;
      setResult(response.data);
      onAvailability?.(response.data);
    }, MERCHANT_LIMITS.timing.availabilityDebounceMs);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [normalised, tooShort, onAvailability]);

  // Derived, not stored: the answer only counts for the username it was asked about.
  const current = result && result.username === normalised ? result : null;
  const checking = !tooShort && !current;
  // A field error from validation or the server wins over the live status.
  const showStatus = !error && !tooShort;

  return (
    <Input
      label="Username"
      autoComplete="username"
      autoCapitalize="none"
      spellCheck={false}
      hint={
        <>
          {`${min}–${max} characters: lowercase letters, numbers, dots, dashes or underscores. You can sign in with it.`}
          <span
            aria-live="polite"
            className={cn(
              "mt-1 flex min-h-5 items-center gap-1.5",
              current && (current.available ? "text-success" : "text-sale"),
              checking && "text-ink-soft",
            )}
          >
            {showStatus && checking && "Checking…"}
            {showStatus && current && (
              <>
                {current.available && <CheckIcon className="size-4" />}
                {current.message}
              </>
            )}
          </span>
        </>
      }
      error={error}
      {...inputProps}
    />
  );
}
