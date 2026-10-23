"use client";

import { CURRENCY } from "@/config/locale";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { primaryBadge } from "@/components/commerce/badges";
import { FitTabs, QuantityStepper, SizePicker, SwatchPicker } from "@/components/commerce/Pickers";
import { PriceDisplay } from "@/components/commerce/PriceDisplay";
import { Rating } from "@/components/commerce/Rating";
import { WishlistButton } from "@/components/commerce/WishlistButton";
import { Badge, Button } from "@/components/primitives";
import type { SizeGuide } from "@/config/size-guides";
import type { SizeType } from "@/lib/validation/common";
import {
  findVariant,
  fitLabel,
  fitsForColor,
  sizeOptions,
  stockMessage,
  type PdpVariant,
} from "@/lib/catalog/variant-selection";
import { useHydrated } from "@/lib/browser/hooks";
import { cn } from "@/lib/utils/cn";
import { dollars, track } from "@/lib/analytics/events";
import { useBagStore } from "@/stores/bag";
import { usePreferencesStore } from "@/stores/preferences";
import { useRecentlyViewedStore } from "@/stores/recentlyViewed";
import { useUiStore } from "@/stores/ui";
import { BackInStockForm } from "./BackInStockForm";
import { PriceDropAlert } from "./PriceDropAlert";
import { Fulfilment } from "./Fulfilment";
import type { DeliveryTerms } from "@/lib/delivery/terms";
import { Gallery } from "./Gallery";
import { SizeGuideModal } from "./SizeGuideModal";

export interface PdpProductView {
  id: string;
  slug: string;
  name: string;
  fitFamilies: string[];
  /** How the product is sized; picks the shopper's saved size for this type. */
  sizeType?: SizeType;
  colors: Array<{
    code: string;
    name: string;
    swatch: string;
    images: Array<{ url: string; alt: string }>;
  }>;
  priceRange: { min: number; max: number; compareAtMin?: number | undefined };
  badges: string[];
  ratingAvg: number;
  ratingCount: number;
  fitScore: number | null;
  finalSale: boolean;
}

interface ProductDetailProps {
  product: PdpProductView;
  variants: PdpVariant[];
  sizeGuide: SizeGuide;
  initialColor: string;
  /** Server-rendered breadcrumbs and the details accordion. */
  breadcrumbs: ReactNode;
  details: ReactNode;
  /** Merchant preview of a draft: everything renders, but nothing can be bought or saved. */
  preview?: boolean;
  /** Delivery prices and the free-delivery threshold from store settings. */
  delivery?: DeliveryTerms | null;
}

