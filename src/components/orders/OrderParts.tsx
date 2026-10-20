import { PriceDisplay } from "@/components/commerce/PriceDisplay";
import { ProductImage } from "@/components/commerce/ProductImage";
import { CheckIcon } from "@/components/icons";
import { formatMoney } from "@/lib/format/money";
import { cn } from "@/lib/utils/cn";
import type { Order } from "@/lib/validation";

const dayFormat = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
});

/** Shows waist × inseam sizes ("32x30") with a proper multiplication sign. */
export const formatSize = (size: string) => size.replace("x", " × ");

/** The snapshotted lines of an order. */
export function OrderLineList({ lines, className }: { lines: Order["lines"]; className?: string }) {
  return (
    <ul className={cn("flex flex-col divide-y divide-line border-y border-line", className)}>
      {lines.map((line) => (
        <li key={line.sku} className="flex gap-4 py-5 text-sm">
          <span className="relative aspect-3/4 w-20 shrink-0">
            <ProductImage src={line.imageUrl} alt={line.name} fill sizes="80px" />
          </span>
          <span className="flex flex-1 flex-col gap-1">
            <span className="font-medium">{line.name}</span>
            <span className="text-ink-soft">
              {line.colorName} · Size {formatSize(line.size)} · Qty {line.quantity}
            </span>
            {line.finalSale && <span className="text-xs text-sale">Final sale</span>}
          </span>
          <PriceDisplay size="sm" price={line.lineTotal} showPercent={false} />
        </li>
      ))}
    </ul>
  );
}

/** Subtotal through total, with the redemptions that applied. */
export function OrderTotals({ order }: { order: Pick<Order, "totals" | "payments"> }) {
  const { totals } = order;
  const rows: Array<[string, string]> = [
    ["Subtotal", formatMoney(totals.subtotal)],
    ...(totals.discount > 0
      ? [["Discounts", `−${formatMoney(totals.discount)}`] as [string, string]]
      : []),
    ["Shipping", totals.shipping === 0 ? "Free" : formatMoney(totals.shipping)],
    ["Tax", formatMoney(totals.tax)],
    ...(totals.giftCard > 0
      ? [["Gift card", `−${formatMoney(totals.giftCard)}`] as [string, string]]
      : []),
    ...(totals.rewards > 0
      ? [["Rewards", `−${formatMoney(totals.rewards)}`] as [string, string]]
      : []),
  ];
  return (
    <div className="flex flex-col gap-3 bg-surface p-6 text-sm">
      <dl className="flex flex-col gap-3">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between">
            <dt>{label}</dt>
            <dd className="tabular-nums">{value}</dd>
          </div>
        ))}
        <div className="flex justify-between border-t border-line pt-3 text-base font-medium">
          <dt>Total</dt>
          <dd className="tabular-nums">{formatMoney(totals.total)}</dd>
        </div>
      </dl>
      {order.payments.some((p) => p.provider === "cod") && (
        <p className="text-xs text-ink-soft">Pay by card or cash on delivery.</p>
      )}
    </div>
  );
}

/** A titled postal address. */
export function AddressBlock({
  title,
  address,
}: {
  title: string;
  address: Order["shippingAddress"];
}) {
  return (
    <div className="text-sm">
      <h3 className="text-label">{title}</h3>
      <address className="mt-2 text-ink-soft not-italic">
        {address.firstName} {address.lastName}
        <br />
        {address.line1}
        {address.line2 && (
          <>
            <br />
            {address.line2}
          </>
        )}
        <br />
        {address.city}, {address.region} {address.postalCode}
      </address>
    </div>
  );
}

/** One step of an order or return timeline. */
export interface TimelineStep {
  key: string;
  label: string;
  state: "done" | "current" | "upcoming";
  at?: Date;
}

/**
 * Vertical progress list. Completed steps show a check and their date; the
 * current step is marked with aria-current so screen readers announce it.
 */
export function TrackingTimeline({ steps }: { steps: readonly TimelineStep[] }) {
  return (
    <ol className="flex flex-col">
      {steps.map((step, i) => {
        const last = i === steps.length - 1;
        return (
          <li
            key={step.key}
            aria-current={step.state === "current" ? "step" : undefined}
            className="relative flex gap-4 pb-6 last:pb-0"
          >
            {!last && (
              <span
                aria-hidden
                className={cn(
                  "absolute top-7 bottom-1 left-2.75 w-px",
                  step.state === "done" ? "bg-ink" : "bg-line",
                )}
              />
            )}
            <span
              aria-hidden
              className={cn(
                "relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full border",
                step.state === "done" && "border-ink bg-ink text-canvas",
                step.state === "current" && "border-ink bg-surface",
                step.state === "upcoming" && "border-line bg-surface",
              )}
            >
              {step.state === "done" ? (
                <CheckIcon size={20} className="size-3.5" />
              ) : step.state === "current" ? (
                <span className="size-2 rounded-full bg-ink" />
              ) : null}
            </span>
            <span className="flex flex-col pt-0.5 text-sm">
              <span className={cn(step.state === "upcoming" ? "text-ink-subtle" : "font-medium")}>
                {step.label}
                <span className="sr-only">
                  {step.state === "done"
                    ? " (completed)"
                    : step.state === "current"
                      ? " (current step)"
                      : " (not started)"}
                </span>
              </span>
              {step.at && <span className="text-ink-soft">{dayFormat.format(step.at)}</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
