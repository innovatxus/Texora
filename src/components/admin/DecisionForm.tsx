"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { Button } from "@/components/primitives";
import type { ActionResult } from "@/lib/actions/run-action";

export interface DecisionOption {
  value: string;
  label: string;
  /** Whether the merchant must be told why (reasons required). */
  needsReason: boolean;
  variant?: "primary" | "secondary";
  confirm?: string;
}

/**
 * Reviewer decisions with reasons the merchant sees (one per line). Decisions
 * that need a reason are refused until one is written.
 */
export function DecisionForm({
  action,
  payload,
  options,
  done,
}: {
  action: (input: unknown) => Promise<ActionResult<unknown>>;
  payload: Record<string, unknown>;
  options: readonly DecisionOption[];
  done: Readonly<Record<string, string>>;
}) {
  const id = useId();
  const router = useRouter();
  const [reasons, setReasons] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const decide = (option: DecisionOption) => {
    const list = reasons
      .split("\n")
      .map((r) => r.trim())
      .filter(Boolean);
    if (option.needsReason && list.length === 0) {
      setMessage({ ok: false, text: "Write at least one reason the merchant will see." });
      return;
    }
    if (option.confirm && !window.confirm(option.confirm)) return;
    startTransition(async () => {
      const result = await action({ ...payload, decision: option.value, reasons: list });
      if (result.ok) {
        setMessage({ ok: true, text: done[option.value] ?? "Done." });
        setReasons("");
        router.refresh();
      } else {
        setMessage({ ok: false, text: result.error.message });
      }
    });
  };

  return (
    <div className="flex flex-col gap-3 text-sm">
      <label htmlFor={id} className="font-medium">
        Reasons for the merchant (one per line)
      </label>
      <textarea
        id={id}
        rows={4}
        value={reasons}
        onChange={(e) => setReasons(e.target.value)}
        className="border border-ink-subtle bg-surface p-3"
      />
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <Button
            key={option.value}
            type="button"
            size="sm"
            variant={option.variant ?? "secondary"}
            loading={pending}
            onClick={() => decide(option)}
          >
            {option.label}
          </Button>
        ))}
      </div>
      {message && (
        <p
          role={message.ok ? "status" : "alert"}
          className={message.ok ? "text-success" : "text-sale"}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
