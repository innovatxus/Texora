"use client";

import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, type ReactNode } from "react";
import { OrderSummary } from "@/components/bag/BagParts";
import { useBagPricing } from "@/components/bag/useBagPricing";
import { PriceDisplay } from "@/components/commerce/PriceDisplay";
import { ProductImage } from "@/components/commerce/ProductImage";
import { ChevronDownIcon } from "@/components/icons";
import { Skeleton } from "@/components/primitives";
import { isAvailableLine, type BagView } from "@/lib/bag/types";
import { formatMoney } from "@/lib/format/money";
import { cn } from "@/lib/utils/cn";
import { useBagHydrated, useBagStore } from "@/stores/bag";
import {
  firstIncompleteStep,
  useCheckoutHydrated,
  useCheckoutStore,
  type CheckoutStep,
} from "@/stores/checkout";

const STEPS: Array<{ id: Exclude<CheckoutStep, "contact">; label: string; href: string }> = [
  { id: "shipping", label: "Shipping", href: "/checkout/shipping" },
  { id: "delivery", label: "Delivery", href: "/checkout/delivery" },
  { id: "payment", label: "Payment", href: "/checkout/payment" },
  { id: "review", label: "Review", href: "/checkout/review" },
];
const ORDER: CheckoutStep[] = ["contact", "shipping", "delivery", "payment", "review"];

function Stepper({ current, reached }: { current: CheckoutStep; reached: CheckoutStep }) {
  const reachedIndex = ORDER.indexOf(reached);
  return (
    <nav aria-label="Checkout steps">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-label">
        {STEPS.map((step, i) => {
          const index = ORDER.indexOf(step.id);
          const isCurrent = step.id === current;
          const done = index < ORDER.indexOf(current);
          const reachable = index <= reachedIndex && !isCurrent;
          return (
            <li key={step.id} className="flex items-center gap-2">
              {reachable ? (
                <NextLink href={step.href} className="underline-offset-4 hover:underline">
                  {step.label}
                </NextLink>
              ) : (
                <span
                  aria-current={isCurrent ? "step" : undefined}
                  className={cn(
                    isCurrent ? "text-ink" : done ? "text-ink-soft" : "text-ink-subtle",
                  )}
                >
                  {step.label}
                </span>
              )}
              {i < STEPS.length - 1 && (
                <span aria-hidden className="text-ink-subtle">
                  /
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function SummaryLines({ bag }: { bag: BagView }) {
  return (
    <ul className="flex flex-col gap-4 border-b border-line pb-5">
      {bag.lines.filter(isAvailableLine).map((line) => (
        <li key={line.sku} className="flex gap-3 text-sm">
          <span className="relative aspect-3/4 w-16 shrink-0">
            <ProductImage src={line.image} alt={line.name} fill sizes="64px" />
            <span className="absolute -top-2 -right-2 flex size-5 items-center justify-center rounded-full bg-ink text-xs text-surface tabular-nums">
              {line.quantity}
            </span>
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate">{line.name}</span>
            <span className="text-xs text-ink-soft">
              {line.colorName} · {line.size.replace("x", " × ")}
            </span>
          </span>
          <PriceDisplay
            size="sm"
            price={line.lineTotal ?? line.unitPrice * line.quantity}
            showPercent={false}
          />
        </li>
      ))}
    </ul>
  );
}

interface CheckoutFrameProps {
  step: CheckoutStep;
  title: string;
  children: ReactNode;
}

/**
 * Two-column checkout frame: step content left, order summary right (sticky
 * on desktop, collapsible at the top on mobile). Sends shoppers back to the
 * first incomplete step, or to the bag when it's empty.
 */
export function CheckoutFrame({ step, title, children }: CheckoutFrameProps) {
  const router = useRouter();
  const summaryId = useId();
  const [summaryOpen, setSummaryOpen] = useState(false);
  const bagReady = useBagHydrated();
  const checkoutReady = useCheckoutHydrated();
  const lineCount = useBagStore((s) => s.lines.length);
  const state = useCheckoutStore();
  const delivery = state.delivery;
  const { bag } = useBagPricing({
    shippingMethod: delivery?.method ?? "standard",
    region: state.shippingAddress?.region ?? state.billingAddress?.region ?? null,
  });

  const reached = firstIncompleteStep(state);
  const ready = bagReady && checkoutReady;

  useEffect(() => {
    if (!ready) return;
    if (lineCount === 0) {
      router.replace("/bag");
      return;
    }
    if (ORDER.indexOf(step) > ORDER.indexOf(reached)) {
      router.replace(reached === "contact" ? "/checkout" : `/checkout/${reached}`);
    }
  }, [ready, lineCount, step, reached, router]);

  return (
    <div className="container-page pt-6 pb-24 lg:pt-10">
      {/* Mobile summary */}
      <div className="mb-6 border-y border-line lg:hidden">
        <button
          type="button"
          aria-expanded={summaryOpen}
          aria-controls={summaryId}
          onClick={() => setSummaryOpen((o) => !o)}
          className="flex w-full items-center justify-between py-4 text-sm"
        >
          <span className="flex items-center gap-2">
            {summaryOpen ? "Hide" : "Show"} order summary
            <ChevronDownIcon
              size={20}
              className={cn("size-4 transition-transform", summaryOpen && "rotate-180")}
            />
          </span>
          <span className="font-medium tabular-nums">
            {bag ? formatMoney(bag.totals.total) : "…"}
          </span>
        </button>
        <div id={summaryId} hidden={!summaryOpen} className="pb-4">
          {bag && (
            <>
              <SummaryLines bag={bag} />
              <OrderSummary bag={bag} />
            </>
          )}
        </div>
      </div>

      <div className="grid gap-10 lg:grid-cols-[1fr_26rem] lg:gap-16">
        <div>
          {step !== "contact" && <Stepper current={step} reached={reached} />}
          <h1 className="mt-4 font-display text-4xl">{title}</h1>
          <div className="mt-8">{ready ? children : <Skeleton className="h-96" />}</div>
        </div>
        <aside
          className="hidden lg:sticky lg:top-24 lg:block lg:self-start"
          aria-label="Order summary"
        >
          {bag ? (
            <div className="bg-surface p-6">
              <SummaryLines bag={bag} />
              <div className="-mx-6 -mb-6">
                <OrderSummary bag={bag} />
              </div>
            </div>
          ) : (
            <Skeleton className="h-96" />
          )}
        </aside>
      </div>
    </div>
  );
}
