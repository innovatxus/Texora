"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { selectShopAction } from "@/lib/merchant/actions/shop";

/** Switches the shop being managed; only shown to merchants with more than one shop. */
export function ShopSwitcher({
  shops,
  current,
}: {
  shops: ReadonlyArray<{ id: string; name: string }>;
  current: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-ink-soft">Shop</span>
      <select
        value={current}
        disabled={pending}
        onChange={(e) =>
          startTransition(async () => {
            const result = await selectShopAction({ shopId: e.target.value });
            if (result.ok) router.refresh();
          })
        }
        className="h-11 border border-ink-subtle bg-surface px-2"
      >
        {shops.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </label>
  );
}
