import "server-only";
import { getSession } from "@/lib/auth/session";
import { getStoreSettings, getUserProfile } from "@/lib/data/admin-records";
import { getProductsByIds, getVariantsBySkus } from "@/lib/data/products";
import {
  getGiftCardByCode,
  getPromoCode,
  getPromotion,
  isScheduledNow,
  listActivePromotions,
  normaliseCode,
} from "@/lib/data/promotions";
import {
  checkCode,
  CODE_MESSAGES,
  priceOrder,
  type CodeRejection,
  type Customer,
  type PricingLine,
  type PricingPromotion,
  type PricingResult,
} from "@/lib/pricing/engine";
import { redemptionOptions } from "@/lib/pricing/rewards";
import { taxRateFor } from "@/lib/pricing/tax";
import { deliveryZoneFor } from "@/config/locale";
import { ONLINE_LOCATION, type Promotion } from "@/lib/validation";
import type { BagRequest, BagView } from "./types";

const MAX_PER_LINE = 10;

function toPricing(p: Promotion, code?: string): PricingPromotion {
  return {
    id: p.id,
    name: p.name,
    type: p.type,
    value: p.value,
    ...(p.tiers ? { tiers: p.tiers } : {}),
    conditions: {
      ...(p.conditions.minSubtotal !== undefined ? { minSubtotal: p.conditions.minSubtotal } : {}),
      ...(p.conditions.categoryKeys ? { categoryKeys: p.conditions.categoryKeys } : {}),
      ...(p.conditions.productIds ? { productIds: p.conditions.productIds } : {}),
      ...(p.conditions.excludeSale !== undefined ? { excludeSale: p.conditions.excludeSale } : {}),
    },
    automatic: p.automatic,
    stackable: p.stackable,
    priority: p.priority,
    audience: p.audience,
    ...(code ? { code } : {}),
  };
}

/**
 * Re-prices a bag from the database: current prices, stock, promotions,
 * shipping, tax, gift card and rewards. Nothing the client sends about
 * prices is trusted; only SKUs, quantities and codes.
 */
