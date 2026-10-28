import { z } from "zod";
import { checkEgyptAddress } from "@/config/egypt-address";
import { normalizeEgyptianMobile } from "@/config/locale";
import { addressSchema } from "@/lib/validation/common";

/** A delivery address's fields, for schemas that add their own (e.g. an order id). */
export const checkoutAddressFields = addressSchema.extend({
  /** An Egyptian mobile for the courier, stored as +20…; any common format is accepted. */
  phone: z
    .string()
    .trim()
    .refine((value) => normalizeEgyptianMobile(value) !== null, {
      message: "Enter an Egyptian mobile number, e.g. 010 1234 5678",
    })
    .transform((value) => normalizeEgyptianMobile(value) as string),
  country: z.literal("EG", { error: "We deliver within Egypt only" }),
});

/**
 * Shared by the checkout forms (client) and placeOrder (server): the fields
 * plus the Egypt address check (area and postal code match the governorate).
 */
export const checkoutAddressSchema = checkoutAddressFields.superRefine(checkEgyptAddress);
export type CheckoutAddress = z.infer<typeof checkoutAddressSchema>;

/** Everything checkout sends to place an order; prices are recalculated on the server. */
export const placeOrderSchema = z.object({
  idempotencyKey: z.string().min(16).max(128),
  email: z.email("Enter a valid email address").max(254).toLowerCase(),
  lines: z
    .array(z.object({ sku: z.string().min(1).max(64), quantity: z.number().int().min(1).max(10) }))
    .min(1, "Your bag is empty")
    .max(100),
  promoCodes: z.array(z.string().max(40)).max(5),
  delivery: z.discriminatedUnion("method", [
    z.object({ method: z.literal("standard") }),
    z.object({ method: z.literal("express") }),
  ]),
  shippingAddress: checkoutAddressSchema,
  billingAddress: checkoutAddressSchema,
  paymentMethod: z.enum(["card", "cod", "none"]),
  giftCardCode: z.string().max(40).optional(),
  rewardsValue: z.number().int().nonnegative().optional(),
  marketingOptIn: z.boolean().optional(),
});
export type PlaceOrderInput = z.infer<typeof placeOrderSchema>;
