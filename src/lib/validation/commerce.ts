import { z } from "zod";
import { roleSchema } from "./customer";
import {
  addressSchema,
  audienceSchema,
  currencySchema,
  fitFamilySchema,
  geoSchema,
  idSchema,
  moneySchema,
  scheduleSchema,
  slugSchema,
  timestampSchema,
} from "./common";

/** One line in a saved cart. */
export const cartLineSchema = z.object({
  sku: z.string().min(1).max(64),
  productId: idSchema,
  quantity: z.number().int().min(1).max(10),
  savedForLater: z.boolean(),
  addedAt: timestampSchema,
});

/** A saved cart, for cross-device bags. */
export const cartSchema = z.object({
  id: idSchema,
  /** Firebase uid of the owner; guests get an anonymous-auth uid. */
  ownerUid: idSchema,
  lines: z.array(cartLineSchema).max(100),
  promoCodes: z.array(z.string().max(40)).max(5),
  updatedAt: timestampSchema,
});
export type Cart = z.infer<typeof cartSchema>;

/** Snapshot taken at purchase time so later catalog edits never change an order. */
export const orderLineSchema = z.object({
  sku: z.string(),
  productId: idSchema,
  name: z.string(),
  colorName: z.string(),
  size: z.string(),
  fitFamily: fitFamilySchema,
  imageUrl: z.string(),
  unitPrice: moneySchema,
  compareAtPrice: moneySchema.optional(),
  quantity: z.number().int().min(1),
  discount: moneySchema,
  lineTotal: moneySchema,
  finalSale: z.boolean(),
  /** Marketplace lines: the merchant and shop at the time of purchase. */
  vendorId: idSchema.optional(),
  shopId: idSchema.optional(),
  shopName: z.string().max(60).optional(),
});
export type OrderLine = z.infer<typeof orderLineSchema>;

/** An order's totals (cents). */
export const orderTotalsSchema = z.object({
  subtotal: moneySchema,
  discount: moneySchema,
  shipping: moneySchema,
  tax: moneySchema,
  giftCard: moneySchema,
  rewards: moneySchema,
  total: moneySchema,
});

/** Every order status, in lifecycle order. */
export const ORDER_STATUSES = [
  "pending_payment",
  "placed",
  "processing",
  "partially_shipped",
  "shipped",
  "delivered",
  "cancelled",
  "partially_refunded",
  "refunded",
] as const;
/** One order status. */
export const orderStatusSchema = z.enum(ORDER_STATUSES);
export type OrderStatus = z.infer<typeof orderStatusSchema>;

const actorSchema = z.object({ uid: idSchema, role: roleSchema });

/** An order: snapshotted lines, totals, addresses, payments, shipments and history. */
export const orderSchema = z.object({
  id: idSchema,
  /** Marketplace vendors with lines in this order (empty for first-party orders). */
  vendorIds: z.array(idSchema),
  /** Human-facing number, e.g. TX-100482. */
  number: z.string().regex(/^TX-\d{6,}$/),
  userId: idSchema.nullable(),
  email: z.email(),
  status: orderStatusSchema,
  currency: currencySchema,
  lines: z.array(orderLineSchema).min(1),
  totals: orderTotalsSchema,
  shippingAddress: addressSchema,
  billingAddress: addressSchema,
  delivery: z.object({
    method: z.enum(["standard", "express"]),
    cost: moneySchema,
    estimatedFrom: timestampSchema,
    estimatedTo: timestampSchema,
  }),
  promoCodes: z.array(z.string()),
  payments: z.array(
    z.object({
      provider: z.enum(["paymob", "cod", "gift_card", "rewards"]),
      ref: z.string(),
      amount: moneySchema,
      status: z.enum(["pending", "authorized", "captured", "failed", "refunded"]),
    }),
  ),
  shipments: z.array(
    z.object({
      id: idSchema,
      carrier: z.string(),
      trackingNumber: z.string(),
      skus: z.array(z.string()),
      status: z.enum(["label_created", "in_transit", "delivered", "exception"]),
      shippedAt: timestampSchema.optional(),
      deliveredAt: timestampSchema.optional(),
    }),
  ),
  refunds: z.array(
    z.object({
      id: idSchema,
      amount: moneySchema,
      reason: z.string().max(500),
      by: actorSchema,
      at: timestampSchema,
      /** Payment provider refund id, for card refunds. */
      providerRef: z.string().optional(),
      /** Part paid back outside the system (cash on delivery). */
      manual: moneySchema.optional(),
      /** Paid as store credit instead of back to the original payment. */
      storeCredit: z.boolean().optional(),
    }),
  ),
  statusHistory: z.array(
    z.object({
      status: orderStatusSchema,
      at: timestampSchema,
      by: actorSchema.optional(),
      note: z.string().optional(),
    }),
  ),
  notes: z.array(z.object({ text: z.string().max(2000), by: actorSchema, at: timestampSchema })),
  /** Set when staff placed the order for a customer (audited). */
  placedOnBehalfBy: actorSchema.optional(),
  idempotencyKey: z.string().min(16).max(128),
  loyaltyPointsEarned: z.number().int().nonnegative(),
  /** Set once the earned points have been added to the member's balance. */
  loyaltyCreditedAt: timestampSchema.optional(),
  placedAt: timestampSchema,
  updatedAt: timestampSchema,
});
export type Order = z.infer<typeof orderSchema>;

