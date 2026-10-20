"use client";

import { useState } from "react";
import { CheckIcon } from "@/components/icons";
import { Button } from "@/components/primitives";
import { unsubscribeAlerts } from "@/lib/notifications/actions";

/**
 * Confirm step for unsubscribe links. Done on a button press rather than on
 * page load, so link scanners in mail clients can't unsubscribe people.
 */
export function UnsubscribeAlerts({ email, token }: { email: string; token: string }) {
  const [state, setState] = useState<"idle" | "pending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  if (state === "done") {
    return (
      <p role="status" className="flex items-center gap-2">
        <CheckIcon /> Done. We won&apos;t send {email} any more product alerts.
      </p>
    );
  }
  return (
    <div className="flex flex-col items-start gap-4">
      <Button
        loading={state === "pending"}
        onClick={async () => {
          setState("pending");
          const result = await unsubscribeAlerts({ email, token });
          if (result.ok) {
            setState("done");
            return;
          }
          setState("idle");
          setError(result.error.message);
        }}
      >
        Stop product alerts
      </Button>
      {error && (
        <p role="alert" className="text-sm text-sale">
          {error}
        </p>
      )}
    </div>
  );
}
