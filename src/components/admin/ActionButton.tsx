"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, type ButtonProps } from "@/components/primitives";
import type { ActionResult } from "@/lib/actions/run-action";

/**
 * Runs a Server Action with a fixed payload, then refreshes the page so
 * server data reflects the change. Optional confirm step for destructive
 * actions. Errors are shown inline next to the button.
 */
export function ActionButton<T>({
  action,
  payload,
  children,
  confirm,
  done,
  variant = "secondary",
  size = "sm",
  className,
}: {
  action: (input: unknown) => Promise<ActionResult<T>>;
  payload: unknown;
  children: React.ReactNode;
  /** Asks before running, e.g. "Cancel this order?" */
  confirm?: string;
  /** Message shown after success. */
  done?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);

  const run = () => {
    if (confirm && !window.confirm(confirm)) return;
    startTransition(async () => {
      const result = await action(payload);
      if (result.ok) {
        setStatus(done ? { ok: true, message: done } : null);
        router.refresh();
      } else {
        setStatus({ ok: false, message: result.error.message });
      }
    });
  };

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant={variant}
        size={size}
        loading={pending}
        onClick={run}
        className={className}
      >
        {children}
      </Button>
      {status && (
        <span role="status" className={status.ok ? "text-xs text-success" : "text-xs text-sale"}>
          {status.message}
        </span>
      )}
    </span>
  );
}
