"use client";

import { Input, Select, Textarea } from "@/components/primitives";
import { MERCHANT_LIMITS } from "@/config/merchant";
import { productConfigFor } from "@/config/product-attributes";
import { suggestStyleId } from "@/lib/merchant/editor";
import { SIZE_RUNS } from "@/config/merchant";
import type { SectionProps } from "./types";

const P = MERCHANT_LIMITS.product;

/** Name, description, highlights, category (a leaf is required) and style id. */
export function BasicsSection({ data, update, context, errors }: SectionProps) {
  const [department = "", leaf = ""] = data.categoryKey.split("/");
  const departmentOptions = [
    ...new Set(context.categories.map((c) => c.categoryKey.split("/")[0] ?? "")),
  ].map((d) => ({ value: d, label: d === "women" ? "Women" : "Men" }));
  const leafOptions = context.categories
    .filter((c) => c.categoryKey.startsWith(`${department}/`))
    .map((c) => ({ value: c.categoryKey.split("/")[1] ?? "", label: c.label }));

  const chooseCategory = (key: string) =>
    update((current) => {
      const config = productConfigFor(key);
      const firstRun = config ? SIZE_RUNS[config.sizeType][0] : undefined;
      return {
        categoryKey: key,
        // The size run follows the category; fits are limited to what it allows.
        ...(config && current.categoryKey !== key
          ? {
              sizes: firstRun && !firstRun.allowCustom ? [] : current.sizes,
              fits: current.fits.filter((f) => config.fitFamilies.includes(f)).length
                ? current.fits.filter((f) => config.fitFamilies.includes(f))
                : ["regular"],
              attributes: {},
            }
          : {}),
        ...(current.styleId
          ? {}
          : { styleId: suggestStyleId(context.shop.slug, key, context.productCount) }),
      };
    });

  return (
    <div className="flex flex-col gap-6">
      <Input
        id="field-name"
        label="Product name"
        required
        maxLength={P.nameMax}
        hint={`${data.name.length}/${P.nameMax}`}
        value={data.name}
        onChange={(e) => update({ name: e.target.value })}
        error={errors["field-name"]}
      />
      <Textarea
        id="field-description"
        label="Description"
        rows={6}
        maxLength={P.descriptionMax}
        hint={`${data.description.length}/${P.descriptionMax}`}
        value={data.description}
        onChange={(e) => update({ description: e.target.value })}
        error={errors["field-description"]}
      />
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-sm font-medium">Highlights (up to {P.highlightsMax})</legend>
        {data.highlights.map((h, i) => (
          <div key={i} className="flex items-end gap-2">
            <Input
              label={`Highlight ${i + 1}`}
              className="flex-1"
              maxLength={P.highlightMax}
              value={h}
              onChange={(e) =>
                update((c) => ({
                  highlights: c.highlights.map((x, j) => (j === i ? e.target.value : x)),
                }))
              }
            />
            <button
              type="button"
              onClick={() =>
                update((c) => ({ highlights: c.highlights.filter((_, j) => j !== i) }))
              }
              className="min-h-11 px-2 text-sm underline underline-offset-4"
            >
              Remove<span className="sr-only"> highlight {i + 1}</span>
            </button>
          </div>
        ))}
        {data.highlights.length < P.highlightsMax && (
          <button
            type="button"
            onClick={() => update((c) => ({ highlights: [...c.highlights, ""] }))}
            className="min-h-11 self-start text-sm underline underline-offset-4"
          >
            Add a highlight
          </button>
        )}
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          id="field-department"
          label="Department"
          required
          placeholder="Choose a department"
          options={departmentOptions}
          value={department}
          onChange={(e) => update({ categoryKey: e.target.value ? `${e.target.value}/` : "" })}
        />
        <Select
          id="field-category"
          label="Category"
          required
          placeholder="Choose a category"
          options={leafOptions}
          value={leaf}
          disabled={!department}
          onChange={(e) => e.target.value && chooseCategory(`${department}/${e.target.value}`)}
          error={errors["field-category"]}
          hint="Drives the sizes and details we ask for."
        />
      </div>
      <Input
        id="field-style"
        label="Style ID"
        hint="Your own reference; also the start of each SKU. Unique in your shop."
        maxLength={40}
        value={data.styleId}
        onChange={(e) => update({ styleId: e.target.value.toUpperCase() })}
        error={errors["field-style"]}
      />
    </div>
  );
}
