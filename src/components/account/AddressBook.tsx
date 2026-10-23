"use client";

import { cityLine } from "@/config/locale";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AddressForm } from "@/components/checkout/AddressForm";
import { FormMessage } from "@/components/merchant/forms/ErrorSummary";
import { Badge, Button, Checkbox, Input } from "@/components/primitives";
import { deleteAddressAction, saveAddressAction } from "@/lib/account/actions/account";
import type { SavedAddress } from "@/lib/validation/customer";

type Editing = { mode: "new" } | { mode: "edit"; address: SavedAddress } | null;

/** Saved addresses: list, add, edit, remove and choose defaults. */
export function AddressBook({ addresses }: { addresses: SavedAddress[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Editing>(addresses.length === 0 ? { mode: "new" } : null);
  const [status, setStatus] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const current = editing?.mode === "edit" ? editing.address : null;
  const [label, setLabel] = useState("");
  const [defaultShipping, setDefaultShipping] = useState(false);
  const [defaultBilling, setDefaultBilling] = useState(false);

  const open = (next: Editing) => {
    const a = next?.mode === "edit" ? next.address : null;
    setLabel(a?.label ?? "");
    setDefaultShipping(a?.isDefaultShipping ?? false);
    setDefaultBilling(a?.isDefaultBilling ?? false);
    setStatus(null);
    setEditing(next);
  };

  if (editing) {
    return (
      <section aria-labelledby="address-form-title" className="flex max-w-2xl flex-col gap-6">
        <h2 id="address-form-title" className="text-label">
          {current ? "Edit address" : "Add an address"}
        </h2>
        <AddressForm
          section="account"
          defaultValues={
            current
              ? {
                  firstName: current.firstName,
                  lastName: current.lastName,
                  ...(current.company ? { company: current.company } : {}),
                  line1: current.line1,
                  ...(current.line2 ? { line2: current.line2 } : {}),
                  city: current.city,
                  region: current.region,
                  postalCode: current.postalCode,
                  ...(current.phone ? { phone: current.phone } : {}),
                }
              : null
          }
          submitLabel={current ? "Save address" : "Add address"}
          onSubmit={async (address) => {
            setStatus(null);
            const result = await saveAddressAction({
              ...address,
              ...(current ? { id: current.id } : {}),
              ...(label.trim() ? { label: label.trim() } : {}),
              isDefaultShipping: defaultShipping,
              isDefaultBilling: defaultBilling,
            });
            if (!result.ok) {
              setStatus({ tone: "error", text: result.error.message });
              return;
            }
            setEditing(null);
            setStatus({ tone: "success", text: current ? "Address saved." : "Address added." });
            router.refresh();
          }}
          secondaryAction={
            addresses.length > 0 ? (
              <Button type="button" variant="tertiary" onClick={() => open(null)}>
                Cancel
              </Button>
            ) : undefined
          }
        >
          <Input
            id="address-label"
            label="Label (optional)"
            hint="For example Home or Work."
            maxLength={40}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <Checkbox
            id="address-default-shipping"
            label="Use as my default shipping address"
            checked={defaultShipping}
            onChange={(e) => setDefaultShipping(e.target.checked)}
          />
          <Checkbox
            id="address-default-billing"
            label="Use as my default billing address"
            checked={defaultBilling}
            onChange={(e) => setDefaultBilling(e.target.checked)}
          />
        </AddressForm>
        {status && <FormMessage tone={status.tone}>{status.text}</FormMessage>}
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {status && <FormMessage tone={status.tone}>{status.text}</FormMessage>}
      <ul className="grid gap-4 md:grid-cols-2">
        {addresses.map((a) => (
          <li key={a.id} className="flex flex-col gap-3 bg-surface p-5">
            <div className="flex flex-wrap gap-2">
              {a.label && <span className="font-medium">{a.label}</span>}
              {a.isDefaultShipping && <Badge tone="muted">Default shipping</Badge>}
              {a.isDefaultBilling && <Badge tone="muted">Default billing</Badge>}
            </div>
            <address className="text-sm not-italic">
              {a.firstName} {a.lastName}
              <br />
              {a.line1}
              {a.line2 ? `, ${a.line2}` : ""}
              <br />
              {cityLine(a)}
              {a.phone ? (
                <>
                  <br />
                  {a.phone}
                </>
              ) : null}
            </address>
            <div className="mt-auto flex gap-4 text-sm">
              <button
                type="button"
                onClick={() => open({ mode: "edit", address: a })}
                className="min-h-11 underline underline-offset-4"
              >
                Edit<span className="sr-only"> {a.label ?? a.line1}</span>
              </button>
              <button
                type="button"
                disabled={busy === a.id}
                onClick={async () => {
                  setBusy(a.id);
                  const result = await deleteAddressAction({ id: a.id });
                  setBusy(null);
                  setStatus(
                    result.ok
                      ? { tone: "success", text: "Address removed." }
                      : { tone: "error", text: result.error.message },
                  );
                  router.refresh();
                }}
                className="min-h-11 underline underline-offset-4 disabled:opacity-60"
              >
                Remove<span className="sr-only"> {a.label ?? a.line1}</span>
              </button>
            </div>
          </li>
        ))}
      </ul>
      <Button
        type="button"
        variant="secondary"
        className="self-start"
        onClick={() => open({ mode: "new" })}
      >
        Add an address
      </Button>
    </div>
  );
}
