"use client";

import { useState, type FormEvent } from "react";
import { ErrorSummary, FormMessage } from "@/components/merchant/forms/ErrorSummary";
import { Button, Checkbox, Input, Select } from "@/components/primitives";
import { LOCATION_TYPES } from "@/config/merchant";
import { saveLocationAction } from "@/lib/merchant/actions/shop";
import { TIME_ZONE } from "@/config/locale";
import { areaSuggestions } from "@/config/egypt-address";
import { GOVERNORATE_OPTIONS } from "@/lib/merchant/geo";
import type { LocationType } from "@/config/merchant";
import type { MerchantLocation } from "@/lib/validation/merchant";

const FIELD_IDS: Record<string, string> = {
  name: "loc-name",
  types: "loc-types",
  "address.line1": "loc-line1",
  "address.city": "loc-city",
  "address.region": "loc-region",
  "address.postalCode": "loc-zip",
  phone: "loc-phone",
};

/**
 * Add or edit one location: name, type (retail store and/or ship-from; no
 * pickup, D-071), Egyptian address (governorate; postal code optional),
 * weekly hours, special dates and phone. Egypt has one time zone.
 */
export function LocationForm({
  shopId,
  location,
  onDone,
  onCancel,
}: {
  shopId: string;
  location?: MerchantLocation;
  /** Called after a successful save, with the location's types. */
  onDone: (types: readonly LocationType[]) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(location?.name ?? "");
  const [types, setTypes] = useState<LocationType[]>(location?.types ?? ["ship_from"]);
  const [address, setAddress] = useState({
    line1: location?.address.line1 ?? "",
    line2: location?.address.line2 ?? "",
    city: location?.address.city ?? "",
    region: location?.address.region ?? "",
    postalCode: location?.address.postalCode ?? "",
  });
  const [phone, setPhone] = useState(location?.phone ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const toggleType = (type: LocationType, checked: boolean) =>
    setTypes((current) =>
      checked ? [...new Set([...current, type])] : current.filter((t) => t !== type),
    );

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setFormError(null);
    const result = await saveLocationAction({
      shopId,
      ...(location ? { locationId: location.id } : {}),
      name,
      types,
      address: { ...address, ...(address.line2.trim() ? {} : { line2: undefined }) },
      timezone: location?.timezone ?? TIME_ZONE,
      // Opening hours are no longer collected; saving clears any old ones.
      hours: [],
      specialHours: [],
      phone: phone.trim(),
    });
    setPending(false);
    if (!result.ok) {
      const next: Record<string, string> = {};
      for (const [key, messages] of Object.entries(result.error.fieldErrors ?? {})) {
        if (messages[0] && !next[key]) next[key] = messages[0];
      }
      setErrors(next);
      setFormError(Object.keys(next).length > 0 ? null : result.error.message);
      return;
    }
    onDone(types);
  };

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      aria-label={location ? `Edit ${location.name}` : "New location"}
      className="flex flex-col gap-6 border border-line bg-surface p-4 sm:p-6"
    >
      <ErrorSummary
        errors={Object.entries(errors).map(([key, message]) => ({
          fieldId: FIELD_IDS[key] ?? "loc-name",
          message,
        }))}
      />
      <Input
        id="loc-name"
        label="Location name"
        required
        hint='For example, "Zamalek studio" or "Warehouse".'
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={errors.name}
      />
      <fieldset id="loc-types" tabIndex={-1} className="flex flex-col gap-3">
        <legend className="mb-2 text-sm font-medium">This location is a…</legend>
        {LOCATION_TYPES.map((type) => (
          <Checkbox
            key={type.value}
            label={type.label}
            hint={type.description}
            checked={types.includes(type.value)}
            onChange={(e) => toggleType(type.value, e.target.checked)}
          />
        ))}
        {errors.types && <p className="text-sm text-sale">{errors.types}</p>}
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-medium">Address</legend>
        <Input
          id="loc-line1"
          label="Street address"
          autoComplete="address-line1"
          required
          className="sm:col-span-2"
          value={address.line1}
          onChange={(e) => setAddress((a) => ({ ...a, line1: e.target.value }))}
          error={errors["address.line1"]}
        />
        <Input
          id="loc-line2"
          label="Apartment, suite, floor (optional)"
          autoComplete="address-line2"
          className="sm:col-span-2"
          value={address.line2}
          onChange={(e) => setAddress((a) => ({ ...a, line2: e.target.value }))}
        />
        <Input
          id="loc-city"
          label="City or district"
          autoComplete="address-level2"
          required
          list="loc-areas"
          value={address.city}
          onChange={(e) => setAddress((a) => ({ ...a, city: e.target.value }))}
          error={errors["address.city"]}
        />
        <datalist id="loc-areas">
          {areaSuggestions(address.region).map((area) => (
            <option key={area} value={area} />
          ))}
        </datalist>
        <Select
          id="loc-region"
          label="Governorate"
          required
          placeholder="Choose a governorate"
          autoComplete="address-level1"
          options={GOVERNORATE_OPTIONS}
          value={address.region}
          onChange={(e) => setAddress((a) => ({ ...a, region: e.target.value }))}
          error={errors["address.region"]}
        />
        <Input
          id="loc-zip"
          label="Postal code (optional)"
          autoComplete="postal-code"
          inputMode="numeric"
          value={address.postalCode}
          onChange={(e) => setAddress((a) => ({ ...a, postalCode: e.target.value }))}
          error={errors["address.postalCode"]}
        />
      </fieldset>

      <Input
        id="loc-phone"
        label="Phone (optional)"
        type="tel"
        hint="For example, 010 1234 5678 or 02 2735 0000."
        autoComplete="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        error={errors.phone}
      />

      {formError && <FormMessage>{formError}</FormMessage>}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" loading={pending}>
          {location ? "Save location" : "Add location"}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
