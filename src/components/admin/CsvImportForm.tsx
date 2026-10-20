"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { Button } from "@/components/primitives";
import { importProductsAction } from "@/lib/admin/catalog-actions";

type Result = { updated: number; skipped: number; errors: Array<{ row: number; message: string }> };

/** Upload a CSV (id + name/description/status/badges) and see per-row results. */
export function CsvImportForm() {
  const router = useRouter();
  const id = useId();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    if (!file) {
      setError("Choose a CSV file");
      return;
    }
    if (file.size > 2_000_000) {
      setError("Files up to 2 MB, please");
      return;
    }
    startTransition(async () => {
      const csv = await file.text();
      const response = await importProductsAction({ csv });
      if (response.ok) {
        setError(null);
        setResult(response.data);
        router.refresh();
      } else {
        setResult(null);
        setError(response.error.fieldErrors?.csv?.[0] ?? response.error.message);
      }
    });
  };

  return (
    <div className="flex flex-col gap-3 text-sm">
      <label htmlFor={id} className="text-xs text-ink-soft">
        CSV with an <code>id</code> column and any of <code>name</code>, <code>description</code>,{" "}
        <code>status</code>, <code>badges</code> (separate badges with |)
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <input
          id={id}
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="text-sm file:mr-3 file:h-10 file:border file:border-ink file:bg-transparent file:px-4"
        />
        <Button size="sm" variant="secondary" loading={pending} onClick={submit}>
          Import
        </Button>
      </div>
      <div aria-live="polite">
        {error && <p className="text-xs text-sale">{error}</p>}
        {result && (
          <div className="text-xs">
            <p className="text-success">
              {result.updated} updated, {result.skipped} unchanged, {result.errors.length} with
              errors.
            </p>
            {result.errors.length > 0 && (
              <ul className="mt-2 list-disc pl-5 text-sale">
                {result.errors.slice(0, 20).map((e) => (
                  <li key={e.row}>
                    Row {e.row}: {e.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
