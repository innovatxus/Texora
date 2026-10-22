import type { Metadata } from "next";
import { SavedCards } from "@/components/account/SavedCards";
import { getSession } from "@/lib/auth/session";
import { listSavedCards } from "@/lib/payments/customers";
import { cardPaymentsEnabled } from "@/lib/payments/provider";

export const metadata: Metadata = { title: "Payment methods" };

/**
 * Cards saved with the payment provider. Only the provider's token, brand,
 * last four digits and expiry are ever shown; card numbers never reach us.
 */
export default async function Page() {
  const session = await getSession();
  if (!session) return null;
  const enabled = cardPaymentsEnabled();
  const cards = enabled ? await listSavedCards(session.uid) : [];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-4xl">Payment methods</h1>
      {!enabled ? (
        <p className="max-w-prose bg-surface p-6">
          We&apos;re taking cash on delivery for now. When card payments open, you&apos;ll be able
          to save a card at checkout and manage it here.
        </p>
      ) : cards.length === 0 ? (
        <p className="max-w-prose bg-surface p-6">
          No saved cards yet. When you pay by card while signed in, tick &ldquo;Save this
          card&rdquo; and it appears here for one-tap checkout next time.
        </p>
      ) : (
        <SavedCards cards={cards} />
      )}
      <p className="max-w-prose text-sm text-ink-soft">
        Cards are stored securely by our payment provider. We only see the brand, last four digits
        and expiry date.
      </p>
    </div>
  );
}
