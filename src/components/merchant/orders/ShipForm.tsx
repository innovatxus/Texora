"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { FormMessage } from "@/components/merchant/forms/ErrorSummary";
import { Button, Input, Select } from "@/components/primitives";
import { CARRIERS } from "@/config/merchant";
import { markShippedAction } from "@/lib/merchant/actions/orders";

/** "Mark shipped": carrier and tracking number for the merchant's items in this order. */
export function ShipForm({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [carrier, setCarrier] = useState<string>(CARRIERS[0]);
  const [tracking, setTracking] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    setFieldError(undefined);
    const result = await markShippedAction({ orderId, carrier, trackingNumber: tracking });
    setPending(false);
    if (result.ok) {
      setDone(true);
      router.refresh();
      return;
    }
    const message = result.error.fieldErrors?.trackingNumber?.[0];
    if (message) setFieldError(message);
    else setError(result.error.message);
  };

  if (done) {
    return <FormMessage tone="success">Marked as shipped. We emailed the customer.</FormMessage>;
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4" aria-label="Mark shipped">
      <Select
        id="ship-carrier"
        label="Carrier"
        options={CARRIERS.map((c) => ({ value: c, label: c }))}
        value={carrier}
        onChange={(e) => setCarrier(e.target.value)}
      />
      <Input
        id="ship-tracking"
        label="Tracking number"
        required
        autoComplete="off"
        value={tracking}
        onChange={(e) => setTracking(e.target.value)}
        error={fieldError}
      />
      {error && <FormMessage>{error}</FormMessage>}
      <Button type="submit" loading={pending} className="self-start">
        Mark shipped
      </Button>
    </form>
  );
}
