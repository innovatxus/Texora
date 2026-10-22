"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { ReactNode } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { Button, Input, Select } from "@/components/primitives";
import { checkoutAddressSchema, type CheckoutAddress } from "@/lib/orders/checkout-schema";

const STATES = [
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "DC",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
];

type AddressInput = z.input<typeof checkoutAddressSchema>;

interface AddressFormProps {
  /** Prefix for field ids and browser autofill sections ("account" autofills as shipping). */
  section: "shipping" | "billing" | "account";
  defaultValues?: Partial<CheckoutAddress> | null;
  submitLabel: string;
  onSubmit: (address: CheckoutAddress) => void | Promise<void>;
  /** Extra fields shown above the button (e.g. a label and default choices). */
  children?: ReactNode;
  /** Shown next to the submit button (e.g. Cancel). */
  secondaryAction?: ReactNode;
}

/**
 * Address form shared by shipping and billing. Validation uses the same Zod
 * schema the server enforces; fields carry autofill tokens for one-tap fill.
 */
export function AddressForm({
  section,
  defaultValues,
  submitLabel,
  onSubmit,
  children,
  secondaryAction,
}: AddressFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AddressInput, unknown, CheckoutAddress>({
    resolver: zodResolver(checkoutAddressSchema),
    defaultValues: { country: "US", region: "", ...defaultValues },
    mode: "onBlur",
  });
  const autofill = section === "account" ? "shipping" : section;
  const ac = (token: string) => `section-${section} ${autofill} ${token}`;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-5 sm:grid-cols-2">
      <Input
        id={`${section}-first`}
        label="First name"
        autoComplete={ac("given-name")}
        required
        error={errors.firstName?.message}
        {...register("firstName")}
      />
      <Input
        id={`${section}-last`}
        label="Last name"
        autoComplete={ac("family-name")}
        required
        error={errors.lastName?.message}
        {...register("lastName")}
      />
      <Input
        id={`${section}-line1`}
        label="Address"
        autoComplete={ac("address-line1")}
        required
        error={errors.line1?.message}
        className="sm:col-span-2"
        {...register("line1")}
      />
      <Input
        id={`${section}-line2`}
        label="Apartment, suite, etc. (optional)"
        autoComplete={ac("address-line2")}
        error={errors.line2?.message}
        className="sm:col-span-2"
        {...register("line2")}
      />
      <Input
        id={`${section}-city`}
        label="City"
        autoComplete={ac("address-level2")}
        required
        error={errors.city?.message}
        {...register("city")}
      />
      <div className="grid grid-cols-2 gap-5">
        <Select
          id={`${section}-region`}
          label="State"
          autoComplete={ac("address-level1")}
          required
          placeholder="State"
          options={STATES.map((s) => ({ value: s, label: s }))}
          error={errors.region?.message}
          {...register("region")}
        />
        <Input
          id={`${section}-zip`}
          label="ZIP code"
          inputMode="numeric"
          autoComplete={ac("postal-code")}
          required
          error={errors.postalCode?.message}
          {...register("postalCode")}
        />
      </div>
      <Input
        id={`${section}-phone`}
        label="Phone"
        type="tel"
        autoComplete={ac("tel")}
        required
        hint="For delivery updates only."
        error={errors.phone?.message}
        className="sm:col-span-2"
        {...register("phone")}
      />
      <input type="hidden" value="US" {...register("country")} />
      {children && <div className="flex flex-col gap-4 sm:col-span-2">{children}</div>}
      <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
        <Button type="submit" size="lg" loading={isSubmitting}>
          {submitLabel}
        </Button>
        {secondaryAction}
      </div>
    </form>
  );
}
