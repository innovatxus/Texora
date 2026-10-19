"use client";

import { useEffect } from "react";
import { brand } from "@/config/brand";
import "@/styles/globals.css";

/** Last-resort boundary when the root layout itself fails; renders its own document. */
export default function GlobalError({
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
    <html lang={brand.locale}>
      <body className="flex min-h-dvh flex-col items-center justify-center bg-canvas p-6 text-center text-ink">
        <p className="text-label text-ink-subtle">{brand.name}</p>
        <h1 className="mt-4 font-display text-4xl">Something went wrong</h1>
        <p className="mt-4 max-w-md text-ink-soft">Please try again in a moment.</p>
        <button
          type="button"
          onClick={reset}
          className="mt-8 h-12 bg-ink px-6 text-label text-surface"
        >
          Try again
        </button>
      </body>
    </html>
  );
}
