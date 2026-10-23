"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ErrorSummary, FormMessage } from "@/components/merchant/forms/ErrorSummary";
import { savedAt, StepFooter, type FormMode } from "@/components/merchant/forms/StepFooter";
import { Input, Select, Textarea } from "@/components/primitives";
import {
  MERCHANT_LIMITS,
  PLATFORM_RETURN_POLICY,
  PROCESSING_TIMES,
  RETURN_WINDOWS,
} from "@/config/merchant";
import { saveShopContactAction } from "@/lib/merchant/actions/shop";
import { cn } from "@/lib/utils/cn";
import type { ReturnPolicy, Shop } from "@/lib/validation/merchant";

/** Calling codes offered in the phone field; numbers are stored in E.164 form. */
const COUNTRIES = [
  { value: "20", label: "Egypt (+20)" },
  { value: "966", label: "Saudi Arabia (+966)" },
  { value: "971", label: "United Arab Emirates (+971)" },
  { value: "1", label: "United States / Canada (+1)" },
  { value: "44", label: "United Kingdom (+44)" },
  { value: "353", label: "Ireland (+353)" },
  { value: "33", label: "France (+33)" },
  { value: "49", label: "Germany (+49)" },
  { value: "39", label: "Italy (+39)" },
  { value: "34", label: "Spain (+34)" },
  { value: "52", label: "Mexico (+52)" },
  { value: "61", label: "Australia (+61)" },
  { value: "81", label: "Japan (+81)" },
] as const;

/** Splits "+201012345678" into its calling code and national number. */
export function splitPhone(e164: string | undefined): { country: string; national: string } {
  if (!e164) return { country: "20", national: "" };
  const digits = e164.replace(/^\+/, "");
  const match = [...COUNTRIES]
    .sort((a, b) => b.value.length - a.value.length)
    .find((c) => digits.startsWith(c.value));
  return match
    ? { country: match.value, national: digits.slice(match.value.length) }
    : { country: "20", national: digits };
}

const WINDOW_LABELS: Record<number, string> = {
  0: "No returns (final sale)",
  14: "14 days",
  30: "30 days",
  60: "60 days",
};

const FIELD_IDS: Record<string, string> = {
  "contact.email": "contact-email",
  "contact.phone": "contact-phone",
  "contact.website": "contact-website",
  "social.instagram": "contact-instagram",
  "social.tiktok": "contact-tiktok",
  "social.facebook": "contact-facebook",
  "returnPolicy.notes": "contact-return-notes",
  "shipping.shipsFromLocationId": "contact-ships-from",
};

