"use client";

import { Select } from "@/components/primitives";
import { MATERIALS, productConfigFor } from "@/config/product-attributes";
import type { SectionProps } from "./types";

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Category-driven attributes (the same keys and values as storefront
 * filters) and the fabric composition, whose percentages must add up to 100.
 */
export function AttributesSection({ data, update, errors }: SectionProps) {
  const config = productConfigFor(data.categoryKey);
  if (!config) {
    return <p className="text-sm text-ink-soft">Choose a category in Basics to see its details.</p>;
  }
  const total = data.composition.reduce((sum, r) => sum + (r.percent || 0), 0);

  const setAttribute = (key: string, value: string | string[]) =>
    update((c) => {
      const next = { ...c.attributes };
      if (value === "" || (Array.isArray(value) && value.length === 0)) delete next[key];
      else next[key] = value;
      return { attributes: next };
    });

  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-4 sm:grid-cols-2">
        {config.attributes.map((def) =>
          def.kind === "single" ? (
            <Select
              key={def.key}
              id={`field-attr-${def.key}`}
              label={def.label}
              required={def.required}
              placeholder={def.required ? "Choose one" : "Not specified"}
              options={def.options.map((o) => ({ value: o, label: titleCase(o) }))}
              value={
                typeof data.attributes[def.key] === "string"
                  ? (data.attributes[def.key] as string)
                  : ""
              }
              onChange={(e) => setAttribute(def.key, e.target.value)}
              error={errors[`field-attr-${def.key}`]}
            />
          ) : (
            <fieldset key={def.key} id={`field-attr-${def.key}`} className="flex flex-col gap-2">
              <legend className="mb-2 text-sm font-medium">{def.label}</legend>
              <div className="flex flex-wrap gap-x-5 gap-y-1">
                {def.options.map((option) => {
                  const current = Array.isArray(data.attributes[def.key])
                    ? (data.attributes[def.key] as string[])
                    : [];
                  return (
                    <label key={option} className="flex min-h-11 items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="size-5 accent-ink"
                        checked={current.includes(option)}
                        onChange={(e) =>
                          setAttribute(
                            def.key,
                            e.target.checked
                              ? [...current, option]
                              : current.filter((v) => v !== option),
                          )
                        }
                      />
                      {titleCase(option)}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ),
        )}
      </div>

      <fieldset id="field-composition" tabIndex={-1} className="flex flex-col gap-3">
        <legend className="mb-2 text-sm font-medium">Composition</legend>
        {data.composition.map((row, i) => (
          <div key={i} className="flex flex-wrap items-end gap-3">
            <Select
              label={`Material ${i + 1}`}
              placeholder="Choose a material"
              options={MATERIALS.map((m) => ({ value: m, label: titleCase(m) }))}
              value={row.material}
              onChange={(e) =>
                update((c) => ({
                  composition: c.composition.map((r, j) =>
                    j === i ? { ...r, material: e.target.value } : r,
                  ),
                }))
              }
              className="min-w-48 flex-1"
            />
            <label className="flex flex-col gap-2 text-sm font-medium">
              Percent
              <input
                type="number"
                min={1}
                max={100}
                inputMode="numeric"
                value={row.percent || ""}
                onChange={(e) =>
                  update((c) => ({
                    composition: c.composition.map((r, j) =>
                      j === i
                        ? { ...r, percent: Math.max(0, Math.min(100, Number(e.target.value) || 0)) }
                        : r,
                    ),
                  }))
                }
                className="h-12 w-24 border border-ink-subtle bg-surface px-3"
              />
            </label>
            <button
              type="button"
              onClick={() =>
                update((c) => ({ composition: c.composition.filter((_, j) => j !== i) }))
              }
              className="min-h-11 text-sm underline underline-offset-4"
            >
              Remove<span className="sr-only"> material {i + 1}</span>
            </button>
          </div>
        ))}
        <p
          aria-live="polite"
          className={total === 100 ? "text-sm text-success" : "text-sm text-ink-soft"}
        >
          {data.composition.length === 0
            ? "Add each material and its percentage."
            : total === 100
              ? "Total 100%"
              : `Total ${total}% — composition must add up to 100%`}
        </p>
        {errors["field-composition"] && (
          <p className="text-sm text-sale">{errors["field-composition"]}</p>
        )}
        {data.composition.length < 8 && (
          <button
            type="button"
            onClick={() =>
              update((c) => ({ composition: [...c.composition, { material: "", percent: 0 }] }))
            }
            className="min-h-11 self-start text-sm underline underline-offset-4"
          >
            Add a material
          </button>
        )}
      </fieldset>
    </div>
  );
}
