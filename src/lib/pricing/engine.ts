/**
 * Pricing engine: pure functions over integer cents. The server is the only
 * place prices are trusted; the bag and checkout render what this returns.
 *
 * Order of operations:
 *   line prices → promotions (line-level, then order-level) → shipping →
 *   tax on the discounted goods + shipping → gift card → rewards → total
 */

export type PromotionType = "percent" | "fixed" | "bogo" | "tiered" | "free_shipping";
export type Audience = "everyone" | "guest" | "member" | "core" | "enthusiast" | "icon";

export interface PricingPromotion {
  id: string;
  name: string;
  type: PromotionType;
  /** Percent (0–100) for percent/bogo; cents for fixed. */
  value: number;
  tiers?: Array<{ minSubtotal: number; value: number }>;
  conditions: {
    minSubtotal?: number;
    categoryKeys?: string[];
    productIds?: string[];
    excludeSale?: boolean;
  };
  automatic: boolean;
  stackable: boolean;
  priority: number;
  audience: Audience;
  /** Set when the promotion came from a code the shopper entered. */
  code?: string;
}

export interface PricingLine {
  sku: string;
  productId: string;
  /** Category keys of the product, e.g. ["women", "women/jeans"]. */
  categoryKeys: string[];
  unitPrice: number;
  compareAtPrice?: number;
  quantity: number;
}

export interface Customer {
  signedIn: boolean;
  tier?: "core" | "enthusiast" | "icon";
}

export interface ShippingConfig {
  method: "standard" | "express";
  rates: { standard: number; express: number };
  freeShippingThreshold: number;
}

export interface PricingInput {
  lines: PricingLine[];
  promotions: PricingPromotion[];
  customer: Customer;
  shipping: ShippingConfig;
  /** Sales-tax rate for the destination, e.g. 0.08875. */
  taxRate: number;
  giftCardBalance?: number;
  /** Reward value the member chose to redeem, in cents. */
  rewardsValue?: number;
}

export interface PricedLine extends PricingLine {
  lineSubtotal: number;
  discount: number;
  lineTotal: number;
  onSale: boolean;
}

export interface AppliedPromotion {
  id: string;
  name: string;
  amount: number;
  code?: string;
  freeShipping?: boolean;
}

export interface PricingResult {
  lines: PricedLine[];
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  giftCard: number;
  rewards: number;
  total: number;
  applied: AppliedPromotion[];
  /** Cents still needed for free standard shipping (0 when reached). */
  freeShippingRemaining: number;
}

const isOnSale = (l: PricingLine) =>
  l.compareAtPrice !== undefined && l.compareAtPrice > l.unitPrice;

/** Whether a promotion's audience includes this customer. */
export function audienceMatches(audience: Audience, customer: Customer): boolean {
  switch (audience) {
    case "everyone":
      return true;
    case "guest":
      return !customer.signedIn;
    case "member":
      return customer.tier !== undefined;
    default:
      return customer.tier === audience;
  }
}

function eligibleLines(promo: PricingPromotion, lines: readonly PricedLine[]): PricedLine[] {
  const { categoryKeys, productIds, excludeSale } = promo.conditions;
  return lines.filter(
    (l) =>
      (!excludeSale || !l.onSale) &&
      (!productIds || productIds.includes(l.productId)) &&
      (!categoryKeys || l.categoryKeys.some((k) => categoryKeys.includes(k))),
  );
}

/** Splits an amount across lines in proportion to their value; remainders go to the largest lines. */
function allocate(amount: number, lines: readonly PricedLine[]): Map<string, number> {
  const base = lines.reduce((sum, l) => sum + l.lineTotal, 0);
  const shares = new Map<string, number>();
  if (base <= 0 || amount <= 0) return shares;
  let assigned = 0;
  for (const l of lines) {
    const share = Math.floor((amount * l.lineTotal) / base);
    shares.set(l.sku, share);
    assigned += share;
  }
  const byValue = [...lines].sort((a, b) => b.lineTotal - a.lineTotal);
  for (let i = 0; assigned < amount; i = (i + 1) % byValue.length) {
    const l = byValue[i];
    if (!l) break;
    shares.set(l.sku, (shares.get(l.sku) ?? 0) + 1);
    assigned += 1;
  }
  return shares;
}

/** Discount a promotion would give the current lines (and whether it frees shipping). */
export function evaluatePromotion(
  promo: PricingPromotion,
  lines: readonly PricedLine[],
): { amount: number; perLine: Map<string, number>; freeShipping: boolean } {
  const none = { amount: 0, perLine: new Map<string, number>(), freeShipping: false };
  const eligible = eligibleLines(promo, lines);
  const eligibleTotal = eligible.reduce((s, l) => s + l.lineTotal, 0);
  if (eligible.length === 0 || eligibleTotal <= 0) return none;
  if (promo.conditions.minSubtotal !== undefined && eligibleTotal < promo.conditions.minSubtotal)
    return none;

  switch (promo.type) {
    case "free_shipping":
      return { ...none, freeShipping: true };
    case "percent": {
      const perLine = new Map(
        eligible.map((l) => [l.sku, Math.round((l.lineTotal * promo.value) / 100)]),
      );
      return {
        amount: [...perLine.values()].reduce((a, b) => a + b, 0),
        perLine,
        freeShipping: false,
      };
    }
    case "fixed": {
      const amount = Math.min(promo.value, eligibleTotal);
      return { amount, perLine: allocate(amount, eligible), freeShipping: false };
    }
    case "tiered": {
      const tier = [...(promo.tiers ?? [])]
        .sort((a, b) => b.minSubtotal - a.minSubtotal)
        .find((t) => eligibleTotal >= t.minSubtotal);
      if (!tier) return none;
      const amount = Math.min(tier.value, eligibleTotal);
      return { amount, perLine: allocate(amount, eligible), freeShipping: false };
    }
    case "bogo": {
      // Every second eligible unit (cheapest first) is discounted by value%.
      const units = eligible
        .flatMap((l) =>
          Array.from({ length: l.quantity }, () => ({
            sku: l.sku,
            price: Math.round(l.lineTotal / l.quantity),
          })),
        )
        .sort((a, b) => a.price - b.price);
      const free = Math.floor(units.length / 2);
      const perLine = new Map<string, number>();
      for (const unit of units.slice(0, free)) {
        perLine.set(
          unit.sku,
          (perLine.get(unit.sku) ?? 0) + Math.round((unit.price * promo.value) / 100),
        );
      }
      return {
        amount: [...perLine.values()].reduce((a, b) => a + b, 0),
        perLine,
        freeShipping: false,
      };
    }
  }
}

