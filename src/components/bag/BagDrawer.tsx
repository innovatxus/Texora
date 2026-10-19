"use client";

import { Drawer } from "@/components/feedback/Drawer";
import { CheckIcon } from "@/components/icons";
import { Button, ButtonLink, Skeleton } from "@/components/primitives";
import { isAvailableLine } from "@/lib/bag/types";
import { formatMoney } from "@/lib/format/money";
import { selectBagCount, useBagStore } from "@/stores/bag";
import { useUiStore } from "@/stores/ui";
import { BagLineItem, FreeShippingProgress } from "./BagParts";
import { useBagPricing } from "./useBagPricing";

/** Slides in on add: confirmation, line items, free-shipping progress, subtotal and next steps. */
export function BagDrawer() {
  const isOpen = useUiStore((s) => s.panel === "bag");
  const setOpen = useUiStore((s) => s.setOpen);
  const close = useUiStore((s) => s.close);
  const lastAdded = useUiStore((s) => s.lastAdded);
  const count = useBagStore(selectBagCount);
  const { bag, empty } = useBagPricing({ enabled: isOpen });
  const lines = bag?.lines.filter(isAvailableLine) ?? [];

  return (
    <Drawer open={isOpen} onOpenChange={(open) => setOpen("bag", open)} title={`Bag (${count})`}>
      <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-4 md:p-6">
        {lastAdded && (
          <p role="status" className="flex items-center gap-2 text-sm text-success">
            <CheckIcon /> {lastAdded.name} added to your bag
          </p>
        )}
        {empty ? (
          <p className="text-ink-soft">Your bag is empty.</p>
        ) : !bag ? (
          <div className="flex flex-col gap-4" aria-busy="true">
            {[0, 1].map((i) => (
              <div key={i} className="flex gap-4">
                <Skeleton shape="product" className="w-20" />
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton shape="text" className="w-3/4" />
                  <Skeleton shape="text" className="w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            <FreeShippingProgress
              remaining={bag.freeShippingRemaining}
              threshold={bag.freeShippingThreshold}
            />
            <ul className="flex flex-col gap-5">
              {lines.map((line) => (
                <li key={line.sku}>
                  <BagLineItem line={line} compact onNavigate={close} />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      <div className="flex flex-col gap-3 border-t border-line p-4 md:p-6">
        {bag && !empty && (
          <p className="flex justify-between text-sm">
            <span>Subtotal</span>
            <span className="tabular-nums">
              {formatMoney(bag.totals.subtotal - bag.totals.discount)}
            </span>
          </p>
        )}
        {!empty && (
          <ButtonLink href="/checkout" onClick={close} fullWidth>
            Checkout
          </ButtonLink>
        )}
        <ButtonLink href="/bag" onClick={close} variant="secondary" fullWidth>
          View bag ({count})
        </ButtonLink>
        <Button variant="tertiary" onClick={close} className="self-center">
          Continue shopping
        </Button>
      </div>
    </Drawer>
  );
}