/** Every return status, in lifecycle order. */
export const RETURN_STATUSES = [
  "requested",
  "approved",
  "denied",
  "in_transit",
  "received",
  "inspected",
  "refunded",
  "closed",
] as const;

/** Reasons a customer can give for returning an item. */
export const RETURN_REASON_VALUES = [
  "too_small",
  "too_large",
  "not_as_described",
  "damaged",
  "changed_mind",
  "other",
] as const;

/** A return: items, method, refund choice, label and status history. */
export const returnSchema = z.object({
  id: idSchema,
  /** Human-facing reference, e.g. TX-100482-R1. */
  number: z.string().regex(/^TX-\d{6,}-R\d+$/),
  orderId: idSchema,
  orderNumber: z.string(),
  userId: idSchema.nullable(),
  email: z.email(),
  lines: z.array(
    z.object({
      sku: z.string(),
      quantity: z.number().int().min(1),
      reason: z.enum(RETURN_REASON_VALUES),
      comment: z.string().max(500).optional(),
      condition: z.enum(["resellable", "damaged"]).optional(),
    }),
  ),
  method: z.enum(["mail", "store"]),
  /** Drop-off store for in-store returns. */
  storeId: idSchema.optional(),
  refundTo: z.enum(["original", "store_credit"]),
  status: z.enum(RETURN_STATUSES),
  /** Prepaid label for mail returns; the code is what the QR encodes. */
  label: z.object({ carrier: z.string(), trackingNumber: z.string(), code: z.string() }).optional(),
  /** Refund the customer can expect, calculated when the return is requested. */
  refundEstimate: moneySchema,
  refundAmount: moneySchema.optional(),
  /** Internal note from the approve/deny decision. */
  staffNote: z.string().max(500).optional(),
  receivedAt: timestampSchema.optional(),
  /** Inventory location the resellable units were restocked to. */
  receivedAtLocation: z.string().optional(),
  statusHistory: z.array(
    z.object({ status: z.enum(RETURN_STATUSES), at: timestampSchema, by: actorSchema.optional() }),
  ),
  createdAt: timestampSchema,
});
export type Return = z.infer<typeof returnSchema>;

/** Supported promotion mechanics. */
export const PROMOTION_TYPES = ["percent", "fixed", "bogo", "tiered", "free_shipping"] as const;

/** A promotion: type, value, conditions, stacking, audience and schedule. */
export const promotionSchema = z.object({
  id: idSchema,
  name: z.string().min(1).max(80),
  type: z.enum(PROMOTION_TYPES),
  /** Percent (0–100) for percent; minor units for fixed. Unused for bogo/free_shipping. */
  value: z.number().nonnegative(),
  tiers: z
    .array(z.object({ minSubtotal: moneySchema, value: z.number().nonnegative() }))
    .optional(),
  conditions: z.object({
    minSubtotal: moneySchema.optional(),
    /** Category keys as on products, e.g. "women/jeans" (Firestore has no nested arrays). */
    categoryKeys: z.array(z.string().min(1)).optional(),
    productIds: z.array(idSchema).optional(),
    excludeSale: z.boolean().optional(),
  }),
  /** Automatic promotions apply without a code. */
  automatic: z.boolean(),
  stackable: z.boolean(),
  priority: z.number().int(),
  audience: audienceSchema,
  schedule: scheduleSchema,
  active: z.boolean(),
});
export type Promotion = z.infer<typeof promotionSchema>;

/** A promo code that unlocks a promotion, with usage limits. */
export const promoCodeSchema = z.object({
  /** Upper-case code, also the document id. */
  code: z.string().regex(/^[A-Z0-9-]{3,40}$/),
  promotionId: idSchema,
  usageLimit: z.number().int().positive().optional(),
  perCustomerLimit: z.number().int().positive().optional(),
  usedCount: z.number().int().nonnegative(),
  active: z.boolean(),
});
export type PromoCode = z.infer<typeof promoCodeSchema>;

/** An issued gift card, keyed by the hash of its code. */
export const giftCardSchema = z.object({
  /** SHA-256 of the card code; the code itself is never stored. */
  id: z.string().regex(/^[0-9a-f]{64}$/),
  last4: z.string().regex(/^[A-Z0-9]{4}$/),
  currency: currencySchema,
  initialBalance: moneySchema,
  balance: moneySchema,
  recipientEmail: z.email().optional(),
  issuedBy: z.object({ uid: idSchema, role: roleSchema }).optional(),
  status: z.enum(["active", "redeemed", "disabled"]),
  expiresAt: timestampSchema.optional(),
  createdAt: timestampSchema,
});
export type GiftCard = z.infer<typeof giftCardSchema>;