export async function priceBag(request: BagRequest): Promise<BagView> {
  const now = Date.now();
  const [session, settings, variants] = await Promise.all([
    getSession(),
    getStoreSettings(),
    getVariantsBySkus(request.lines.map((l) => l.sku)),
  ]);
  const products = await getProductsByIds([...new Set(variants.map((v) => v.productId))]);
  const productById = new Map(products.map((p) => [p.id, p]));
  const variantBySku = new Map(variants.map((v) => [v.sku, v]));

  const profile = session && session.role !== "guest" ? await getUserProfile(session.uid) : null;
  const customer: Customer = {
    signedIn: Boolean(profile),
    ...(profile?.loyalty ? { tier: profile.loyalty.tier } : {}),
  };

  // Lines: current price and stock; quantities clamped to what can ship.
  const lines: BagView["lines"] = [];
  const pricingLines: PricingLine[] = [];
  for (const requested of request.lines) {
    const variant = variantBySku.get(requested.sku);
    const product = variant ? productById.get(variant.productId) : undefined;
    if (!variant || !product || product.status !== "live") {
      lines.push({
        sku: requested.sku,
        issue: "unavailable",
        requestedQuantity: requested.quantity,
      });
      continue;
    }
    const available = variant.stockByLocation[ONLINE_LOCATION] ?? 0;
    const quantity = Math.min(requested.quantity, available, MAX_PER_LINE);
    const color = product.colors.find((c) => c.code === variant.color);
    const view = {
      sku: variant.sku,
      productId: product.id,
      slug: product.slug,
      name: product.name,
      colorCode: variant.color,
      colorName: color?.name ?? variant.color,
      size: variant.size,
      fitFamily: variant.fitFamily,
      image: color?.images[0]?.url ?? "",
      unitPrice: variant.price,
      ...(variant.compareAtPrice !== undefined ? { compareAtPrice: variant.compareAtPrice } : {}),
      quantity,
      requestedQuantity: requested.quantity,
      available,
      finalSale: product.badges.includes("final_sale"),
      issue:
        available === 0
          ? ("out_of_stock" as const)
          : quantity < requested.quantity
            ? ("quantity_reduced" as const)
            : null,
    };
    lines.push(view);
    if (quantity > 0) {
      pricingLines.push({
        sku: variant.sku,
        productId: product.id,
        categoryKeys: product.categoryKeys,
        unitPrice: variant.price,
        ...(variant.compareAtPrice !== undefined ? { compareAtPrice: variant.compareAtPrice } : {}),
        quantity,
      });
    }
  }

  // Promotions: automatic ones plus valid codes (one non-stackable code per order).
  const automatic = (await listActivePromotions(now))
    .filter((p) => p.automatic)
    .map((p) => toPricing(p));
  const accepted: PricingPromotion[] = [];
  const codes: BagView["codes"] = [];
  for (const raw of [...new Set(request.promoCodes.map(normaliseCode))].slice(0, 5)) {
    const promoCode = await getPromoCode(raw);
    const promotion = promoCode ? await getPromotion(promoCode.promotionId) : null;
    let rejection: CodeRejection | null = null;
    if (!promoCode || !promotion) rejection = "not_found";
    else if (!promoCode.active || !promotion.active) rejection = "inactive";
    else if (!isScheduledNow(promotion, now)) rejection = "expired";
    else if (promoCode.usageLimit !== undefined && promoCode.usedCount >= promoCode.usageLimit)
      rejection = "usage_limit";
    else rejection = checkCode(toPricing(promotion, raw), accepted, pricingLines, customer);

    if (rejection || !promotion) {
      codes.push({
        code: raw,
        status: "rejected",
        message: CODE_MESSAGES[rejection ?? "not_found"],
      });
    } else {
      accepted.push(toPricing(promotion, raw));
      codes.push({ code: raw, status: "applied", message: promotion.name });
    }
  }

  // Gift card balance.
  let giftCard: BagView["giftCard"] = null;
  if (request.giftCardCode) {
    const card = await getGiftCardByCode(request.giftCardCode);
    const valid =
      card &&
      card.status === "active" &&
      card.balance > 0 &&
      (!card.expiresAt || card.expiresAt.getTime() > now);
    giftCard = valid
      ? { status: "applied", last4: card.last4, balance: card.balance, applied: 0 }
      : {
          status: "rejected",
          message: "That gift card can't be used. Check the number and try again.",
        };
  }

  // Rewards: members only, in EGP 50 steps their balance covers.
  const rewardOptions = profile?.loyalty ? redemptionOptions(profile.loyalty.points) : [];
  const rewardsValue =
    request.rewardsValue && rewardOptions.includes(request.rewardsValue) ? request.rewardsValue : 0;

  const pricing: PricingResult = priceOrder({
    lines: pricingLines,
    promotions: [...automatic, ...accepted],
    customer,
    shipping: {
      method: request.shippingMethod,
      rates: settings.shippingRates[deliveryZoneFor(request.region)],
      freeShippingThreshold: settings.freeShippingThreshold,
    },
    taxRate: taxRateFor(request.region),
    ...(giftCard?.status === "applied" ? { giftCardBalance: giftCard.balance } : {}),
    rewardsValue,
  });
  if (giftCard?.status === "applied") giftCard = { ...giftCard, applied: pricing.giftCard };

  const priced = new Map(pricing.lines.map((l) => [l.sku, l]));
  return {
    lines: lines.map((l) => {
      const p = "productId" in l ? priced.get(l.sku) : undefined;
      return p ? { ...l, discount: p.discount, lineTotal: p.lineTotal } : l;
    }),
    totals: {
      subtotal: pricing.subtotal,
      discount: pricing.discount,
      shipping: pricing.shipping,
      tax: pricing.tax,
      giftCard: pricing.giftCard,
      rewards: pricing.rewards,
      total: pricing.total,
    },
    applied: pricing.applied,
    codes,
    giftCard,
    rewards: profile?.loyalty
      ? {
          points: profile.loyalty.points,
          tier: profile.loyalty.tier,
          options: rewardOptions,
          applied: pricing.rewards,
        }
      : null,
    freeShippingThreshold: settings.freeShippingThreshold,
    freeShippingRemaining: pricing.freeShippingRemaining,
    taxEstimated: false,
    signedIn: customer.signedIn,
    itemCount: pricingLines.reduce((n, l) => n + l.quantity, 0),
  };
}
