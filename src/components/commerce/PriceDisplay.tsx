import { CURRENCY } from "@/config/locale";
import { cva, type VariantProps } from "class-variance-authority";
import { VisuallyHidden } from "@/components/primitives";
import { formatMoney, percentOff } from "@/lib/format/money";
import { cn } from "@/lib/utils/cn";

const priceVariants = cva("inline-flex flex-wrap items-baseline gap-x-2 tabular-nums", {
  variants: {
    size: {
      sm: "text-sm",
      md: "text-base",
      lg: "text-xl",
    },
  },
  defaultVariants: { size: "md" },
});

export interface PriceDisplayProps extends VariantProps<typeof priceVariants> {
  /** Current price in minor units; the low end when `max` is given. */
  price: number;
  /** High end of a price range across variants. */
  max?: number;
  /** Original price when marked down. */
  compareAtPrice?: number;
  /** Show the "30% off" label on sale prices. */
  showPercent?: boolean;
  currency?: string;
  className?: string;
}

/** Regular, sale (with original and % off) or ranged prices. Always tabular figures. */
export function PriceDisplay({
  price,
  max,
  compareAtPrice,
  showPercent = true,
  currency = CURRENCY,
  size,
  className,
}: PriceDisplayProps) {
  const current =
    max !== undefined && max > price
      ? `${formatMoney(price, currency)} – ${formatMoney(max, currency)}`
      : formatMoney(price, currency);
  const onSale = compareAtPrice !== undefined && compareAtPrice > price;
  const pct = onSale ? percentOff(price, compareAtPrice) : 0;

  if (!onSale) {
    return <span className={cn(priceVariants({ size }), "text-ink", className)}>{current}</span>;
  }

  return (
    <span className={cn(priceVariants({ size }), className)}>
      <span className="text-sale">
        <VisuallyHidden>Sale price </VisuallyHidden>
        {current}
      </span>
      <s className="text-ink-subtle">
        <VisuallyHidden>Original price </VisuallyHidden>
        {formatMoney(compareAtPrice, currency)}
      </s>
      {showPercent && pct > 0 && <span className="text-sale">{pct}% off</span>}
    </span>
  );
}
