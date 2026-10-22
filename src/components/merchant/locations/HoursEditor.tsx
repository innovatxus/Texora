"use client";

import { DAY_NAMES } from "@/lib/stores/hours";
import type { WeeklyHours } from "@/lib/validation/merchant";

const ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
const DEFAULT_RANGE = { open: "10:00", close: "18:00" };

/**
 * Weekly hours: per day Open/Closed with up to two ranges, and "Copy Monday
 * to all days". Native time inputs keep it keyboard- and screen-reader-friendly.
 */
export function HoursEditor({
  value,
  onChange,
  error,
  idPrefix,
}: {
  value: WeeklyHours;
  onChange: (next: WeeklyHours) => void;
  error?: string | undefined;
  idPrefix: string;
}) {
  const rangesFor = (day: number) => value.filter((h) => h.day === day);
  const replaceDay = (day: number, ranges: Array<{ open: string; close: string }>) =>
    onChange([...value.filter((h) => h.day !== day), ...ranges.map((r) => ({ day, ...r }))]);

  const copyMonday = () => {
    const monday = rangesFor(1);
    onChange([0, 1, 2, 3, 4, 5, 6].flatMap((day) => monday.map((r) => ({ ...r, day }))));
  };

  return (
    <fieldset
      id={`${idPrefix}-hours`}
      tabIndex={-1}
      aria-describedby={error ? `${idPrefix}-hours-error` : undefined}
      className="flex flex-col gap-3"
    >
      <legend className="mb-2 text-sm font-medium">Weekly hours</legend>
      <ul className="flex flex-col divide-y divide-line border-y border-line">
        {ORDER.map((day) => {
          const ranges = rangesFor(day);
          const name = DAY_NAMES[day];
          return (
            <li key={day} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center">
              <label className="flex min-h-11 w-40 shrink-0 items-center gap-3">
                <input
                  type="checkbox"
                  checked={ranges.length > 0}
                  onChange={(e) => replaceDay(day, e.target.checked ? [DEFAULT_RANGE] : [])}
                  className="size-5 accent-ink"
                />
                <span>{name}</span>
              </label>
              {ranges.length === 0 ? (
                <span className="text-sm text-ink-soft">Closed</span>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  {ranges.map((range, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="time"
                        aria-label={`${name} opens${ranges.length > 1 ? ` (range ${i + 1})` : ""}`}
                        value={range.open}
                        onChange={(e) =>
                          replaceDay(
                            day,
                            ranges.map((r, j) => (j === i ? { ...r, open: e.target.value } : r)),
                          )
                        }
                        className="h-11 border border-ink-subtle bg-surface px-2"
                      />
                      <span aria-hidden="true">–</span>
                      <input
                        type="time"
                        aria-label={`${name} closes${ranges.length > 1 ? ` (range ${i + 1})` : ""}`}
                        value={range.close}
                        onChange={(e) =>
                          replaceDay(
                            day,
                            ranges.map((r, j) => (j === i ? { ...r, close: e.target.value } : r)),
                          )
                        }
                        className="h-11 border border-ink-subtle bg-surface px-2"
                      />
                      {i === 1 && (
                        <button
                          type="button"
                          onClick={() => replaceDay(day, ranges.slice(0, 1))}
                          className="min-h-11 px-2 text-sm underline underline-offset-4"
                        >
                          Remove<span className="sr-only"> second range on {name}</span>
                        </button>
                      )}
                    </div>
                  ))}
                  {ranges.length === 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        replaceDay(day, [...ranges, { open: "14:00", close: "18:00" }])
                      }
                      className="min-h-11 px-2 text-sm underline underline-offset-4"
                    >
                      Add hours<span className="sr-only"> on {name}</span>
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        onClick={copyMonday}
        className="min-h-11 self-start text-sm underline underline-offset-4"
      >
        Copy Monday to all days
      </button>
      {error && (
        <p id={`${idPrefix}-hours-error`} className="text-sm text-sale">
          {error}
        </p>
      )}
    </fieldset>
  );
}
