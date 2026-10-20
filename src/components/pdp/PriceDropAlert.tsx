"use client";

import { useId, useState, type FormEvent } from "react";
import { CheckIcon } from "@/components/icons";
import { Button, Input } from "@/components/primitives";
import { notifyPriceDrop } from "@/lib/catalog/pdp-actions";

/** "Email me if the price drops": a disclosure that reveals a one-field form. */
export function PriceDropAlert({ productId }: { productId: string }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "pending" | "done">("idle");

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setState("pending");
    const result = await notifyPriceDrop({ email, productId });
    if (result.ok) {
      setState("done");
      return;
    }
    setState("idle");
    setError(result.error.fieldErrors?.email?.[0] ?? result.error.message);
  };

  if (state === "done") {
    return (
      <p role="status" className="flex items-center gap-2 text-sm">
        <CheckIcon /> We&apos;ll email you once if the price drops.
      </p>
    );
  }

  return (
    <div className="text-sm">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`${id}-form`}
        onClick={() => setOpen((v) => !v)}
        className="underline underline-offset-4 hover:text-accent"
      >
        Email me if the price drops
      </button>
      {open && (
        <form
          id={`${id}-form`}
          onSubmit={onSubmit}
          noValidate
          className="mt-3 flex items-start gap-2"
        >
          <Input
            id={`${id}-email`}
            label="Email for price alert"
            hideLabel
            type="email"
            autoComplete="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={error ?? undefined}
            className="flex-1"
          />
          <Button type="submit" variant="secondary" loading={state === "pending"}>
            Alert me
          </Button>
        </form>
      )}
    </div>
  );
}
