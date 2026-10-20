"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { Button } from "@/components/primitives";
import { receiveReturnAction } from "@/lib/admin/sales-actions";
import { adminControl } from "./ui";

/** Marks each returned item resellable or damaged, and where resellable stock goes back. */
export function ReceiveReturnForm({
  returnId,
  lines,
  locations,
  defaultLocation,
}: {
  returnId: string;
  lines: Array<{ sku: string; label: string; quantity: number }>;
  locations: Array<{ value: string; label: string }>;
  defaultLocation: string;
}) {
  const router = useRouter();
  const id = useId();
  const [conditions, setConditions] = useState<Record<string, "resellable" | "damaged">>(
    Object.fromEntries(lines.map((l) => [l.sku, "resellable" as const])),
  );
  const [location, setLocation] = useState(defaultLocation);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () =>
    startTransition(async () => {
      const result = await receiveReturnAction({ returnId, location, conditions });
      if (result.ok) {
        setError(null);
        router.refresh();
      } else setError(result.error.message);
    });

  return (
    <div className="flex flex-col gap-3 text-sm">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-xs text-ink-soft">Condition of each item</legend>
        {lines.map((line) => (
          <div key={line.sku} className="flex flex-wrap items-center justify-between gap-2">
            <label htmlFor={`${id}-${line.sku}`}>
              {line.label} × {line.quantity}
            </label>
            <select
              id={`${id}-${line.sku}`}
              value={conditions[line.sku]}
              onChange={(e) =>
                setConditions((c) => ({
                  ...c,
                  [line.sku]: e.target.value as "resellable" | "damaged",
                }))
              }
              className={adminControl}
            >
              <option value="resellable">Resellable: restock</option>
              <option value="damaged">Damaged: don&apos;t restock</option>
            </select>
          </div>
        ))}
      </fieldset>
      <label className="flex flex-col gap-1 text-xs text-ink-soft">
        Restock to
        <select
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className={adminControl}
        >
          {locations.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-center gap-3">
        <Button size="sm" variant="secondary" loading={pending} onClick={submit}>
          Mark received and inspected
        </Button>
        {error && (
          <span role="status" className="text-xs text-sale">
            {error}
          </span>
        )}
      </div>
    </div>
  );
}
