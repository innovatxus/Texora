"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormMessage } from "@/components/merchant/forms/ErrorSummary";
import { Button } from "@/components/primitives";
import { setShopOpenAction } from "@/lib/merchant/actions/shop";

/** Close the shop (hidden at once, reopen within 30 days) or reopen it. */
export function ShopOpenToggle({
  shopId,
  closed,
  reopenUntil,
}: {
  shopId: string;
  closed: boolean;
  reopenUntil: string | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = async () => {
    if (
      !closed &&
      !window.confirm(
        "Close your shop? Your products are hidden immediately. You can reopen within 30 days.",
      )
    ) {
      return;
    }
    setPending(true);
    setError(null);
    const result = await setShopOpenAction({ shopId, open: closed });
    setPending(false);
    if (!result.ok) setError(result.error.message);
    else router.refresh();
  };

  return (
    <section
      aria-labelledby="close-title"
      className="flex flex-col items-start gap-3 border-t border-line pt-8"
    >
      <h2 id="close-title" className="font-display text-2xl">
        {closed ? "Reopen your shop" : "Close your shop"}
      </h2>
      <p className="text-sm text-ink-soft">
        {closed
          ? `Your shop is closed. You can reopen it until ${reopenUntil}.`
          : "Closing hides your shop and products from shoppers straight away."}
      </p>
      <Button variant={closed ? "primary" : "secondary"} onClick={toggle} loading={pending}>
        {closed ? "Reopen shop" : "Close shop"}
      </Button>
      {error && <FormMessage>{error}</FormMessage>}
    </section>
  );
}
