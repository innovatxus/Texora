import { z } from "zod";
import { ROLES } from "../auth/rbac";
import {
  addressSchema,
  fitFamilySchema,
  idSchema,
  moneySchema,
  sizeTypeSchema,
  slugSchema,
  timestampSchema,
} from "./common";

/** Loyalty tiers, lowest first. */
export const LOYALTY_TIERS = ["core", "enthusiast", "icon"] as const;
/** One loyalty tier. */
export const loyaltyTierSchema = z.enum(LOYALTY_TIERS);
export type LoyaltyTier = z.infer<typeof loyaltyTierSchema>;

/** One role. */
export const roleSchema = z.enum(ROLES);

/** A user profile: identity, role, loyalty, preferences and saved sizes. */
export const userSchema = z.object({
  uid: idSchema,
  email: z.email(),
  firstName: z.string().max(60),
  lastName: z.string().max(60),
  phone: z.string().max(30).optional(),
  role: roleSchema,
  loyalty: z
    .object({
      tier: loyaltyTierSchema,
      points: z.number().int().nonnegative(),
      /** Qualifying spend in the current tier period, minor units. */
      periodSpend: moneySchema,
      memberSince: timestampSchema,
    })
    .optional(),
  preferences: z.object({
    fitFamily: fitFamilySchema.optional(),
    marketingEmail: z.boolean(),
    marketingSms: z.boolean(),
  }),
  /** Preferred size per size type, used to pre-select on the PDP. */
  savedSizes: z.partialRecord(sizeTypeSchema, z.string().max(16)),
  vendorId: idSchema.optional(),
  disabled: z.boolean(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export type User = z.infer<typeof userSchema>;

/** Fields a customer may edit on their own profile. */
export const profileUpdateSchema = userSchema
  .pick({ firstName: true, lastName: true, phone: true, preferences: true, savedSizes: true })
  .partial();

/** An address saved to an account. */
export const savedAddressSchema = addressSchema.extend({
  id: idSchema,
  label: z.string().max(40).optional(),
  isDefaultShipping: z.boolean(),
  isDefaultBilling: z.boolean(),
});
export type SavedAddress = z.infer<typeof savedAddressSchema>;

/** A saved product, with the price when saved for price-drop indicators. */
export const wishlistItemSchema = z.object({
  id: idSchema,
  productId: idSchema,
  color: slugSchema.optional(),
  size: z.string().max(16).optional(),
  /** Price when saved, for the price-drop indicator. */
  priceAtAdd: moneySchema,
  addedAt: timestampSchema,
});
export type WishlistItem = z.infer<typeof wishlistItemSchema>;

/** A product review with moderation status. */
export const reviewSchema = z.object({
  id: idSchema,
  productId: idSchema,
  userId: idSchema,
  displayName: z.string().min(1).max(60),
  rating: z.number().int().min(1).max(5),
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(4000),
  /** -2 runs small … 0 true to size … 2 runs large. */
  fit: z.number().int().min(-2).max(2).optional(),
  sizePurchased: z.string().max(16).optional(),
  fitFamily: fitFamilySchema.optional(),
  photos: z.array(z.string().min(1)).max(6),
  verifiedPurchase: z.boolean(),
  helpfulCount: z.number().int().nonnegative(),
  status: z.enum(["pending", "approved", "rejected"]),
  moderatedBy: idSchema.optional(),
  createdAt: timestampSchema,
});
export type Review = z.infer<typeof reviewSchema>;

/** What a customer submits; the server fills identity, status and verification. */
export const reviewInputSchema = reviewSchema.pick({
  productId: true,
  rating: true,
  title: true,
  body: true,
  fit: true,
  sizePurchased: true,
  fitFamily: true,
});

/** A back-in-stock or price-drop alert for an email address. */
export const notificationSchema = z.object({
  id: idSchema,
  type: z.enum(["back_in_stock", "price_drop"]),
  userId: idSchema.optional(),
  email: z.email(),
  productId: idSchema,
  sku: z.string().max(64).optional(),
  /** Price when a price-drop alert was set; the alert fires below it. */
  priceAtSubscribe: moneySchema.optional(),
  /** Alerts fire once: pending until sent. */
  status: z.enum(["pending", "sent"]),
  createdAt: timestampSchema,
  sentAt: timestampSchema.optional(),
});
export type Notification = z.infer<typeof notificationSchema>;
