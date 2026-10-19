"use client";

import { useId, useState, type FormEvent } from "react";
import { CheckIcon } from "@/components/icons";
import { Button, Input } from "@/components/primitives";
import { notifyBackInStock } from "@/lib/catalog/pdp-actions";

/** Shown when a crossed-out size is selected: email me when it's back. */
export function BackInStockForm({
  productId,
  sku,
  size,
}: {
  productId: string;
  sku: string;
  size: string;
}) {
  const id = useId();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "pending" | "done">("idle");

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setState("pending");
    const result = await notifyBackInStock({ email, productId, sku });
    if (result.ok) {
      setState("done");
      return;
    }
    setState("idle");
    setError(result.error.fieldErrors?.email?.[0] ?? result.error.message);
  };

  if (state === "done") {
    return (
      <p role="status" className="flex items-center gap-2 bg-surface-muted p-4 text-sm">
        <CheckIcon /> We&apos;ll email you when size {size.replace("x", " × ")} is back.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="bg-surface-muted p-4">
      <p className="text-sm">
        Size {size.replace("x", " × ")} is out of stock. Get an email when it&apos;s back.
      </p>
      <div className="mt-3 flex items-start gap-2">
        <Input
          id={id}
          label="Email address"
          hideLabel
          type="email"
          autoComplete="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={error ?? undefined}
          className="flex-1"
        />
        <Button type="submit" loading={state === "pending"}>
          Notify me
        </Button>
      </div>
    </form>
  );
}
