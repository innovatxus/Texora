"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/feedback/ErrorState";
import { Button, ButtonLink } from "@/components/primitives";

/** Error boundary for storefront pages: branded message with a retry button. */
export default function StorefrontError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorState
      layout="page"
      eyebrow="Error 500"
      title="Something went wrong"
      description={
        <>
          <p>{"We couldn't load this page. Please try again in a moment."}</p>
          {error.digest && (
            <p className="mt-2 text-xs text-ink-subtle">Reference: {error.digest}</p>
          )}
        </>
      }
      actions={
        <>
          <Button onClick={reset}>Try again</Button>
          <ButtonLink href="/" variant="secondary">
            Go to the homepage
          </ButtonLink>
        </>
      }
    />
  );
}
