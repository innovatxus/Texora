"use client";

import NextLink from "next/link";
import { useId, useState, type FormEvent, type ReactNode } from "react";
import { QuantityStepper } from "@/components/commerce/Pickers";
import { PriceDisplay } from "@/components/commerce/PriceDisplay";
import { ProductImage } from "@/components/commerce/ProductImage";
import { CheckIcon, CloseIcon } from "@/components/icons";
import { Button, Input, Select, Spinner } from "@/components/primitives";
import { getVariantOptions } from "@/lib/bag/actions";
import type { BagLineView, BagView } from "@/lib/bag/types";
import { formatMoney } from "@/lib/format/money";
import { cn } from "@/lib/utils/cn";
import { useBagStore } from "@/stores/bag";
import { useWishlistStore } from "@/stores/wishlist";

/** Progress bar and message showing how far the bag is from free shipping. */
export function FreeShippingProgress({
  remaining,
  threshold,
}: {
  remaining: number;
  threshold: number;
}) {
  const reached = remaining <= 0;
  const pct = Math.min(100, ((threshold - remaining) / threshold) * 100);
  return (
    <div>
      <p className="text-sm" aria-live="polite">
        {reached ? (
          <span className="flex items-center gap-2 text-success">
            <CheckIcon /> You&apos;ve unlocked free standard shipping
          </span>
        ) : (
          <>
            You&apos;re <strong className="tabular-nums">{formatMoney(remaining)}</strong> away from
            free standard shipping
          </>
        )}
      </p>
      <div
        role="progressbar"
        aria-label="Progress to free shipping"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        className="mt-2 h-1 bg-line"
      >
        <div
          className={cn(
            "h-full transition-[width] duration-slow ease-atelier",
            reached ? "bg-success" : "bg-ink",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

type VariantOption = {
  sku: string;
  color: string;
  colorName: string;
  size: string;
  inStock: boolean;
};

/** One bag line: details, inline size/colour/quantity edits and line actions. */
export function BagLineItem({
  line,
  compact = false,
  onNavigate,
}: {
  line: BagLineView;
  compact?: boolean;
  onNavigate?: () => void;
}) {
  const id = useId();
  const setQuantity = useBagStore((s) => s.setQuantity);
  const replaceSku = useBagStore((s) => s.replaceSku);
  const remove = useBagStore((s) => s.remove);
  const saveForLater = useBagStore((s) => s.saveForLater);
  const toggleWishlist = useWishlistStore((s) => s.toggle);
  const [options, setOptions] = useState<VariantOption[] | null>(null);
  const [editing, setEditing] = useState(false);

  const startEditing = async () => {
    setEditing(true);
    if (options) return;
    const result = await getVariantOptions({
      productId: line.productId,
      fitFamily: line.fitFamily,
    });
    setOptions(result.ok ? result.data : []);
  };

  const colours = options ? [...new Map(options.map((o) => [o.color, o.colorName])).entries()] : [];
  const sizes = options?.filter((o) => o.color === line.colorCode) ?? [];
  const href = `/product/${line.slug}?color=${line.colorCode}`;

  return (
    <article className="flex gap-4" aria-label={line.name}>
      <NextLink
        href={href}
        onClick={onNavigate}
        className={cn(
          "relative block shrink-0",
          compact ? "aspect-3/4 w-20" : "aspect-3/4 w-28 sm:w-32",
        )}
      >
        <ProductImage src={line.image} alt={line.name} fill sizes="128px" />
      </NextLink>
      <div className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
        <div className="flex items-start justify-between gap-3">
          <NextLink href={href} onClick={onNavigate} className="font-medium hover:underline">
            {line.name}
          </NextLink>
          <div className="text-right">
            <PriceDisplay
              size="sm"
              price={line.lineTotal ?? line.unitPrice * line.quantity}
              showPercent={false}
            />
            {(line.discount ?? 0) > 0 && (
              <p className="text-xs text-sale tabular-nums">
                −{formatMoney(line.discount ?? 0)} promotion
              </p>
            )}
          </div>
        </div>
        <p className="text-ink-soft">
          {line.colorName} · Size {line.size.replace("x", " × ")}
          {line.fitFamily !== "regular" && (
            <> · {line.fitFamily.charAt(0).toUpperCase() + line.fitFamily.slice(1)}</>
          )}
        </p>
        <PriceDisplay
          size="sm"
          price={line.unitPrice}
          compareAtPrice={line.compareAtPrice}
          className="text-ink-soft"
        />
        {line.finalSale && <p className="text-xs text-sale">Final sale</p>}
        {line.issue === "out_of_stock" && (
          <p role="alert" className="text-sale">
            This size is now out of stock. Choose another size or remove it.
          </p>
        )}
        {line.issue === "quantity_reduced" && (
          <p role="status" className="text-warning">
            Only {line.available} available, so we&apos;ve updated the quantity.
          </p>
        )}

        {!compact && editing && (
          <div className="mt-2 flex flex-wrap gap-3">
            {!options ? (
              <Spinner className="text-ink-subtle" />
            ) : (
              <>
                <Select
                  label="Colour"
                  size="md"
                  value={line.colorCode}
                  options={colours.map(([value, label]) => ({ value, label }))}
                  onChange={(e) => {
                    const match =
                      options.find(
                        (o) => o.color === e.target.value && o.size === line.size && o.inStock,
                      ) ?? options.find((o) => o.color === e.target.value && o.inStock);
                    if (match) replaceSku(line.sku, { sku: match.sku, productId: line.productId });
                  }}
                  className="w-40"
                />
                <Select
                  label="Size"
                  size="md"
                  value={line.size}
                  options={sizes.map((o) => ({
                    value: o.size,
                    label: `${o.size.replace("x", " × ")}${o.inStock ? "" : " (sold out)"}`,
                    disabled: !o.inStock,
                  }))}
                  onChange={(e) => {
                    const match = sizes.find((o) => o.size === e.target.value);
                    if (match) replaceSku(line.sku, { sku: match.sku, productId: line.productId });
                  }}
                  className="w-32"
                />
              </>
            )}
          </div>
        )}

        <div className={cn("mt-2 flex flex-wrap items-end gap-x-4 gap-y-2", compact && "mt-1")}>
          {compact ? (
            <span className="text-ink-soft">Qty {line.quantity}</span>
          ) : (
            <QuantityStepper
              label={`Quantity for ${line.name}`}
              value={line.quantity}
              max={Math.max(1, Math.min(10, line.available))}
              onChange={(q) => setQuantity(line.sku, q)}
            />
          )}
          {!compact && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 pb-3 text-xs">
              {!editing && (
                <button
                  type="button"
                  onClick={startEditing}
                  className="underline underline-offset-4"
                  aria-describedby={id}
                >
                  Edit
                </button>
              )}
              <button
                type="button"
                onClick={() => saveForLater(line.sku)}
                className="underline underline-offset-4"
              >
                Save for later
              </button>
              <button
                type="button"
                onClick={() => {
                  toggleWishlist({
                    productId: line.productId,
                    color: line.colorCode,
                    priceAtAdd: line.unitPrice,
                  });
                  remove(line.sku);
                }}
                className="underline underline-offset-4"
              >
                Move to wishlist
              </button>
              <button
                type="button"
                onClick={() => remove(line.sku)}
                className="underline underline-offset-4"
              >
                Remove
              </button>
              <span id={id} className="sr-only">
                {line.name}
              </span>
            </div>
          )}
        </div>
      </div>
      {compact && (
        <button
          type="button"
          onClick={() => remove(line.sku)}
          aria-label={`Remove ${line.name}`}
          className="self-start p-1 text-ink-soft hover:text-ink"
        >
          <CloseIcon size={20} className="size-4" />
        </button>
      )}
    </article>
  );
}

function SummaryRow({
  label,
  value,
  tone,
}: {
  label: ReactNode;
  value: ReactNode;
  tone?: "sale" | "strong";
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-4",
        tone === "strong" && "border-t border-line pt-3 text-base font-medium",
      )}
    >
      <dt className={tone === "sale" ? "text-sale" : undefined}>{label}</dt>
      <dd className={cn("tabular-nums", tone === "sale" && "text-sale")}>{value}</dd>
    </div>
  );
}

/** Subtotal, each promotion, shipping, tax, redemptions and total. */
export function OrderSummary({
  bag,
  shippingLabel = "Shipping",
  children,
}: {
  bag: BagView;
  shippingLabel?: string;
  children?: ReactNode;
}) {
  const { totals } = bag;
  return (
    <section aria-labelledby="summary-title" className="bg-surface p-5 md:p-6">
      <h2 id="summary-title" className="text-label">
        Order summary
      </h2>
      <dl className="mt-5 flex flex-col gap-3 text-sm">
        <SummaryRow
          label={`Subtotal (${bag.itemCount} ${bag.itemCount === 1 ? "item" : "items"})`}
          value={formatMoney(totals.subtotal)}
        />
        {bag.applied
          .filter((a) => a.amount > 0)
          .map((a) => (
            <SummaryRow
              key={a.id}
              label={a.code ? `${a.name} (${a.code})` : a.name}
              value={`−${formatMoney(a.amount)}`}
              tone="sale"
            />
          ))}
        <SummaryRow
          label={shippingLabel}
          value={totals.shipping === 0 ? "Free" : formatMoney(totals.shipping)}
        />
        <SummaryRow
          label={bag.taxEstimated ? "Estimated tax" : "Tax"}
          value={formatMoney(totals.tax)}
        />
        {totals.giftCard > 0 && (
          <SummaryRow label="Gift card" value={`−${formatMoney(totals.giftCard)}`} />
        )}
        {totals.rewards > 0 && (
          <SummaryRow label="Rewards" value={`−${formatMoney(totals.rewards)}`} />
        )}
        <SummaryRow label="Total" value={formatMoney(totals.total)} tone="strong" />
      </dl>
      {children && <div className="mt-6 flex flex-col gap-3">{children}</div>}
    </section>
  );
}

/** Promo code entry with applied and rejected codes listed below. */
export function PromoCodeField({ bag }: { bag: BagView | null }) {
  const id = useId();
  const add = useBagStore((s) => s.addPromoCode);
  const remove = useBagStore((s) => s.removePromoCode);
  const [value, setValue] = useState("");
  const codes = bag?.codes ?? [];

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (value.trim()) add(value);
    setValue("");
  };

  return (
    <div>
      <form onSubmit={onSubmit} className="flex items-start gap-2">
        <Input
          id={id}
          label="Promo code"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoComplete="off"
          className="flex-1"
        />
        <Button type="submit" variant="secondary" className="mt-7">
          Apply
        </Button>
      </form>
      {codes.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2" aria-live="polite">
          {codes.map((c) => (
            <li
              key={c.code}
              className={cn(
                "flex items-center justify-between gap-3 text-sm",
                c.status === "applied" ? "text-success" : "text-sale",
              )}
            >
              <span className="flex items-center gap-2">
                {c.status === "applied" && <CheckIcon />}
                <strong>{c.code}</strong> {c.message}
              </span>
              <button
                type="button"
                onClick={() => remove(c.code)}
                aria-label={`Remove code ${c.code}`}
                className="text-ink-soft hover:text-ink"
              >
                <CloseIcon size={20} className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Gift card entry and, for members, a choice of rewards to apply. */
export function Redemptions({ bag }: { bag: BagView | null }) {
  const id = useId();
  const giftCardCode = useBagStore((s) => s.giftCardCode);
  const setGiftCardCode = useBagStore((s) => s.setGiftCardCode);
  const rewardsValue = useBagStore((s) => s.rewardsValue);
  const setRewardsValue = useBagStore((s) => s.setRewardsValue);
  const [value, setValue] = useState("");

  return (
    <div className="flex flex-col gap-5">
      {giftCardCode && bag?.giftCard ? (
        <div className="flex items-center justify-between gap-3 text-sm">
          {bag.giftCard.status === "applied" ? (
            <span className="text-success">
              Gift card ending {bag.giftCard.last4}: {formatMoney(bag.giftCard.applied)} applied (
              {formatMoney(bag.giftCard.balance)} balance)
            </span>
          ) : (
            <span role="alert" className="text-sale">
              {bag.giftCard.message}
            </span>
          )}
          <button
            type="button"
            onClick={() => setGiftCardCode(null)}
            className="text-xs underline underline-offset-4"
          >
            Remove
          </button>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (value.trim()) setGiftCardCode(value.trim());
            setValue("");
          }}
          className="flex items-start gap-2"
        >
          <Input
            id={id}
            label="Gift card number"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoComplete="off"
            className="flex-1"
          />
          <Button type="submit" variant="secondary" className="mt-7">
            Apply
          </Button>
        </form>
      )}

      {bag?.rewards && (
        <Select
          label={`Use rewards (${bag.rewards.points.toLocaleString("en-US")} points)`}
          value={String(rewardsValue)}
          onChange={(e) => setRewardsValue(Number(e.target.value))}
          options={[
            { value: "0", label: "Don't use rewards" },
            ...bag.rewards.options.map((v) => ({
              value: String(v),
              label: `${formatMoney(v)} (${v} points)`,
            })),
          ]}
          hint={
            bag.rewards.options.length === 0
              ? "Earn 500 points to unlock your first $5 reward."
              : undefined
          }
        />
      )}
    </div>
  );
}
