"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import type { z } from "zod";
import { ErrorSummary, FormMessage } from "@/components/merchant/forms/ErrorSummary";
import {
  applyServerErrors,
  savedAt,
  StepFooter,
  type FormMode,
} from "@/components/merchant/forms/StepFooter";
import { Checkbox, Input, Textarea } from "@/components/primitives";
import { MERCHANT_LIMITS, SHOP_TYPES } from "@/config/merchant";
import { saveShopBasicsAction } from "@/lib/merchant/actions/shop";
import { cn } from "@/lib/utils/cn";
import { shopBasicsSchema, suggestShopSlug } from "@/lib/validation/merchant";
import { SlugField } from "./SlugField";

type Values = z.input<typeof shopBasicsSchema>;

export interface CategoryOption {
  key: string;
  name: string;
  department: "women" | "men";
}

const FIELDS = [
  "name",
  "slug",
  "tagline",
  "description",
  "shopType",
  "departments",
  "categoryKeys",
];
const IDS: Record<string, string> = Object.fromEntries(FIELDS.map((f) => [f, `basics-${f}`]));
const { shop: S } = MERCHANT_LIMITS;

/** Onboarding step 1 / Shop › Profile: name, address, tagline, story, departments, categories, type. */
export function BasicsForm({
  mode,
  shopId,
  defaults,
  categories,
}: {
  mode: FormMode;
  shopId?: string;
  defaults?: Values;
  categories: readonly CategoryOption[];
}) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [savedTime, setSavedTime] = useState<string | null>(null);
  // The address follows the name until the merchant edits it themselves.
  const [slugEdited, setSlugEdited] = useState(Boolean(defaults?.slug));

  const {
    register,
    handleSubmit,
    control,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(shopBasicsSchema),
    mode: "onTouched",
    defaultValues: defaults ?? {
      name: "",
      slug: "",
      tagline: "",
      description: "",
      shopType: "brand",
      departments: [],
      categoryKeys: [],
    },
  });
  const [slug = "", tagline = "", description = "", departments = []] = useWatch({
    control,
    name: ["slug", "tagline", "description", "departments"],
  });

  const nameField = register("name");
  const slugField = register("slug");

  const onSubmit = handleSubmit(
    async (values) => {
      setFormError(null);
      const result = await saveShopBasicsAction({ ...values, ...(shopId ? { shopId } : {}) });
      if (!result.ok) {
        setSubmitted(true);
        setFormError(applyServerErrors(result, setError, FIELDS));
        return;
      }
      if (mode === "onboarding") {
        router.push("/merchant/onboarding/branding");
        return;
      }
      setSavedTime(savedAt(new Date()));
      router.refresh();
    },
    () => setSubmitted(true),
  );

  const summary = submitted
    ? FIELDS.filter((f) => errors[f as keyof Values]?.message).map((f) => ({
        fieldId: IDS[f] ?? f,
        message: String(errors[f as keyof Values]?.message),
      }))
    : [];
  const visibleCategories = categories.filter((c) => departments.includes(c.department));

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-8">
      <ErrorSummary errors={summary} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Input
          id={IDS.name}
          label="Shop name"
          required
          hint="This is how shoppers will see you."
          maxLength={S.nameMax}
          error={errors.name?.message}
          {...nameField}
          onChange={(e) => {
            void nameField.onChange(e);
            if (!slugEdited) setValue("slug", suggestShopSlug(e.target.value));
          }}
        />
        <SlugField
          id={IDS.slug}
          required
          value={slug}
          shopId={shopId}
          error={errors.slug?.message}
          {...slugField}
          onChange={(e) => {
            setSlugEdited(true);
            void slugField.onChange(e);
          }}
        />
      </div>
      <Input
        id={IDS.tagline}
        label="Tagline"
        hint={`${tagline.length}/${S.taglineMax}`}
        maxLength={S.taglineMax}
        error={errors.tagline?.message}
        {...register("tagline")}
      />
      <Textarea
        id={IDS.description}
        label="About your shop"
        rows={6}
        hint={`Plain text; line breaks are kept. ${description.length}/${S.descriptionMax}`}
        maxLength={S.descriptionMax}
        error={errors.description?.message}
        {...register("description")}
      />

      <fieldset
        id={IDS.departments}
        tabIndex={-1}
        aria-describedby={errors.departments ? `${IDS.departments}-error` : undefined}
        className="flex flex-col gap-3"
      >
        <legend className="mb-3 text-sm font-medium">Departments</legend>
        <div className="flex flex-wrap gap-6">
          <Checkbox label="Women" value="women" {...register("departments")} />
          <Checkbox label="Men" value="men" {...register("departments")} />
        </div>
        {errors.departments && (
          <p id={`${IDS.departments}-error`} className="text-sm text-sale">
            {errors.departments.message}
          </p>
        )}
      </fieldset>

      <fieldset
        id={IDS.categoryKeys}
        tabIndex={-1}
        aria-describedby={errors.categoryKeys ? `${IDS.categoryKeys}-error` : undefined}
        className="flex flex-col gap-3"
      >
        <legend className="mb-3 text-sm font-medium">What you sell</legend>
        {visibleCategories.length === 0 ? (
          <p className="text-sm text-ink-soft">Choose a department to see its categories.</p>
        ) : (
          (["women", "men"] as const)
            .filter((d) => departments.includes(d))
            .map((department) => (
              <div key={department} className="flex flex-col gap-2">
                <p className="text-label text-ink-soft">
                  {department === "women" ? "Women" : "Men"}
                </p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {visibleCategories
                    .filter((c) => c.department === department)
                    .map((c) => (
                      <Checkbox
                        key={c.key}
                        label={c.name}
                        value={c.key}
                        {...register("categoryKeys")}
                      />
                    ))}
                </div>
              </div>
            ))
        )}
        {errors.categoryKeys && (
          <p id={`${IDS.categoryKeys}-error`} className="text-sm text-sale">
            {errors.categoryKeys.message}
          </p>
        )}
      </fieldset>

      <fieldset id={IDS.shopType} className="flex flex-col gap-3">
        <legend className="mb-3 text-sm font-medium">Shop type</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {SHOP_TYPES.map((type) => (
            <label
              key={type.value}
              className={cn(
                "flex min-h-11 cursor-pointer items-start gap-3 border border-ink-subtle bg-surface p-4",
                "has-checked:border-ink has-checked:ring-1 has-checked:ring-ink has-focus-visible:outline-2 has-focus-visible:outline-focus",
              )}
            >
              <input
                type="radio"
                value={type.value}
                className="mt-1 accent-ink"
                {...register("shopType")}
              />
              <span>
                <span className="block font-medium">{type.label}</span>
                <span className="block text-sm text-ink-soft">{type.description}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {formError && <FormMessage>{formError}</FormMessage>}
      <StepFooter mode={mode} pending={isSubmitting} savedTime={savedTime} />
    </form>
  );
}
