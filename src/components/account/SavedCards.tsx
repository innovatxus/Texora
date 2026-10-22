"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormMessage } from "@/components/merchant/forms/ErrorSummary";
import { removeCardAction } from "@/lib/account/actions/account";
import type { SavedCard } from "@/lib/payments/customers";

const BRANDS: Record<string, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "American Express",
  discover: "Discover",
};

/** Cards saved with the payment provider; remove any of them. */
export function SavedCards({ cards }: { cards: SavedCard[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  return (
    <div className="flex flex-col gap-4">
      <ul className="grid gap-4 md:grid-cols-2">
        {cards.map((card) => {
          const name = `${BRANDS[card.brand] ?? card.brand} ending ${card.last4}`;
          return (
            <li key={card.id} className="flex items-center justify-between gap-4 bg-surface p-5">
              <span>
                <span className="font-medium">{name}</span>
                <span className="block text-sm text-ink-soft">
                  Expires {String(card.expMonth).padStart(2, "0")}/{card.expYear}
                </span>
              </span>
              <button
                type="button"
                disabled={busy === card.id}
                onClick={async () => {
                  setBusy(card.id);
                  const result = await removeCardAction({ id: card.id });
                  setBusy(null);
                  setStatus(
                    result.ok
                      ? { tone: "success", text: `${name} removed.` }
                      : { tone: "error", text: result.error.message },
                  );
                  router.refresh();
                }}
                className="min-h-11 text-sm underline underline-offset-4 disabled:opacity-60"
              >
                Remove<span className="sr-only"> {name}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {status && <FormMessage tone={status.tone}>{status.text}</FormMessage>}
    </div>
  );
}
