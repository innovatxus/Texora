import { z } from "zod";
import type { AppliedPromotion } from "@/lib/pricing/engine";

export const bagRequestSchema = z.object({
  lines: z
    .array(z.object({ sku: z.string().min(1).max(64), quantity: z.number().int().min(1).max(10) }))
    .max(100),
  promoCodes: z.array(z.string().max(40)).max(5).default([]),
  shippingMethod: z.enum(["standard", "express"]).default("standard"),
  /** Destination state for tax; estimated until known. */
  region: z.string().max(4).optional(),
  giftCardCode: z.string().max(40).optional(),
  rewardsValue: z.number().int().nonnegative().optional(),
});
export type BagRequest = z.infer<typeof bagRequestSchema>;

export interface BagLineView {
  sku: string;
  productId: string;
  slug: string;
  name: string;
  colorCode: string;
  colorName: string;
  size: string;
  fitFamily: string;
  image: string;
  unitPrice: number;
  compareAtPrice?: number;
  quantity: number;
  requestedQuantity: number;
  available: number;
  finalSale: boolean;
  discount?: number;
  lineTotal?: number;
  issue: "out_of_stock" | "quantity_reduced" | null;
}

export interface UnavailableLine {
  sku: string;
  issue: "unavailable";
  requestedQuantity: number;
}

export interface BagTotals {
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  giftCard: number;
  rewards: number;
  total: number;
}

export interface BagView {
  lines: Array<BagLineView | UnavailableLine>;
  totals: BagTotals;
  applied: AppliedPromotion[];
  codes: Array<{ code: string; status: "applied" | "rejected"; message: string }>;
  giftCard:
    | { status: "applied"; last4: string; balance: number; applied: number }
    | { status: "rejected"; message: string }
    | null;
  rewards: { points: number; tier: string; options: number[]; applied: number } | null;
  freeShippingThreshold: number;
  freeShippingRemaining: number;
  taxEstimated: boolean;
  signedIn: boolean;
  itemCount: number;
}

export const isAvailableLine = (line: BagLineView | UnavailableLine): line is BagLineView =>
  line.issue !== "unavailable";
