"use client";

import { useState } from "react";
import { Input, Select, Textarea } from "@/components/primitives";
import { MERCHANT_LIMITS, PROCESSING_TIMES } from "@/config/merchant";
import { suggestProductSlug, suggestSeoDescription, suggestSeoTitle } from "@/lib/merchant/editor";
import { PRODUCT_STATUS_LABELS } from "@/lib/catalog/product-status";
import type { SectionProps } from "./types";

const numberOrNull = (value: string) =>
  value.trim() === "" ? null : Math.max(0, Number(value) || 0);

/** Fit notes, model info, care lines and the size guide (platform or the merchant's own table). */
export function DetailsSection({ data, update }: SectionProps) {
  const d = data.details;
  const set = (patch: Partial<typeof d>) =>
    update((c) => ({ details: { ...c.details, ...patch } }));
  const guide = d.customGuide.length
    ? d.customGuide
    : [
        ["Size", "Bust", "Waist", "Hip"],
        ["", "", "", ""],
      ];

  return (
    <div className="flex flex-col gap-6">
      <Textarea
        id="field-fit-notes"
        label="Fit notes"
        rows={3}
        maxLength={500}
        hint="For example, “Relaxed fit; size down for a closer fit.”"
        value={d.fitNotes}
        onChange={(e) => set({ fitNotes: e.target.value })}
      />
      <Input
        id="field-model"
        label="Model info"
        maxLength={200}
        hint="For example, “Model is 5′10″ and wears size S.”"
        value={d.modelInfo}
        onChange={(e) => set({ modelInfo: e.target.value })}
      />
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-sm font-medium">Care</legend>
        {d.care.map((line, i) => (
          <div key={i} className="flex items-end gap-2">
            <Input
              label={`Care line ${i + 1}`}
              className="flex-1"
              maxLength={200}
              value={line}
              onChange={(e) => set({ care: d.care.map((x, j) => (j === i ? e.target.value : x)) })}
            />
            <button
              type="button"
              onClick={() => set({ care: d.care.filter((_, j) => j !== i) })}
              className="min-h-11 px-2 text-sm underline underline-offset-4"
            >
              Remove<span className="sr-only"> care line {i + 1}</span>
            </button>
          </div>
        ))}
        {d.care.length < 8 && (
          <button
            type="button"
            onClick={() => set({ care: [...d.care, ""] })}
            className="min-h-11 self-start text-sm underline underline-offset-4"
          >
            Add a care line
          </button>
        )}
      </fieldset>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-sm font-medium">Size guide</legend>
        {(
          [
            ["platform", "Use Texora's size guide for this category"],
            ["custom", "Use my own measurements"],
          ] as const
        ).map(([value, label]) => (
          <label key={value} className="flex min-h-11 items-center gap-3">
            <input
              type="radio"
              name="size-guide"
              className="accent-ink"
              checked={d.sizeGuide === value}
              onChange={() =>
                set({
                  sizeGuide: value,
                  ...(value === "custom" && !d.customGuide.length ? { customGuide: guide } : {}),
                })
              }
            />
            {label}
          </label>
        ))}
        {d.sizeGuide === "custom" && (
          <div className="overflow-x-auto" role="region" aria-label="Your size guide" tabIndex={0}>
            <table className="border-collapse text-sm">
              <tbody>
                {guide.map((row, r) => (
                  <tr key={r}>
                    {row.map((cell, c) => (
                      <td key={c} className="p-1">
                        <input
                          aria-label={
                            r === 0
                              ? `Column ${c + 1} heading`
                              : `${guide[0]?.[c] || `Column ${c + 1}`}, row ${r}`
                          }
                          value={cell}
                          maxLength={30}
                          onChange={(e) =>
                            set({
                              customGuide: guide.map((x, i) =>
                                i === r ? x.map((y, j) => (j === c ? e.target.value : y)) : x,
                              ),
                            })
                          }
                          className={`h-11 w-24 border border-ink-subtle bg-surface px-2 ${r === 0 ? "font-medium" : ""}`}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-2 flex gap-4 text-sm">
              <button
                type="button"
                disabled={guide.length >= 30}
                onClick={() => set({ customGuide: [...guide, guide[0]?.map(() => "") ?? []] })}
                className="min-h-11 underline underline-offset-4"
              >
                Add a row
              </button>
              <button
                type="button"
                disabled={(guide[0]?.length ?? 0) >= 10}
                onClick={() => set({ customGuide: guide.map((row) => [...row, ""]) })}
                className="min-h-11 underline underline-offset-4"
              >
                Add a column
              </button>
            </div>
          </div>
        )}
      </fieldset>
    </div>
  );
}

/** Package size and weight defaults (variants inherit the weight), ships-from and processing time. */
export function ShippingSection({ data, update, context }: SectionProps) {
  const s = data.shipping;
  const set = (patch: Partial<typeof s>) =>
    update((c) => ({ shipping: { ...c.shipping, ...patch } }));
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-4">
        <Input
          id="field-weight"
          label="Weight (g)"
          inputMode="numeric"
          value={s.weightGrams ?? ""}
          onChange={(e) => set({ weightGrams: numberOrNull(e.target.value) })}
          hint="Used for new variants."
        />
        <Input
          label="Length (cm)"
          inputMode="decimal"
          value={s.lengthCm ?? ""}
          onChange={(e) => set({ lengthCm: numberOrNull(e.target.value) })}
        />
        <Input
          label="Width (cm)"
          inputMode="decimal"
          value={s.widthCm ?? ""}
          onChange={(e) => set({ widthCm: numberOrNull(e.target.value) })}
        />
        <Input
          label="Height (cm)"
          inputMode="decimal"
          value={s.heightCm ?? ""}
          onChange={(e) => set({ heightCm: numberOrNull(e.target.value) })}
        />
      </div>
      <Select
        id="field-ships-from"
        label="Ships from"
        placeholder="Shop default"
        options={context.locations
          .filter((l) => l.shipFrom)
          .map((l) => ({ value: l.id, label: l.name }))}
        value={s.shipsFromLocationId}
        onChange={(e) => set({ shipsFromLocationId: e.target.value })}
      />
      <Select
        label="Processing time"
        placeholder="Shop default"
        options={PROCESSING_TIMES}
        value={s.processingTime}
        onChange={(e) => set({ processingTime: e.target.value as typeof s.processingTime })}
      />
    </div>
  );
}

/** Status and schedule, address, SEO title and description (generated, with counters) and keywords. */
export function SeoSection({ data, update, context, errors }: SectionProps) {
  const [keyword, setKeyword] = useState("");
  const titleSuggestion = suggestSeoTitle(data.name || "Product", context.shop.name);
  const descriptionSuggestion = suggestSeoDescription(data.description);
  const addKeyword = () => {
    const value = keyword.trim().toLowerCase();
    if (
      value &&
      !data.searchKeywords.includes(value) &&
      data.searchKeywords.length < MERCHANT_LIMITS.product.keywordsMax
    ) {
      update((c) => ({ searchKeywords: [...c.searchKeywords, value] }));
    }
    setKeyword("");
  };

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm">
        Status: <strong>{PRODUCT_STATUS_LABELS[context.status]}</strong>
      </p>
      <Input
        id="field-publish-at"
        label="Publish on (optional)"
        type="datetime-local"
        hint="Goes live at this time once approved. Leave empty to publish as soon as it's approved."
        value={data.publishAt}
        onChange={(e) => update({ publishAt: e.target.value })}
      />
      <Input
        id="field-slug"
        label="Product address"
        hint={`texora.com/product/${data.slug || suggestProductSlug(data.name) || "your-product"}`}
        maxLength={120}
        value={data.slug}
        placeholder={suggestProductSlug(data.name)}
        onChange={(e) => update({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })}
        error={errors["field-slug"]}
      />
      <div className="flex flex-col gap-2">
        <Input
          id="field-seo-title"
          label="Search title"
          maxLength={70}
          placeholder={titleSuggestion}
          hint={`${(data.seo.title || titleSuggestion).length}/60 recommended`}
          value={data.seo.title}
          onChange={(e) => update((c) => ({ seo: { ...c.seo, title: e.target.value } }))}
        />
        <button
          type="button"
          onClick={() => update((c) => ({ seo: { ...c.seo, title: titleSuggestion } }))}
          className="min-h-11 self-start text-sm underline underline-offset-4"
        >
          Use suggestion
        </button>
      </div>
      <div className="flex flex-col gap-2">
        <Textarea
          id="field-seo-description"
          label="Search description"
          rows={3}
          maxLength={160}
          placeholder={descriptionSuggestion}
          hint={`${(data.seo.description || descriptionSuggestion).length}/160`}
          value={data.seo.description}
          onChange={(e) => update((c) => ({ seo: { ...c.seo, description: e.target.value } }))}
        />
        <button
          type="button"
          onClick={() => update((c) => ({ seo: { ...c.seo, description: descriptionSuggestion } }))}
          className="min-h-11 self-start text-sm underline underline-offset-4"
        >
          Use suggestion
        </button>
      </div>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-sm font-medium">Search keywords</legend>
        <ul className="flex flex-wrap gap-2">
          {data.searchKeywords.map((k) => (
            <li key={k}>
              <button
                type="button"
                onClick={() =>
                  update((c) => ({ searchKeywords: c.searchKeywords.filter((x) => x !== k) }))
                }
                className="min-h-11 border border-line bg-surface px-3 text-sm"
              >
                {k} <span aria-hidden="true">×</span>
                <span className="sr-only">, remove</span>
              </button>
            </li>
          ))}
        </ul>
        <Input
          label="Add a keyword"
          hint="Press Enter to add."
          maxLength={60}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addKeyword();
            }
          }}
        />
      </fieldset>
    </div>
  );
}
