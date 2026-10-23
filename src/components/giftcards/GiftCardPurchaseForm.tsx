"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { CHECKOUT_URL_KEY } from "@/components/checkout/PendingCardPayment";
import { Button, Input, Radio, RadioGroup, Textarea } from "@/components/primitives";
import { brand } from "@/config/brand";
import { writeStorage } from "@/lib/browser/storage";
import { formatMoney } from "@/lib/format/money";
import { startGiftCardPurchase } from "@/lib/giftcards/actions";
import { addDays, businessDate, GIFT_CARD_PRESETS } from "@/lib/giftcards/codes";
import { giftCardPurchaseFormSchema } from "@/lib/giftcards/schema";
import { cn } from "@/lib/utils/cn";

const newKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

type Errors = Partial<Record<string, string>>;

/** E-gift card: amount, recipient, message and delivery date, then card payment. */
export function GiftCardPurchaseForm({ available }: { available: boolean }) {
  const id = useId();
  const [preset, setPreset] = useState<number | "custom">(GIFT_CARD_PRESETS[1]);
  const [custom, setCustom] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [senderName, setSenderName] = useState("");
  const [purchaserEmail, setPurchaserEmail] = useState("");
  const [message, setMessage] = useState("");
  const [when, setWhen] = useState<"today" | "later">("today");
  const [date, setDate] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [pending, setPending] = useState(false);
  // One key per form instance, made on first submit: a double submit reuses the same purchase.
  const idempotencyKey = useRef<string | null>(null);

  const amount = preset === "custom" ? Math.round(Number(custom) * 100) : preset;
  const amountValid = Number.isFinite(amount) && amount > 0;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const today = businessDate(new Date());
    const values = {
      amount: amountValid ? amount : Number.NaN,
      recipientName,
      recipientEmail,
      senderName,
      purchaserEmail,
      ...(message.trim() ? { message } : {}),
      deliverOn: when === "today" ? today : date,
    };
    const parsed = giftCardPurchaseFormSchema.safeParse(values);
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        next[key] ??= issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setPending(true);
    idempotencyKey.current ??= newKey();
    const result = await startGiftCardPurchase({
      ...parsed.data,
      idempotencyKey: idempotencyKey.current,
    });
    if (result.ok) {
      writeStorage("session", CHECKOUT_URL_KEY(result.data.purchaseId), result.data.checkoutUrl);
      window.location.assign(result.data.checkoutUrl);
      return;
    }
    setPending(false);
    setErrors({ form: result.error.message });
  };

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-12 lg:grid-cols-[1fr_22rem]">
      <div className="flex flex-col gap-10">
        <RadioGroup legend="Amount" orientation="horizontal" error={errors.amount}>
          {GIFT_CARD_PRESETS.map((value) => (
            <label
              key={value}
              className={cn(
                "flex h-12 min-w-20 cursor-pointer items-center justify-center border px-4 text-sm tabular-nums",
                "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink",
                preset === value
                  ? "border-ink bg-ink text-canvas"
                  : "border-ink-subtle hover:border-ink",
              )}
            >
              <input
                type="radio"
                name={`${id}-amount`}
                className="sr-only"
                checked={preset === value}
                onChange={() => setPreset(value)}
              />
              {formatMoney(value)}
            </label>
          ))}
          <label
            className={cn(
              "flex h-12 cursor-pointer items-center justify-center border px-4 text-sm",
              "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink",
              preset === "custom"
                ? "border-ink bg-ink text-canvas"
                : "border-ink-subtle hover:border-ink",
            )}
          >
            <input
              type="radio"
              name={`${id}-amount`}
              className="sr-only"
              checked={preset === "custom"}
              onChange={() => setPreset("custom")}
            />
            Other amount
          </label>
        </RadioGroup>
        {preset === "custom" && (
          <Input
            id={`${id}-custom`}
            label="Amount in dollars"
            hint="From EGP 250 to EGP 25,000"
            inputMode="numeric"
            value={custom}
            onChange={(e) => setCustom(e.target.value.replace(/[^\d.]/g, ""))}
            className="max-w-48"
          />
        )}

        <fieldset className="grid gap-5 sm:grid-cols-2">
          <legend className="mb-4 text-label">Who is it for?</legend>
          <Input
            id={`${id}-recipient-name`}
            label="Recipient's name"
            required
            autoComplete="off"
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
            error={errors.recipientName}
          />
          <Input
            id={`${id}-recipient-email`}
            label="Recipient's email"
            type="email"
            required
            autoComplete="off"
            value={recipientEmail}
            onChange={(e) => setRecipientEmail(e.target.value)}
            error={errors.recipientEmail}
          />
          <Textarea
            id={`${id}-message`}
            label="Message (optional)"
            rows={3}
            maxLength={300}
            showCount
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            error={errors.message}
            className="sm:col-span-2"
          />
        </fieldset>

        <fieldset className="grid gap-5 sm:grid-cols-2">
          <legend className="mb-4 text-label">From</legend>
          <Input
            id={`${id}-sender`}
            label="Your name"
            required
            autoComplete="name"
            value={senderName}
            onChange={(e) => setSenderName(e.target.value)}
            error={errors.senderName}
          />
          <Input
            id={`${id}-email`}
            label="Your email"
            type="email"
            required
            autoComplete="email"
            hint="For your receipt."
            value={purchaserEmail}
            onChange={(e) => setPurchaserEmail(e.target.value)}
            error={errors.purchaserEmail}
          />
        </fieldset>

        <RadioGroup legend="When should we send it?" error={errors.deliverOn}>
          <Radio
            name={`${id}-when`}
            label="Today, once payment is confirmed"
            checked={when === "today"}
            onChange={() => setWhen("today")}
          />
          <Radio
            name={`${id}-when`}
            label="On a date I choose"
            checked={when === "later"}
            onChange={() => setWhen("later")}
          />
        </RadioGroup>
        {when === "later" && (
          <Input
            id={`${id}-date`}
            label="Delivery date"
            type="date"
            min={addDays(businessDate(new Date()), 1)}
            max={addDays(businessDate(new Date()), 365)}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="max-w-56"
          />
        )}
      </div>

      <aside className="flex flex-col gap-5 self-start lg:sticky lg:top-24">
        <div
          aria-hidden
          className="flex aspect-[1.586] flex-col justify-between bg-ink p-6 text-canvas"
        >
          <span className="font-display text-xl tracking-[0.28em] text-brand uppercase">
            {brand.name}
          </span>
          <span>
            <span className="block text-sm opacity-80">
              {recipientName ? `For ${recipientName}` : "E-gift card"}
            </span>
            <span className="font-display text-4xl tabular-nums">
              {amountValid ? formatMoney(amount) : "$–"}
            </span>
          </span>
        </div>
        {!available && (
          <p className="bg-surface-muted p-4 text-sm">
            E-gift cards are paid by card, and card payments are unavailable right now. Please try
            again later.
          </p>
        )}
        {errors.form && (
          <p role="alert" className="text-sm text-sale">
            {errors.form}
          </p>
        )}
        <Button type="submit" size="lg" fullWidth loading={pending} disabled={!available}>
          Continue to payment
        </Button>
        <p className="text-xs text-ink-soft">
          Valid for five years. Can be used online across as many orders as you like.
        </p>
      </aside>
    </form>
  );
}