/**
 * Chooses which promotions apply: every qualifying stackable promotion, plus
 * the single best non-stackable one. Ties go to the higher priority.
 */
export function selectPromotions(
  promotions: readonly PricingPromotion[],
  lines: readonly PricedLine[],
  customer: Customer,
): PricingPromotion[] {
  const candidates = promotions
    .filter((p) => audienceMatches(p.audience, customer))
    .map((p) => ({ p, result: evaluatePromotion(p, lines) }))
    .filter(({ result }) => result.amount > 0 || result.freeShipping);

  const stackable = candidates.filter(({ p }) => p.stackable).map(({ p }) => p);
  const best = candidates
    .filter(({ p }) => !p.stackable)
    .sort((a, b) => b.result.amount - a.result.amount || b.p.priority - a.p.priority)[0];
  return [...stackable, ...(best ? [best.p] : [])].sort((a, b) => b.priority - a.priority);
}

/** Prices a bag: discounts, shipping, tax, then gift card and rewards. Pure; all amounts in cents. */
export function priceOrder(input: PricingInput): PricingResult {
  let lines: PricedLine[] = input.lines.map((l) => {
    const lineSubtotal = l.unitPrice * l.quantity;
    return { ...l, lineSubtotal, discount: 0, lineTotal: lineSubtotal, onSale: isOnSale(l) };
  });

  const applied: AppliedPromotion[] = [];
  let freeShipping = false;

  for (const promo of selectPromotions(input.promotions, lines, input.customer)) {
    // Each promotion sees the prices left by the ones before it.
    const { amount, perLine, freeShipping: frees } = evaluatePromotion(promo, lines);
    if (frees) freeShipping = true;
    if (amount > 0) {
      lines = lines.map((l) => {
        const cut = Math.min(perLine.get(l.sku) ?? 0, l.lineTotal);
        return cut > 0 ? { ...l, discount: l.discount + cut, lineTotal: l.lineTotal - cut } : l;
      });
    }
    applied.push({
      id: promo.id,
      name: promo.name,
      amount,
      ...(promo.code ? { code: promo.code } : {}),
      ...(frees ? { freeShipping: true } : {}),
    });
  }

  const subtotal = lines.reduce((s, l) => s + l.lineSubtotal, 0);
  const discount = lines.reduce((s, l) => s + l.discount, 0);
  const goods = subtotal - discount;

  const { method, rates, freeShippingThreshold } = input.shipping;
  const qualifiesFree = goods >= freeShippingThreshold;
  const shipping =
    lines.length === 0
      ? 0
      : method === "standard"
        ? qualifiesFree || freeShipping
          ? 0
          : rates.standard
        : freeShipping
          ? 0
          : rates.express;

  const tax = Math.round((goods + shipping) * input.taxRate);
  const due = goods + shipping + tax;
  const giftCard = Math.min(input.giftCardBalance ?? 0, due);
  const rewards = Math.min(input.rewardsValue ?? 0, due - giftCard);

  return {
    lines,
    subtotal,
    discount,
    shipping,
    tax,
    giftCard,
    rewards,
    total: due - giftCard - rewards,
    applied,
    freeShippingRemaining: Math.max(0, freeShippingThreshold - goods),
  };
}

export type CodeRejection =
  "not_found" | "inactive" | "expired" | "not_eligible" | "not_combinable" | "usage_limit";

/** What shoppers are told when a promo code can't be used. */
export const CODE_MESSAGES: Record<CodeRejection, string> = {
  not_found: "We don't recognise that code",
  inactive: "That code is no longer active",
  expired: "That code has expired",
  not_eligible: "Your bag doesn't qualify for that code yet",
  not_combinable: "That code can't be combined with another code",
  usage_limit: "That code has reached its usage limit",
};

/**
 * Checks whether an entered code would actually take effect alongside codes
 * already applied (one non-stackable code per order).
 */
export function checkCode(
  promo: PricingPromotion,
  otherCodes: readonly PricingPromotion[],
  lines: readonly PricingLine[],
  customer: Customer,
): CodeRejection | null {
  if (!audienceMatches(promo.audience, customer)) return "not_eligible";
  if (!promo.stackable && otherCodes.some((c) => !c.stackable)) return "not_combinable";
  const priced: PricedLine[] = lines.map((l) => ({
    ...l,
    lineSubtotal: l.unitPrice * l.quantity,
    discount: 0,
    lineTotal: l.unitPrice * l.quantity,
    onSale: isOnSale(l),
  }));
  const result = evaluatePromotion(promo, priced);
  return result.amount > 0 || result.freeShipping ? null : "not_eligible";
}
