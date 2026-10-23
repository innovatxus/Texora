"use client";

import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { ProductImage } from "@/components/commerce/ProductImage";
import { Button, Checkbox, Radio, RadioGroup, Select, Textarea } from "@/components/primitives";
import { formatMoney } from "@/lib/format/money";
import { submitReturn } from "@/lib/orders/lookup-actions";
import { RETURN_REASONS } from "@/lib/returns/policy";
import { cn } from "@/lib/utils/cn";

export interface ReturnFormLine {
  sku: string;
  name: string;
  detail: string;
  imageUrl: string;
  /** Units that can still be returned (0 = not returnable). */
  available: number;
  blockedBy?: "final_sale" | "already_returned";
  quantity: number;
  lineTotal: number;
}

interface Selection {
  quantity: number;
  reason: string;
  comment: string;
}

/** Mirrors the server's refundEstimate: discounted unit price, rounded down. */
const unitsRefund = (line: ReturnFormLine, quantity: number) =>
  Math.floor((line.lineTotal * quantity) / line.quantity);

/** Return request form: items, quantities and reasons, return method, refund method and estimate. */
export function ReturnForm({
  orderId,
  token,
  lines,
  stores,
}: {
  orderId: string;
  token: string | null;
  lines: ReturnFormLine[];
  stores: Array<{ id: string; name: string; address: string }>;
}) {
  const router = useRouter();
  const id = useId();
  const [selected, setSelected] = useState<Record<string, Selection>>({});
  const [method, setMethod] = useState<"mail" | "store">("mail");
  const [storeId, setStoreId] = useState("");
  const [refundTo, setRefundTo] = useState<"original" | "store_credit">("original");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  const chosen = lines.filter((l) => selected[l.sku]);
  const estimate = chosen.reduce(
    (sum, l) => sum + unitsRefund(l, selected[l.sku]?.quantity ?? 0),
    0,
  );

  const toggle = (line: ReturnFormLine, on: boolean) =>
    setSelected((current) => {
      const next = { ...current };
      if (on) next[line.sku] = { quantity: 1, reason: "", comment: "" };
      else delete next[line.sku];
      return next;
    });

  const update = (sku: string, patch: Partial<Selection>) =>
    setSelected((current) => {
      const existing = current[sku];
      return existing ? { ...current, [sku]: { ...existing, ...patch } } : current;
    });

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (chosen.length === 0) local.lines = "Choose at least one item to return";
    for (const l of chosen) {
      if (!selected[l.sku]?.reason) local[`reason-${l.sku}`] = "Choose a reason";
    }
    if (method === "store" && !storeId) local.storeId = "Choose a store";
    setErrors(local);
    if (Object.keys(local).length > 0) return;

    setPending(true);
    const result = await submitReturn({
      orderId,
      ...(token ? { token } : {}),
      lines: chosen.map((l) => {
        const s = selected[l.sku] as Selection;
        return {
          sku: l.sku,
          quantity: s.quantity,
          reason: s.reason,
          ...(s.comment.trim() ? { comment: s.comment.trim() } : {}),
        };
      }),
      method,
      ...(method === "store" ? { storeId } : {}),
      refundTo,
    });
    if (result.ok) {
      router.push(result.data.href);
      return;
    }
    setPending(false);
    setErrors({ form: result.error.message });
  };

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-12 lg:grid-cols-[1fr_22rem]">
      <div className="flex flex-col gap-10">
        <fieldset aria-describedby={errors.lines ? `${id}-lines-error` : undefined}>
          <legend className="text-label">Which items are you returning?</legend>
          {errors.lines && (
            <p id={`${id}-lines-error`} className="mt-3 text-sm text-sale">
              {errors.lines}
            </p>
          )}
          <ul className="mt-5 flex flex-col divide-y divide-line border-y border-line">
            {lines.map((line) => {
              const selection = selected[line.sku];
              const disabled = line.available === 0;
              return (
                <li key={line.sku} className="flex flex-col gap-4 py-5">
                  <div className="flex gap-4">
                    <span className="relative aspect-3/4 w-16 shrink-0">
                      <ProductImage src={line.imageUrl} alt="" fill sizes="64px" />
                    </span>
                    <div className="flex flex-1 flex-col gap-2 text-sm">
                      <Checkbox
                        label={<span className="font-medium">{line.name}</span>}
                        hint={
                          disabled
                            ? line.blockedBy === "final_sale"
                              ? "Final sale: can't be returned"
                              : "Already returned"
                            : line.detail
                        }
                        checked={Boolean(selection)}
                        disabled={disabled}
                        onChange={(e) => toggle(line, e.target.checked)}
                      />
                    </div>
                  </div>
                  {selection && (
                    <div className="grid gap-4 pl-20 sm:grid-cols-2">
                      <Select
                        label="Quantity"
                        value={String(selection.quantity)}
                        onChange={(e) => update(line.sku, { quantity: Number(e.target.value) })}
                        options={Array.from({ length: line.available }, (_, i) => ({
                          value: String(i + 1),
                          label: String(i + 1),
                        }))}
                      />
                      <Select
                        label="Reason"
                        required
                        placeholder="Choose a reason"
                        value={selection.reason}
                        onChange={(e) => update(line.sku, { reason: e.target.value })}
                        options={RETURN_REASONS}
                        error={errors[`reason-${line.sku}`]}
                      />
                      <Textarea
                        label="Anything else we should know? (optional)"
                        rows={2}
                        maxLength={500}
                        value={selection.comment}
                        onChange={(e) => update(line.sku, { comment: e.target.value })}
                        className="sm:col-span-2"
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </fieldset>

        <RadioGroup legend="How would you like to return them?">
          <Radio
            name={`${id}-method`}
            label="Courier collection, free"
            hint="A courier collects the parcel from your delivery address. We'll give you a QR code to show them."
            checked={method === "mail"}
            onChange={() => setMethod("mail")}
          />
          <Radio
            name={`${id}-method`}
            label="Drop off in store"
            hint="Bring the items and your QR code to the store you choose."
            checked={method === "store"}
            onChange={() => setMethod("store")}
          />
        </RadioGroup>
        {method === "store" && (
          <Select
            label="Store"
            required
            placeholder="Choose a store"
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
            options={stores.map((s) => ({ value: s.id, label: `${s.name}, ${s.address}` }))}
            error={errors.storeId}
            className="max-w-md"
          />
        )}

        <RadioGroup legend="How would you like your refund?">
          <Radio
            name={`${id}-refund`}
            label="To my original payment method"
            checked={refundTo === "original"}
            onChange={() => setRefundTo("original")}
          />
          <Radio
            name={`${id}-refund`}
            label="As store credit"
            hint="Arrives as soon as we receive your return, ready for your next order."
            checked={refundTo === "store_credit"}
            onChange={() => setRefundTo("store_credit")}
          />
        </RadioGroup>
      </div>

      <aside className="flex flex-col gap-4 self-start bg-surface p-6 text-sm lg:sticky lg:top-24">
        <h2 className="text-label">Summary</h2>
        <p className={cn(chosen.length === 0 && "text-ink-soft")}>
          {chosen.length === 0
            ? "No items chosen yet"
            : `${chosen.reduce((n, l) => n + (selected[l.sku]?.quantity ?? 0), 0)} item(s) to return`}
        </p>
        <div className="flex justify-between border-t border-line pt-3 text-base font-medium">
          <span>Estimated refund</span>
          <span className="tabular-nums" aria-live="polite">
            {formatMoney(estimate)}
          </span>
        </div>
        <p className="text-xs text-ink-soft">
          Shipping charges aren&apos;t refunded. We refund within 5 business days of receiving your
          return.
        </p>
        {errors.form && (
          <p role="alert" className="text-sm text-sale">
            {errors.form}
          </p>
        )}
        <Button type="submit" size="lg" loading={pending} fullWidth>
          Confirm return
        </Button>
      </aside>
    </form>
  );
}
