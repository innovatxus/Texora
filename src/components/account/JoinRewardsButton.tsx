"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormMessage } from "@/components/merchant/forms/ErrorSummary";
import { Button } from "@/components/primitives";
import { joinRewardsAction } from "@/lib/account/actions/auth";

/** Joins rewards in one click; the page refreshes to show the membership. */
export function JoinRewardsButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-3">
      <Button
        type="button"
        className="self-start"
        loading={pending}
        onClick={async () => {
          setPending(true);
          setError(null);
          const result = await joinRewardsAction({});
          setPending(false);
          if (result.ok) router.refresh();
          else setError(result.error.message);
        }}
      >
        Join rewards
      </Button>
      {error && <FormMessage>{error}</FormMessage>}
    </div>
  );
}
