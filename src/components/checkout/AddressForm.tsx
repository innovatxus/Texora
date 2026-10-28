"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { ReactNode } from "react";
import { useForm, useWatch } from "react-hook-form";
import type { z } from "zod";
import { Button, Input, Select } from "@/components/primitives";
import { areaSuggestions } from "@/config/egypt-address";
import { COUNTRY, GOVERNORATES } from "@/config/locale";
import { checkoutAddressSchema, type CheckoutAddress } from "@/lib/orders/checkout-schema";

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
    control,
    formState: { errors, isSubmitting },
  } = useForm<AddressInput, unknown, CheckoutAddress>({
    resolver: zodResolver(checkoutAddressSchema),
    defaultValues: { country: COUNTRY, region: "", ...defaultValues },
    mode: "onBlur",
  });
  const region = useWatch({ control, name: "region" }) ?? "";
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
        label="City or district"
        autoComplete={ac("address-level2")}
        required
        list={`${section}-areas`}
        error={errors.city?.message}
        {...register("city")}
      />
      <datalist id={`${section}-areas`}>
        {areaSuggestions(region).map((area) => (
          <option key={area} value={area} />
        ))}
      </datalist>
      <div className="grid grid-cols-2 gap-5">
        <Select
          id={`${section}-region`}
          label="Governorate"
          autoComplete={ac("address-level1")}
          required
          placeholder="Governorate"
          options={GOVERNORATES.map((g) => ({ value: g.code, label: g.name }))}
          error={errors.region?.message}
          {...register("region")}
        />
        <Input
          id={`${section}-zip`}
          label="Postal code (optional)"
          inputMode="numeric"
          autoComplete={ac("postal-code")}
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
        hint="Egyptian mobile, e.g. 010 1234 5678. For delivery updates only."
        error={errors.phone?.message}
        className="sm:col-span-2"
        {...register("phone")}
      />
      <input type="hidden" value={COUNTRY} {...register("country")} />
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
