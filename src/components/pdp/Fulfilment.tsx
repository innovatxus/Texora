"use client";

import { useId, useState } from "react";
import { TruckIcon } from "@/components/icons";
import { Select } from "@/components/primitives";
import { deliveryZoneFor, GOVERNORATES, LOCALE, TIME_ZONE } from "@/config/locale";
import { estimateDelivery } from "@/lib/catalog/variant-selection";
import type { DeliveryTerms } from "@/lib/delivery/terms";
import { formatMoney } from "@/lib/format/money";

const dateFormat = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  weekday: "short",
  month: "short",
  day: "numeric",
});

/**
 * Delivery information with an estimate for the shopper's governorate:
 * arrival dates (Fridays skipped, dispatch cutoff) and the zone's prices.
 */
export function Fulfilment({ terms }: { terms: DeliveryTerms | null }) {
  const id = useId();
  const [governorate, setGovernorate] = useState("");
  const zone = governorate ? deliveryZoneFor(governorate) : null;
  const rows = zone
    ? (["standard", "express"] as const).map((method) => {
        const { from, to } = estimateDelivery(method, new Date(), zone);
        const window =
          from.toDateString() === to.toDateString()
            ? dateFormat.format(from)
            : `${dateFormat.format(from)} – ${dateFormat.format(to)}`;
        const price = terms ? ` · ${formatMoney(terms.rates[zone][method])}` : "";
        return { method, text: `${window}${price}` };
      })
    : [];

  return (
    <section aria-labelledby={`${id}-title`} className="border border-line p-4">
      <h2 id={`${id}-title`} className="flex items-center gap-2 text-sm font-medium">
        <TruckIcon /> Delivery
      </h2>
      <p className="mt-1 text-sm text-ink-soft">
        {terms ? `Free standard delivery on orders over ${formatMoney(terms.freeFrom)}. ` : ""}
        Cash on delivery available. Free returns within 15 days.
      </p>
      <div className="mt-3 max-w-xs">
        <Select
          id={`${id}-governorate`}
          label="Governorate for delivery estimate"
          hideLabel
          placeholder="Deliver to…"
          autoComplete="address-level1"
          options={GOVERNORATES.map((g) => ({ value: g.code, label: g.name }))}
          value={governorate}
          onChange={(e) => setGovernorate(e.target.value)}
        />
      </div>
      {rows.length > 0 && (
        <dl aria-live="polite" className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          {rows.map((r) => (
            <div key={r.method} className="contents">
              <dt className="text-ink-soft">{r.method === "standard" ? "Standard" : "Express"}</dt>
              <dd>{r.text}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
