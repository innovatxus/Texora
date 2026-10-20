"use client";

import { useState, type FormEvent } from "react";
import { Button, Input } from "@/components/primitives";
import { formatMoney } from "@/lib/format/money";
import { checkGiftCardBalance } from "@/lib/giftcards/actions";

type Balance = {
  last4: string;
  balance: number;
  status: "active" | "redeemed" | "disabled" | "expired";
  expiresAt: string | null;
};

const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
});

export function GiftCardBalanceForm() {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Balance | null>(null);
  const [pending, setPending] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setPending(true);
    setResult(null);
    const response = await checkGiftCardBalance({ code });
    setPending(false);
    if (response.ok) {
      setError(null);
      setResult(response.data);
      return;
    }
    setError(response.error.fieldErrors?.code?.[0] ?? response.error.message);
  };

  return (
    <div className="flex flex-col gap-5">
      <form
        onSubmit={onSubmit}
        noValidate
        className="flex flex-col gap-4 sm:flex-row sm:items-start"
      >
        <Input
          id="gift-card-code"
          label="Gift card number"
          autoComplete="off"
          spellCheck={false}
          placeholder="TXGC-XXXX-XXXX-XXXX"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          error={error ?? undefined}
          className="sm:flex-1"
        />
        <Button type="submit" variant="secondary" loading={pending} className="sm:mt-7">
          Check balance
        </Button>
      </form>
      <div aria-live="polite">
        {result && (
          <div className="bg-surface p-5 text-sm">
            <p className="text-ink-soft">Card ending {result.last4}</p>
            <p className="mt-1 font-display text-4xl tabular-nums">{formatMoney(result.balance)}</p>
            <p className="mt-2 text-ink-soft">
              {result.status === "expired"
                ? "This card has expired."
                : result.status === "redeemed" || result.balance === 0
                  ? "This card has been fully used."
                  : result.expiresAt
                    ? `Available to spend until ${dateFormat.format(new Date(result.expiresAt))}.`
                    : "Available to spend."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
