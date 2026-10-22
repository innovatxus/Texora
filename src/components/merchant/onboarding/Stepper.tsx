"use client";

import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { CheckIcon } from "@/components/icons";
import { STEP_LABELS } from "@/lib/merchant/onboarding";
import { cn } from "@/lib/utils/cn";
import { ONBOARDING_STEPS, type OnboardingStep } from "@/lib/validation/merchant";

/**
 * Onboarding progress: an ordered list with the current step marked
 * (aria-current="step"). Saved steps are links, so the merchant can go back
 * to any of them; on phones it collapses to "Step 2 of 5 — Branding".
 */
export function Stepper({
  completed,
  hasShop,
}: {
  completed: readonly OnboardingStep[];
  hasShop: boolean;
}) {
  const pathname = usePathname() ?? "";
  const current = ONBOARDING_STEPS.find((s) => pathname.endsWith(`/onboarding/${s}`)) ?? "basics";
  const index = ONBOARDING_STEPS.indexOf(current);

  return (
    <nav aria-label="Shop setup progress">
      <p className="text-sm text-ink-soft md:hidden">
        Step {index + 1} of {ONBOARDING_STEPS.length} — {STEP_LABELS[current]}
      </p>
      <ol className="hidden gap-2 md:grid md:grid-cols-5">
        {ONBOARDING_STEPS.map((step, i) => {
          const done = completed.includes(step);
          const reachable = step === "basics" || hasShop;
          const content = (
            <>
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center border text-xs",
                  done ? "border-ink bg-ink text-surface" : "border-ink-subtle",
                  step === current && !done && "border-ink",
                )}
              >
                {done ? <CheckIcon className="size-4" /> : i + 1}
              </span>
              <span>{STEP_LABELS[step]}</span>
              {done && <span className="sr-only"> (saved)</span>}
            </>
          );
          return (
            <li
              key={step}
              className={cn(
                "border-t-2 pt-3 text-sm",
                step === current ? "border-ink font-medium" : "border-line",
              )}
            >
              {reachable ? (
                <NextLink
                  href={`/merchant/onboarding/${step}`}
                  aria-current={step === current ? "step" : undefined}
                  className="flex min-h-11 items-center gap-2 hover:underline"
                >
                  {content}
                </NextLink>
              ) : (
                <span className="flex min-h-11 items-center gap-2 text-ink-subtle">{content}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
