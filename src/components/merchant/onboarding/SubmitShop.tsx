"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormMessage } from "@/components/merchant/forms/ErrorSummary";
import { Button } from "@/components/primitives";
import { submitShopAction } from "@/lib/merchant/actions/shop";

/** "Submit for review": disabled while anything blocks it, with the reason underneath. */
export function SubmitShop({ shopId, blocked }: { shopId: string; blocked: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setPending(true);
    setError(null);
    const result = await submitShopAction({ shopId });
    if (!result.ok) {
      setPending(false);
      setError(result.error.message);
      return;
    }
    router.replace(result.data.redirectTo);
    router.refresh();
  };

  return (
    <div className="flex flex-col items-start gap-3">
      <Button
        size="lg"
        onClick={submit}
        loading={pending}
        disabled={blocked}
        aria-describedby={blocked ? "submit-blocked" : undefined}
      >
        Submit for review
      </Button>
      {blocked && (
        <p id="submit-blocked" className="text-sm text-ink-soft">
          Finish the items above to submit.
        </p>
      )}
      {error && <FormMessage>{error}</FormMessage>}
    </div>
  );
}
