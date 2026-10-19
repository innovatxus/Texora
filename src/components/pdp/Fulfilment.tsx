"use client";

import { useId, useState, type FormEvent } from "react";
import { Modal } from "@/components/feedback/Modal";
import { CheckIcon, StoreIcon, TruckIcon } from "@/components/icons";
import { Button, Input } from "@/components/primitives";
import {
  estimateDelivery,
  isValidPostcode,
  storeAvailability,
  type PdpVariant,
} from "@/lib/catalog/variant-selection";
import { formatMoney } from "@/lib/format/money";
import { cn } from "@/lib/utils/cn";

export const FREE_SHIPPING_THRESHOLD = 15000;

interface StoreInfo {
  id: string;
  name: string;
  city: string;
  services: string[];
}

const dateFormat = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
});

function DeliveryEstimate() {
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
    <div className="mt-3">
      <form onSubmit={onSubmit} noValidate className="flex items-start gap-2">
        <Input
          id={id}
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
    </div>
  );
}

interface FulfilmentProps {
  variant: PdpVariant | undefined;
  stores: readonly StoreInfo[];
  pickupStoreId: string | null;
  onPickupStoreChange: (id: string) => void;
  mode: "ship" | "pickup";
  onModeChange: (mode: "ship" | "pickup") => void;
}

/** Ship to home (with a ZIP-based estimate) or buy online, pick up in store. */
export function Fulfilment({
  variant,
  stores,
  pickupStoreId,
  onPickupStoreChange,
  mode,
  onModeChange,
}: FulfilmentProps) {
  const name = useId();
  const [picking, setPicking] = useState(false);
  const availability = storeAvailability(
    variant,
    stores.map((s) => s.id),
  );
  const pickupStore = stores.find((s) => s.id === pickupStoreId);
  const pickupQty = availability.find((a) => a.storeId === pickupStoreId)?.quantity ?? 0;

  const option = (
    value: "ship" | "pickup",
    icon: React.ReactNode,
    title: string,
    detail: React.ReactNode,
  ) => (
    <label
      className={cn(
        "flex cursor-pointer gap-3 border p-4 transition-colors duration-fast",
        mode === value ? "border-line-strong" : "border-line hover:border-ink-subtle",
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={mode === value}
        onChange={() => onModeChange(value)}
        className="sr-only"
      />
      <span
        aria-hidden
        className={cn(
          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
          mode === value ? "border-[6px] border-ink" : "border-ink-subtle",
        )}
      />
      <span className="flex flex-1 flex-col gap-1 text-sm">
        <span className="flex items-center gap-2 font-medium">
          {icon} {title}
        </span>
        <span className="text-ink-soft">{detail}</span>
      </span>
    </label>
  );

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-3 text-sm font-medium">Delivery</legend>
      {option(
        "ship",
        <TruckIcon />,
        "Ship to an address",
        <>Free standard shipping on orders over {formatMoney(FREE_SHIPPING_THRESHOLD)}.</>,
      )}
      {mode === "ship" && <DeliveryEstimate />}
      {option(
        "pickup",
        <StoreIcon />,
        "Pick up in store",
        pickupStore ? (
          pickupQty > 0 ? (
            <span className="text-success">
              Available at {pickupStore.name}, usually ready in 2 hours
            </span>
          ) : (
            <span>Not available at {pickupStore.name} in this size</span>
          )
        ) : (
          "Free. Choose a store to check availability."
        ),
      )}
      {mode === "pickup" && (
        <Button variant="tertiary" onClick={() => setPicking(true)} className="mt-1 self-start">
          {pickupStore ? "Change store" : "Choose a store"}
        </Button>
      )}

      <Modal
        open={picking}
        onOpenChange={setPicking}
        title="Pick up in store"
        description={
          variant
            ? "Availability for your selected size."
            : "Select a size to see availability in each store."
        }
      >
        <ul className="flex flex-col divide-y divide-line">
          {availability.map(({ storeId, quantity }) => {
            const store = stores.find((s) => s.id === storeId);
            if (!store) return null;
            return (
              <li key={storeId} className="flex items-center justify-between gap-4 py-4">
                <div className="text-sm">
                  <p className="font-medium">{store.name}</p>
                  <p className="text-ink-soft">{store.city}</p>
                  <p
                    className={cn(
                      "mt-1",
                      variant
                        ? quantity > 0
                          ? "text-success"
                          : "text-ink-subtle"
                        : "text-ink-subtle",
                    )}
                  >
                    {variant
                      ? quantity > 0
                        ? `In stock (${quantity})`
                        : "Out of stock"
                      : "Select a size first"}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={storeId === pickupStoreId ? "primary" : "secondary"}
                  disabled={!variant || quantity === 0}
                  onClick={() => {
                    onPickupStoreChange(storeId);
                    setPicking(false);
                  }}
                >
                  {storeId === pickupStoreId ? (
                    <>
                      <CheckIcon /> Selected
                    </>
                  ) : (
                    "Pick up here"
                  )}
                </Button>
              </li>
            );
          })}
        </ul>
      </Modal>
    </fieldset>
  );
}