/** PDP gallery and buy box: colour, fit and size selection, stock messages, add to bag and alerts. */
export function ProductDetail({
  product,
  variants,
  sizeGuide,
  initialColor,
  breadcrumbs,
  details,
  preview = false,
  delivery = null,
}: ProductDetailProps) {
  const [color, setColor] = useState(initialColor);
  const fits = fitsForColor(variants, color, product.fitFamilies);
  // A signed-in shopper's saved fit and size are the starting point; their own choice wins.
  const preferredFit = usePreferencesStore((s) => s.fitFamily);
  const preferredSize = usePreferencesStore((s) =>
    product.sizeType ? (s.savedSizes[product.sizeType] ?? null) : null,
  );
  const [chosenFit, setFitChoice] = useState<string | null>(null);
  const fitChoice =
    chosenFit ??
    (preferredFit && product.fitFamilies.includes(preferredFit)
      ? preferredFit
      : (product.fitFamilies[0] ?? "regular"));
  const fit = fits.includes(fitChoice) ? fitChoice : (fits[0] ?? fitChoice);
  const [chosenSize, setSize] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [sizeError, setSizeError] = useState<string | undefined>();
  const [showSticky, setShowSticky] = useState(false);
  // True once this boundary has hydrated (it hydrates separately from the root).
  const interactive = useHydrated();
  const addButton = useRef<HTMLButtonElement>(null);
  const sizeGroup = useRef<HTMLDivElement>(null);

  const addToBag = useBagStore((s) => s.add);
  const showAdded = useUiStore((s) => s.showAdded);
  const record = useRecentlyViewedStore((s) => s.record);

  const colorView = product.colors.find((c) => c.code === color) ?? product.colors[0];
  const options = sizeOptions(variants, color, fit);
  const size =
    chosenSize ??
    (preferredSize && options.some((o) => o.size === preferredSize && o.inStock)
      ? preferredSize
      : null);
  const sizeAvailable = size !== null && options.some((o) => o.size === size);
  const variant = findVariant(variants, color, fit, sizeAvailable ? size : null);
  const stock = stockMessage(variant);
  const outOfStock = stock?.kind === "out_of_stock";
  const badge = primaryBadge(
    product.badges,
    product.priceRange.min,
    product.priceRange.compareAtMin,
  );
  const fitSummary = fitLabel(product.fitScore);

  // Remember the visit for "recently viewed", and count it (not for merchant previews).
  useEffect(() => {
    if (!preview) {
      track({
        name: "view_item",
        params: {
          currency: CURRENCY,
          value: dollars(product.priceRange.min),
          items: [
            {
              item_id: product.id,
              item_name: product.name,
              price: dollars(product.priceRange.min),
            },
          ],
        },
      });
    }
    const image = product.colors[0]?.images[0]?.url;
    if (!image) return;
    record({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      image,
      price: product.priceRange.min,
      ...(product.priceRange.compareAtMin
        ? { compareAtPrice: product.priceRange.compareAtMin }
        : {}),
    });
  }, [product, record, preview]);

  // Sticky mobile bar appears when the main button scrolls out of view.
  useEffect(() => {
    const el = addButton.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setShowSticky(!(entry?.isIntersecting ?? true)),
      {
        rootMargin: "0px 0px -40px 0px",
      },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const changeColor = (code: string) => {
    setColor(code);
    // Shareable without a server round trip; useSearchParams stays in sync.
    window.history.replaceState(null, "", `?color=${encodeURIComponent(code)}`);
  };

  const onAdd = () => {
    if (!sizeAvailable || !variant) {
      setSizeError("Select a size to add this to your bag");
      sizeGroup.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      sizeGroup.current?.querySelector<HTMLInputElement>("input")?.focus({ preventScroll: true });
      return;
    }
    if (outOfStock) return;
    addToBag({ sku: variant.sku, productId: product.id, quantity });
    if (!preview) {
      track({
        name: "add_to_cart",
        params: {
          currency: CURRENCY,
          value: dollars(variant.price * quantity),
          items: [
            {
              item_id: product.id,
              item_name: product.name,
              item_variant: variant.sku,
              price: dollars(variant.price),
              quantity,
            },
          ],
        },
      });
    }
    showAdded({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      colorName: colorView?.name ?? color,
      size: variant.size,
      image: colorView?.images[0]?.url ?? "",
      price: variant.price,
      ...(variant.compareAtPrice ? { compareAtPrice: variant.compareAtPrice } : {}),
    });
  };

  const price = variant
    ? { price: variant.price, compareAtPrice: variant.compareAtPrice }
    : {
        price: product.priceRange.min,
        max: product.priceRange.max,
        compareAtPrice: product.priceRange.compareAtMin,
      };

  return (
    <div
      className="grid gap-8 lg:grid-cols-12 lg:gap-12"
      data-interactive={interactive || undefined}
    >
      <div className="lg:col-span-7">
        {colorView && (
          <Gallery key={colorView.code} images={colorView.images} productName={product.name} />
        )}
      </div>

      <div className="lg:sticky lg:top-24 lg:col-span-5 lg:self-start">
        {breadcrumbs}
        {badge && (
          <Badge tone={badge.tone === "neutral" ? "muted" : badge.tone} className="mt-4">
            {badge.label}
          </Badge>
        )}
        <h1 className="mt-3 font-display text-4xl">{product.name}</h1>
        <div className="mt-3">
          <PriceDisplay size="lg" {...price} />
        </div>
        {product.ratingCount > 0 && (
          <a href="#reviews" className="mt-2 flex w-fit items-center gap-2 text-sm hover:underline">
            <Rating value={product.ratingAvg} count={product.ratingCount} size="md" />
            <span className="text-ink-soft">Read reviews</span>
          </a>
        )}
        <p className="mt-4 bg-surface-muted px-4 py-3 text-sm">
          Members earn 10 points per dollar.{" "}
          {product.finalSale ? (
            <strong className="text-sale">Final sale: not eligible for return.</strong>
          ) : (
            "Free returns within 30 days."
          )}
        </p>

        <div className="mt-8 flex flex-col gap-7">
          <SwatchPicker
            name="color"
            value={color}
            onChange={changeColor}
            options={product.colors.map((c) => ({
              value: c.code,
              label: c.name,
              swatch: c.swatch,
            }))}
          />
          <FitTabs name="fit" fits={fits} value={fit} onChange={(f) => setFitChoice(f)} />
          <div ref={sizeGroup}>
            <SizePicker
              name="size"
              options={options}
              value={sizeAvailable ? size : null}
              onChange={(s) => {
                setSize(s);
                setSizeError(undefined);
              }}
              error={sizeError}
              action={<SizeGuideModal guide={sizeGuide} />}
            />
            {fitSummary && (
              <p className="mt-3 text-sm text-ink-soft">
                Fit: <span className="text-ink">{fitSummary}</span> based on reviews
              </p>
            )}
          </div>

          {variant && outOfStock && (
            <BackInStockForm
              key={variant.sku}
              productId={product.id}
              sku={variant.sku}
              size={variant.size}
            />
          )}
          {stock?.kind === "low" && (
            <p className="text-sm text-warning" role="status">
              Only {stock.remaining} left in this size
            </p>
          )}

          <div className="flex items-end gap-3">
            <QuantityStepper
              value={quantity}
              onChange={setQuantity}
              max={Math.min(10, variant?.online || 10)}
            />
            <Button
              ref={addButton}
              size="lg"
              fullWidth
              disabled={outOfStock || preview}
              onClick={onAdd}
              className="flex-1"
            >
              {preview ? "Preview — not for sale yet" : outOfStock ? "Out of stock" : "Add to bag"}
            </Button>
            {!preview && (
              <WishlistButton
                variant="inline"
                productId={product.id}
                productName={product.name}
                color={color}
                price={product.priceRange.min}
                className="size-14"
              />
            )}
          </div>

          {!preview && <PriceDropAlert productId={product.id} />}

          <Fulfilment terms={delivery} />

          {details}
        </div>
      </div>

      {/* Sticky add-to-bag on small screens */}
      <div
        aria-hidden={!showSticky}
        className={cn(
          "fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t border-line bg-surface p-3 transition-transform duration-base ease-atelier lg:hidden",
          showSticky ? "translate-y-0" : "pointer-events-none translate-y-full",
        )}
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm">{product.name}</p>
          <PriceDisplay size="sm" showPercent={false} {...price} />
        </div>
        <Button tabIndex={showSticky ? 0 : -1} disabled={outOfStock || preview} onClick={onAdd}>
          {preview ? "Preview only" : outOfStock ? "Out of stock" : "Add to bag"}
        </Button>
      </div>
    </div>
  );
}

/** Reads ?color= on the client; the static shell renders the default colour. */
export function ProductDetailFromParams(
  props: Omit<ProductDetailProps, "initialColor"> & { defaultColor: string },
) {
  const params = useSearchParams();
  const requested = params.get("color");
  const initialColor = props.product.colors.some((c) => c.code === requested)
    ? (requested as string)
    : props.defaultColor;
  // Seeds state once; later colour changes come from the picker, not a remount.
  return <ProductDetail {...props} initialColor={initialColor} />;
}
