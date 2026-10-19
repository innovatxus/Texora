"use client";

import { useId, useState, type FormEvent } from "react";
import { TruckIcon } from "@/components/icons";
import { Button, Input } from "@/components/primitives";
import { estimateDelivery, isValidPostcode } from "@/lib/catalog/variant-selection";
import { formatMoney } from "@/lib/format/money";

export const FREE_SHIPPING_THRESHOLD = 15000;

const dateFormat = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
});

/** Shipping information with a ZIP-based delivery estimate (business days, dispatch cutoff). */
export function Fulfilment() {
  const id = useId();
  const [postcode, setPostcode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<{
    standard: [Date, Date];
    express: [Date, Date];
  } | null>(null);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!isValidPostcode(postcode)) {
      setError("Enter a 5-digit ZIP code");
      setEstimate(null);
      return;
    }
    setError(null);
    const now = new Date();
    const s = estimateDelivery("standard", now);
    const x = estimateDelivery("express", now);
    setEstimate({ standard: [s.from, s.to], express: [x.from, x.to] });
  };

  return (
    <section aria-labelledby={`${id}-title`} className="border border-line p-4">
      <h2 id={`${id}-title`} className="flex items-center gap-2 text-sm font-medium">
        <TruckIcon /> Delivery
      </h2>
      <p className="mt-1 text-sm text-ink-soft">
        Free standard shipping on orders over {formatMoney(FREE_SHIPPING_THRESHOLD)}. Free returns
        within 30 days.
      </p>
      <form onSubmit={onSubmit} noValidate className="mt-3 flex items-start gap-2">
        <Input
          id={`${id}-zip`}
          label="ZIP code for delivery estimate"
          hideLabel
          placeholder="ZIP code"
          inputMode="numeric"
          autoComplete="postal-code"
          value={postcode}
          onChange={(e) => setPostcode(e.target.value)}
          error={error ?? undefined}
          className="w-36"
        />
        <Button type="submit" variant="secondary">
          Estimate
        </Button>
      </form>
      {estimate && (
        <dl aria-live="polite" className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-ink-soft">Standard</dt>
          <dd>
            {dateFormat.format(estimate.standard[0])} – {dateFormat.format(estimate.standard[1])}
          </dd>
          <dt className="text-ink-soft">Express</dt>
          <dd>
            {dateFormat.format(estimate.express[0])} – {dateFormat.format(estimate.express[1])}
          </dd>
        </dl>
      )}
    </section>
  );
}
