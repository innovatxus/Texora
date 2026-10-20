import { z } from "zod";
import { addressSchema } from "@/lib/validation/common";

/** Shared by the checkout forms (client) and placeOrder (server). */
export const checkoutAddressSchema = addressSchema.extend({
  phone: z
    .string()
    .trim()
    .regex(/^[+\d][\d\s().-]{6,20}$/, "Enter a phone number for delivery updates"),
  country: z.literal("US", { error: "We currently ship to the United States only" }),
  region: z.string().trim().length(2, "Use the 2-letter state code, e.g. NY").toUpperCase(),
  postalCode: z
    .string()
    .trim()
    .regex(/^\d{5}(-\d{4})?$/, "Enter a 5-digit ZIP code"),
});
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