/** An e-gift card bought online. The card itself is issued (and its code emailed) on delivery. */
export const giftCardPurchaseSchema = z.object({
  id: idSchema,
  amount: moneySchema,
  currency: currencySchema,
  purchaserEmail: z.email(),
  senderName: z.string().min(1).max(60),
  recipientName: z.string().min(1).max(60),
  recipientEmail: z.email(),
  message: z.string().max(300).optional(),
  /** Calendar date (YYYY-MM-DD, store time) to email the card. */
  deliverOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(["pending_payment", "paid", "delivered", "cancelled"]),
  paymentRef: z.string().optional(),
  /** The issued card (hash id), once delivered. */
  giftCardId: z.string().optional(),
  userId: idSchema.nullable(),
  createdAt: timestampSchema,
  paidAt: timestampSchema.optional(),
  deliveredAt: timestampSchema.optional(),
});
export type GiftCardPurchase = z.infer<typeof giftCardPurchaseSchema>;

/** A customer care enquiry from the contact form. */
export const contactRequestSchema = z.object({
  id: idSchema,
  name: z.string().min(1).max(80),
  email: z.email(),
  topic: z.enum(["order", "return", "product", "payment", "other"]),
  orderNumber: z.string().max(20).optional(),
  message: z.string().min(10).max(2000),
  status: z.enum(["open", "closed"]),
  createdAt: timestampSchema,
});
export type ContactRequest = z.infer<typeof contactRequestSchema>;

/** A physical store: address, location, hours and services. */
export const storeSchema = z.object({
  id: idSchema,
  slug: slugSchema,
  name: z.string().min(1).max(80),
  address: addressSchema.omit({ firstName: true, lastName: true, company: true }),
  geo: geoSchema,
  phone: z.string().max(30),
  timezone: z.string(),
  /** 0 = Sunday. Times are local, 24h "HH:MM". */
  hours: z.array(
    z.object({
      day: z.number().int().min(0).max(6),
      open: z.string().regex(/^\d{2}:\d{2}$/),
      close: z.string().regex(/^\d{2}:\d{2}$/),
    }),
  ),
  services: z.array(z.enum(["returns", "alterations", "styling"])),
  status: z.enum(["open", "temporarily_closed", "closed"]),
});
export type Store = z.infer<typeof storeSchema>;

/** Stock held for an unpaid card order, released when it expires. */
export const inventoryReservationSchema = z.object({
  id: idSchema,
  sku: z.string(),
  location: z.string(),
  quantity: z.number().int().min(1),
  cartId: idSchema,
  expiresAt: timestampSchema,
  createdAt: timestampSchema,
});
export type InventoryReservation = z.infer<typeof inventoryReservationSchema>;

/** One audit log entry for a staff or system action. */
export const auditLogSchema = z.object({
  id: idSchema,
  actor: z.object({ uid: idSchema, role: roleSchema, email: z.email().optional() }),
  action: z.string().regex(/^[a-z_]+\.[a-z_.]+$/, "Use dotted lower-case, e.g. orders.refund"),
  target: z.object({ type: z.string().min(1), id: z.string().min(1) }),
  before: z.record(z.string(), z.unknown()).nullable(),
  after: z.record(z.string(), z.unknown()).nullable(),
  /** Paths whose values changed between before and after. */
  changes: z.array(z.string()),
  ip: z.string().max(64).nullable(),
  userAgent: z.string().max(512).nullable(),
  at: timestampSchema,
});
export type AuditLog = z.infer<typeof auditLogSchema>;

const deliveryRatesSchema = z.object({ standard: moneySchema, express: moneySchema });

/** Store-wide settings: delivery, refunds, reservations, loyalty and features. */
export const storeSettingsSchema = z.object({
  currency: currencySchema,
  /** Standard delivery is free from this order value (goods after discounts). */
  freeShippingThreshold: moneySchema,
  /** Delivery prices per zone: Greater Cairo (Cairo, Giza) and the rest of Egypt. */
  shippingRates: z.object({
    greater_cairo: deliveryRatesSchema,
    rest_of_egypt: deliveryRatesSchema,
  }),
  /** Max refund a customer_service agent may issue per order without admin. */
  refundLimits: z.object({ customer_service: moneySchema }),
  reservationMinutes: z.number().int().min(1).max(120),
  loyalty: z.object({
    pointsPerCurrencyUnit: z.number().int().positive(),
    tierThresholds: z.object({ enthusiast: moneySchema, icon: moneySchema }),
    birthdayRewardPoints: z.number().int().nonnegative(),
  }),
  features: z.object({
    vendorMarketplace: z.boolean(),
    quickView: z.boolean(),
    cashOnDelivery: z.boolean(),
    expressPay: z.boolean(),
  }),
  updatedAt: timestampSchema,
});
export type StoreSettings = z.infer<typeof storeSettingsSchema>;
