"use client";

import { useEffect, useState, type FormEvent } from "react";
import { FormMessage } from "@/components/merchant/forms/ErrorSummary";
import { Button, Checkbox, Input, Select } from "@/components/primitives";
import { SIZE_RUNS } from "@/config/merchant";
import {
  updateCommunicationAction,
  updateDetailsAction,
  updateSizePreferencesAction,
} from "@/lib/account/actions/account";
import { FIT_LABELS, type FitFamily, type SizeType } from "@/lib/validation/common";
import { usePreferencesStore } from "@/stores/preferences";

type Sizes = Partial<Record<SizeType, string>>;

/** Keeps the browser copy of fit and sizes (used by product pages) in step with the account. */
export function PreferencesSync({
  fitFamily,
  savedSizes,
}: {
  fitFamily: FitFamily | null;
  savedSizes: Sizes;
}) {
  const set = usePreferencesStore((s) => s.set);
  const key = JSON.stringify([fitFamily, savedSizes]);
  useEffect(() => {
    const [fit, sizes] = JSON.parse(key) as [FitFamily | null, Sizes];
    set({ fitFamily: fit, savedSizes: sizes });
  }, [key, set]);
  return null;
}

const SIZE_FIELDS: Array<{ type: SizeType; label: string; hint: string }> = [
  { type: "alpha", label: "Tops, sweaters, coats and dresses", hint: "XXS to 4XL" },
  { type: "numeric", label: "Women's pants and jeans", hint: "Numeric sizes" },
  { type: "waist_inseam", label: "Men's pants and jeans", hint: "Waist × inseam" },
  { type: "shoe", label: "Shoes", hint: "US or EU" },
];

/** Fit family and preferred sizes, pre-selected on product pages. */
export function SizePreferencesForm({
  fitFamily,
  savedSizes,
}: {
  fitFamily: FitFamily | null;
  savedSizes: Sizes;
}) {
  const store = usePreferencesStore((s) => s.set);
  const [fit, setFit] = useState<string>(fitFamily ?? "");
  const [sizes, setSizes] = useState<Sizes>(savedSizes);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setPending(true);
    setStatus(null);
    const savedFit = (fit || null) as FitFamily | null;
    const result = await updateSizePreferencesAction({
      ...(savedFit ? { fitFamily: savedFit } : {}),
      savedSizes: sizes,
    });
    setPending(false);
    if (result.ok) {
      store({ fitFamily: savedFit, savedSizes: sizes });
      setStatus({ tone: "success", text: "Saved. We'll pre-select these on product pages." });
    } else {
      setStatus({ tone: "error", text: result.error.message });
    }
  };

  return (
    <form onSubmit={onSubmit} className="flex max-w-xl flex-col gap-6">
      <Select
        id="pref-fit"
        label="Fit family"
        hint="Where a product comes in several fits, we'll start with this one."
        value={fit}
        onChange={(e) => setFit(e.target.value)}
        options={[
          { value: "", label: "No preference" },
          ...(Object.entries(FIT_LABELS) as Array<[FitFamily, string]>).map(([value, label]) => ({
            value,
            label,
          })),
        ]}
      />
      {SIZE_FIELDS.map(({ type, label, hint }) => (
        <Select
          key={type}
          id={`pref-size-${type}`}
          label={label}
          hint={hint}
          value={sizes[type] ?? ""}
          onChange={(e) =>
            setSizes((current) => {
              const next = { ...current };
              if (e.target.value) next[type] = e.target.value;
              else delete next[type];
              return next;
            })
          }
          options={[
            { value: "", label: "No preference" },
            ...SIZE_RUNS[type].flatMap((run) =>
              run.sizes.map((s) => ({ value: s, label: s.replace("x", " × ") })),
            ),
          ]}
        />
      ))}
      {status && <FormMessage tone={status.tone}>{status.text}</FormMessage>}
      <Button type="submit" className="self-start" loading={pending}>
        Save sizes
      </Button>
    </form>
  );
}

/** Marketing email and SMS consent. Order and account emails are always sent. */
export function CommunicationForm({
  marketingEmail,
  marketingSms,
}: {
  marketingEmail: boolean;
  marketingSms: boolean;
}) {
  const [email, setEmail] = useState(marketingEmail);
  const [sms, setSms] = useState(marketingSms);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setPending(true);
    setStatus(null);
    const result = await updateCommunicationAction({ marketingEmail: email, marketingSms: sms });
    setPending(false);
    setStatus(
      result.ok
        ? { tone: "success", text: "Saved." }
        : { tone: "error", text: result.error.message },
    );
  };

  return (
    <form onSubmit={onSubmit} className="flex max-w-xl flex-col gap-6">
      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 text-label">Tell me about new arrivals and offers by</legend>
        <Checkbox
          id="pref-marketing-email"
          label="Email"
          checked={email}
          onChange={(e) => setEmail(e.target.checked)}
        />
        <Checkbox
          id="pref-marketing-sms"
          label="Text message"
          hint="Add a phone number to your account details first."
          checked={sms}
          onChange={(e) => setSms(e.target.checked)}
        />
      </fieldset>
      <p className="text-sm text-ink-soft">
        Order updates, receipts and account emails are always sent.
      </p>
      {status && <FormMessage tone={status.tone}>{status.text}</FormMessage>}
      <Button type="submit" className="self-start" loading={pending}>
        Save preferences
      </Button>
    </form>
  );
}

/** Name and phone on the account. */
export function DetailsForm({
  firstName,
  lastName,
  phone,
  email,
}: {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
}) {
  const [values, setValues] = useState({ firstName, lastName, phone });
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const field = (key: keyof typeof values) => ({
    value: values[key],
    error: errors[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setValues((v) => ({ ...v, [key]: e.target.value })),
  });

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setPending(true);
    setStatus(null);
    setErrors({});
    const result = await updateDetailsAction({
      firstName: values.firstName,
      lastName: values.lastName,
      ...(values.phone.trim() ? { phone: values.phone } : {}),
    });
    setPending(false);
    if (result.ok) {
      setStatus({ tone: "success", text: "Saved." });
      return;
    }
    const fieldErrors = result.error.fieldErrors ?? {};
    setErrors(Object.fromEntries(Object.entries(fieldErrors).map(([k, v]) => [k, v?.[0]])));
    setStatus({ tone: "error", text: result.error.message });
  };

  return (
    <form onSubmit={onSubmit} noValidate className="flex max-w-xl flex-col gap-6">
      <div className="grid gap-6 sm:grid-cols-2">
        <Input
          id="details-first"
          label="First name"
          autoComplete="given-name"
          required
          {...field("firstName")}
        />
        <Input
          id="details-last"
          label="Last name"
          autoComplete="family-name"
          required
          {...field("lastName")}
        />
      </div>
      <Input
        id="details-phone"
        label="Phone (optional)"
        type="tel"
        autoComplete="tel"
        {...field("phone")}
      />
      <p className="text-sm text-ink-soft">
        Signed in as <strong>{email}</strong>.
      </p>
      {status && <FormMessage tone={status.tone}>{status.text}</FormMessage>}
      <Button type="submit" className="self-start" loading={pending}>
        Save details
      </Button>
    </form>
  );
}