/** Onboarding step 3 / Shop › Policies. */
export function ContactForm({
  mode,
  shop,
  shipFromOptions,
}: {
  mode: FormMode;
  shop: Pick<Shop, "id" | "contact" | "social" | "returnPolicy" | "shipping">;
  shipFromOptions: ReadonlyArray<{ value: string; label: string }>;
}) {
  const router = useRouter();
  const phone = splitPhone(shop.contact.phone);
  const [values, setValues] = useState({
    email: shop.contact.email,
    country: phone.country,
    national: phone.national,
    website: shop.contact.website ?? "",
    instagram: shop.social.instagram ?? "",
    tiktok: shop.social.tiktok ?? "",
    facebook: shop.social.facebook ?? "",
    policyMode: shop.returnPolicy.mode,
    windowDays: shop.returnPolicy.mode === "custom" ? shop.returnPolicy.windowDays : 30,
    notes: shop.returnPolicy.mode === "custom" ? (shop.returnPolicy.notes ?? "") : "",
    shipsFrom: shop.shipping.shipsFromLocationId ?? "",
    processingTime: shop.shipping.processingTime,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [savedTime, setSavedTime] = useState<string | null>(null);

  const set = <K extends keyof typeof values>(key: K, value: (typeof values)[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setFormError(null);
    // A local trunk 0 ("010 1234 5678") isn't part of the international number.
    const national = values.national.replace(/\D/g, "").replace(/^0+/, "");
    const returnPolicy: ReturnPolicy =
      values.policyMode === "platform"
        ? { mode: "platform" }
        : {
            mode: "custom",
            windowDays: values.windowDays,
            ...(values.notes.trim() ? { notes: values.notes.trim() } : {}),
          };
    const result = await saveShopContactAction({
      shopId: shop.id,
      contact: {
        email: values.email,
        phone: national ? `+${values.country}${national}` : "",
        website: values.website.trim(),
      },
      social: { instagram: values.instagram, tiktok: values.tiktok, facebook: values.facebook },
      returnPolicy,
      shipping: { shipsFromLocationId: values.shipsFrom, processingTime: values.processingTime },
    });
    setPending(false);
    if (!result.ok) {
      const next: Record<string, string> = {};
      for (const [key, messages] of Object.entries(result.error.fieldErrors ?? {})) {
        if (messages[0]) next[key] = messages[0];
      }
      setErrors(next);
      setFormError(Object.keys(next).length > 0 ? null : result.error.message);
      return;
    }
    setErrors({});
    if (mode === "onboarding") {
      router.push("/merchant/onboarding/locations");
      return;
    }
    setSavedTime(savedAt(new Date()));
    router.refresh();
  };

  const summary = Object.entries(errors).map(([key, message]) => ({
    fieldId: FIELD_IDS[key] ?? "contact-email",
    message,
  }));

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-10">
      <ErrorSummary errors={summary} />
      <section aria-labelledby="contact-title" className="flex flex-col gap-6">
        <h2 id="contact-title" className="font-display text-2xl">
          Contact
        </h2>
        <Input
          id="contact-email"
          label="Public contact email"
          type="email"
          required
          hint="Shown on your shop page."
          value={values.email}
          onChange={(e) => set("email", e.target.value)}
          error={errors["contact.email"]}
        />
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <Select
            id="contact-country"
            label="Country code"
            options={COUNTRIES}
            value={values.country}
            onChange={(e) => set("country", e.target.value)}
          />
          <Input
            id="contact-phone"
            label="Phone (optional)"
            type="tel"
            autoComplete="tel-national"
            value={values.national}
            onChange={(e) => set("national", e.target.value)}
            error={errors["contact.phone"]}
          />
        </div>
        <Input
          id="contact-website"
          label="Website (optional)"
          type="url"
          placeholder="https://"
          value={values.website}
          onChange={(e) => set("website", e.target.value)}
          error={errors["contact.website"]}
        />
        <div className="grid gap-4 sm:grid-cols-3">
          {(["instagram", "tiktok", "facebook"] as const).map((network) => (
            <Input
              key={network}
              id={`contact-${network}`}
              label={`${network === "tiktok" ? "TikTok" : network[0]?.toUpperCase() + network.slice(1)} (optional)`}
              hint="Your handle without the @"
              autoCapitalize="none"
              value={values[network]}
              onChange={(e) => set(network, e.target.value)}
              error={errors[`social.${network}`]}
            />
          ))}
        </div>
      </section>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 font-display text-2xl">Returns</legend>
        {(
          [
            ["platform", `Use Texora's policy (${PLATFORM_RETURN_POLICY.summary})`],
            ["custom", "Set your own"],
          ] as const
        ).map(([value, label]) => (
          <label key={value} className="flex min-h-11 items-center gap-3">
            <input
              type="radio"
              name="policy"
              value={value}
              checked={values.policyMode === value}
              onChange={() => set("policyMode", value)}
              className="accent-ink"
            />
            {label}
          </label>
        ))}
        {values.policyMode === "custom" && (
          <div className="flex flex-col gap-4 border-l-2 border-line pl-4">
            <Select
              id="contact-window"
              label="Return window"
              options={RETURN_WINDOWS.map((w) => ({
                value: String(w),
                label: WINDOW_LABELS[w] ?? `${w} days`,
              }))}
              value={String(values.windowDays)}
              onChange={(e) =>
                set("windowDays", Number(e.target.value) as typeof values.windowDays)
              }
            />
            <Textarea
              id="contact-return-notes"
              label="Condition notes (optional)"
              hint={`For example, "Unworn, with tags". ${values.notes.length}/${MERCHANT_LIMITS.shop.returnNotesMax}`}
              maxLength={MERCHANT_LIMITS.shop.returnNotesMax}
              value={values.notes}
              onChange={(e) => set("notes", e.target.value)}
              error={errors["returnPolicy.notes"]}
            />
          </div>
        )}
      </fieldset>

      <section aria-labelledby="shipping-title" className="flex flex-col gap-6">
        <h2 id="shipping-title" className="font-display text-2xl">
          Shipping
        </h2>
        {shipFromOptions.length > 0 ? (
          <Select
            id="contact-ships-from"
            label="Ships from"
            options={shipFromOptions}
            value={values.shipsFrom}
            onChange={(e) => set("shipsFrom", e.target.value)}
            error={errors["shipping.shipsFromLocationId"]}
          />
        ) : (
          <p className="text-sm text-ink-soft">Add a ship-from location in the next step.</p>
        )}
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">Processing time</legend>
          <div className="flex flex-wrap gap-3">
            {PROCESSING_TIMES.map((option) => (
              <label
                key={option.value}
                className={cn(
                  "flex min-h-11 cursor-pointer items-center gap-2 border border-ink-subtle bg-surface px-4",
                  "has-checked:border-ink has-checked:ring-1 has-checked:ring-ink has-focus-visible:outline-2 has-focus-visible:outline-focus",
                )}
              >
                <input
                  type="radio"
                  name="processing"
                  value={option.value}
                  checked={values.processingTime === option.value}
                  onChange={() => set("processingTime", option.value)}
                  className="accent-ink"
                />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      {formError && <FormMessage>{formError}</FormMessage>}
      <StepFooter
        mode={mode}
        backHref="/merchant/onboarding/branding"
        pending={pending}
        savedTime={savedTime}
      />
    </form>
  );
}
