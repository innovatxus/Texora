"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FormMessage } from "@/components/merchant/forms/ErrorSummary";
import { ButtonLink, Spinner } from "@/components/primitives";
import { createProductAction } from "@/lib/merchant/actions/products";

/**
 * Creates the draft once the page is open in a browser (from an effect, so a
 * link prefetch never creates an empty product), then opens the editor.
 */
export function NewProductStarter() {
  const router = useRouter();
  const started = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void createProductAction({}).then((result) => {
      if (result.ok) router.replace(result.data.redirectTo);
      else setError(result.error.message);
    });
  }, [router]);

  if (error) {
    return (
      <div className="flex flex-col items-start gap-4">
        <FormMessage>{error}</FormMessage>
        <ButtonLink href="/merchant">Go to your dashboard</ButtonLink>
      </div>
    );
  }
  return (
    <p role="status" className="flex items-center gap-3">
      <Spinner /> Starting a new product…
    </p>
  );
}
