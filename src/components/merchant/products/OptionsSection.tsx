"use client";

import { useState } from "react";
import { Button, Input, Select } from "@/components/primitives";
import { SIZE_RUNS } from "@/config/merchant";
import { productConfigFor } from "@/config/product-attributes";
import { colorCode, matrixDefaults, matrixOptions } from "@/lib/merchant/editor";
import { buildMatrix } from "@/lib/merchant/variants/matrix";
import { COLOR_FAMILIES, FIT_LABELS, type FitFamily } from "@/lib/validation/common";
import type { DraftColor, ProductDraftData } from "@/lib/validation/merchant";
import type { SectionProps } from "./types";
import { VariantMatrix } from "./VariantMatrix";

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** EyeDropper is Chromium-only; elsewhere the hex field and the photo's main colour are offered. */
interface EyeDropperLike {
  open: () => Promise<{ sRGBHex: string }>;
}

/**
 * Colours, fits and sizes, and the variant matrix they generate. Changing
 * options rebuilds the matrix without losing what was entered (removed
 * combinations are parked and come back with their values).
 */
export function OptionsSection({ data, update, context, errors }: SectionProps) {
  const [newColor, setNewColor] = useState("");
  const [customSize, setCustomSize] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const config = productConfigFor(data.categoryKey);

  /** Applies option changes and rebuilds the matrix from them (called from event handlers). */
  const withMatrix = (change: (current: ProductDraftData) => Partial<ProductDraftData>) => {
    const changes = change(data);
    const next = { ...data, ...changes };
    const result = buildMatrix(matrixOptions(next), next.matrix, next.parked, matrixDefaults(next));
    if (result.added || result.removed) {
      setAnnouncement(
        [
          result.added ? `Added ${result.added} variant${result.added === 1 ? "" : "s"}.` : "",
          result.removed ? `Removed ${result.removed} (kept in case you add them back).` : "",
          result.kept ? `Kept prices and stock for ${result.kept} existing variants.` : "",
        ]
          .filter(Boolean)
          .join(" "),
      );
    }
    update({ ...changes, matrix: result.rows, parked: result.parked });
  };

  const addColor = () => {
    const name = newColor.trim();
    if (!name) return;
    withMatrix((c) => ({
      colors: [
        ...c.colors,
        {
          code: colorCode(
            name,
            c.colors.map((x) => x.code),
          ),
          name,
          family: "neutral",
          swatch: "#8a8580",
          images: [],
        } satisfies DraftColor,
      ],
    }));
    setNewColor("");
  };

  const patchColor = (code: string, patch: Partial<DraftColor>) =>
    update((c) => ({ colors: c.colors.map((x) => (x.code === code ? { ...x, ...patch } : x)) }));

  const moveColor = (index: number, delta: number) =>
    withMatrix((c) => {
      const colors = [...c.colors];
      const [moved] = colors.splice(index, 1);
      if (moved) colors.splice(index + delta, 0, moved);
      return { colors };
    });

  const pickColour = async (code: string) => {
    const Dropper = (window as unknown as { EyeDropper?: new () => EyeDropperLike }).EyeDropper;
    if (!Dropper) return;
    try {
      const { sRGBHex } = await new Dropper().open();
      patchColor(code, { swatch: sRGBHex.toLowerCase() });
    } catch {
      // The merchant pressed Escape.
    }
  };

  const runs = config ? SIZE_RUNS[config.sizeType] : [];
  const supportsDropper = typeof window !== "undefined" && "EyeDropper" in window;

  if (!config) {
    return (
      <p className="text-sm text-ink-soft">
        Choose a category in Basics to set up colours and sizes.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      <p aria-live="polite" className="text-sm text-ink-soft">
        {announcement}
      </p>

      <fieldset id="field-colors" tabIndex={-1} className="flex flex-col gap-4">
        <legend className="mb-2 font-medium">Colours</legend>
        <ol className="flex flex-col gap-3">
          {data.colors.map((color, index) => (
            <li
              key={color.code}
              className="flex flex-col gap-3 border border-line bg-surface p-3 sm:flex-row sm:flex-wrap sm:items-end"
            >
              <span
                aria-hidden="true"
                className="size-10 shrink-0 border border-line"
                style={{ background: color.swatch }}
              />
              <Input
                label="Colour name"
                className="min-w-40 flex-1"
                maxLength={40}
                value={color.name}
                onChange={(e) => patchColor(color.code, { name: e.target.value })}
              />
              <Select
                label="Colour family"
                options={COLOR_FAMILIES.map((f) => ({ value: f, label: titleCase(f) }))}
                value={color.family}
                onChange={(e) =>
                  patchColor(color.code, { family: e.target.value as DraftColor["family"] })
                }
              />
              <Input
                label="Swatch (hex)"
                className="w-32"
                maxLength={7}
                value={color.swatch}
                onChange={(e) => patchColor(color.code, { swatch: e.target.value.toLowerCase() })}
                error={
                  /^#[0-9a-f]{6}$/i.test(color.swatch) ? undefined : "Enter a colour like #1F2A44"
                }
              />
              <div className="flex flex-wrap gap-2 text-sm">
                {supportsDropper && (
                  <button
                    type="button"
                    onClick={() => void pickColour(color.code)}
                    className="min-h-11 px-2 underline underline-offset-4"
                  >
                    Pick from screen<span className="sr-only"> for {color.name}</span>
                  </button>
                )}
                {color.images[0]?.dominantColor && (
                  <button
                    type="button"
                    onClick={() =>
                      patchColor(color.code, {
                        swatch: color.images[0]?.dominantColor ?? color.swatch,
                      })
                    }
                    className="min-h-11 px-2 underline underline-offset-4"
                  >
                    Use photo colour<span className="sr-only"> for {color.name}</span>
                  </button>
                )}
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => moveColor(index, -1)}
                  className="min-h-11 px-2 underline underline-offset-4 disabled:text-ink-subtle disabled:no-underline"
                >
                  Move up<span className="sr-only"> {color.name}</span>
                </button>
                <button
                  type="button"
                  disabled={index === data.colors.length - 1}
                  onClick={() => moveColor(index, 1)}
                  className="min-h-11 px-2 underline underline-offset-4 disabled:text-ink-subtle disabled:no-underline"
                >
                  Move down<span className="sr-only"> {color.name}</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    withMatrix((c) => ({ colors: c.colors.filter((x) => x.code !== color.code) }))
                  }
                  className="min-h-11 px-2 text-sale underline underline-offset-4"
                >
                  Remove<span className="sr-only"> {color.name}</span>
                </button>
              </div>
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap items-end gap-3">
          <Input
            label="New colour"
            placeholder="e.g. Navy"
            className="min-w-48"
            maxLength={40}
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addColor();
              }
            }}
          />
          <Button type="button" variant="secondary" onClick={addColor}>
            Add colour
          </Button>
        </div>
        {errors["field-colors"] && <p className="text-sm text-sale">{errors["field-colors"]}</p>}
      </fieldset>

      <fieldset id="field-fits" className="flex flex-col gap-3">
        <legend className="mb-2 font-medium">Fits</legend>
        <div className="flex flex-wrap gap-x-6">
          {config.fitFamilies.map((fit) => (
            <label key={fit} className="flex min-h-11 items-center gap-2">
              <input
                type="checkbox"
                className="size-5 accent-ink"
                checked={data.fits.includes(fit)}
                onChange={(e) =>
                  withMatrix((c) => ({
                    fits: e.target.checked
                      ? config.fitFamilies.filter((f) => c.fits.includes(f) || f === fit)
                      : c.fits.filter((f) => f !== fit),
                  }))
                }
              />
              {FIT_LABELS[fit as FitFamily]}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset id="field-sizes" tabIndex={-1} className="flex flex-col gap-3">
        <legend className="mb-2 font-medium">Sizes</legend>
        {runs.map((run) => (
          <div key={run.id} className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-4">
              <p className="text-sm text-ink-soft">{run.label}</p>
              <button
                type="button"
                onClick={() => withMatrix(() => ({ sizes: [...run.sizes] }))}
                className="min-h-11 text-sm underline underline-offset-4"
              >
                Select all<span className="sr-only"> {run.label}</span>
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {run.sizes.map((size) => (
                <label
                  key={size}
                  className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center border border-ink-subtle px-3 text-sm has-checked:border-ink has-checked:bg-ink has-checked:text-surface has-focus-visible:outline-2 has-focus-visible:outline-focus"
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={data.sizes.includes(size)}
                    onChange={(e) =>
                      withMatrix((c) => ({
                        sizes: e.target.checked
                          ? run.sizes
                              .filter((s) => c.sizes.includes(s) || s === size)
                              .concat(c.sizes.filter((s) => !run.sizes.includes(s)))
                          : c.sizes.filter((s) => s !== size),
                      }))
                    }
                  />
                  {size}
                </label>
              ))}
            </div>
            {run.allowCustom && (
              <div className="flex flex-wrap items-end gap-3">
                <Input
                  label="Custom size"
                  className="w-40"
                  maxLength={20}
                  value={customSize}
                  onChange={(e) => setCustomSize(e.target.value)}
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    const size = customSize.trim();
                    if (size && !data.sizes.includes(size))
                      withMatrix((c) => ({ sizes: [...c.sizes, size] }));
                    setCustomSize("");
                  }}
                >
                  Add size
                </Button>
              </div>
            )}
          </div>
        ))}
        {errors["field-sizes"] && <p className="text-sm text-sale">{errors["field-sizes"]}</p>}
      </fieldset>

      <section
        aria-labelledby="matrix-title"
        id="field-matrix"
        tabIndex={-1}
        className="flex flex-col gap-3"
      >
        <h3 id="matrix-title" className="font-medium">
          Variants
        </h3>
        {errors["field-matrix"] && <p className="text-sm text-sale">{errors["field-matrix"]}</p>}
        <VariantMatrix
          rows={data.matrix}
          colorNames={Object.fromEntries(data.colors.map((c) => [c.code, c.name || c.code]))}
          locations={context.locations}
          onChange={(rows) => update({ matrix: rows })}
          onExclude={(key) => withMatrix((c) => ({ excluded: [...new Set([...c.excluded, key])] }))}
        />
        {data.excluded.length > 0 && (
          <div className="flex flex-col gap-2 text-sm">
            <p className="text-ink-soft">Not made — these combinations won&apos;t be created:</p>
            <ul className="flex flex-wrap gap-2">
              {data.excluded.map((key) => {
                const [color = "", fit = "", size = ""] = key.split("|");
                const name = data.colors.find((c) => c.code === color)?.name ?? color;
                return (
                  <li key={key}>
                    <button
                      type="button"
                      onClick={() =>
                        withMatrix((c) => ({ excluded: c.excluded.filter((k) => k !== key) }))
                      }
                      className="min-h-11 border border-line px-3 underline-offset-4 hover:underline"
                    >
                      Make {name}, {FIT_LABELS[fit as FitFamily] ?? fit}, {size}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
