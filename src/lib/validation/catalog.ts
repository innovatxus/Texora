import { z } from "zod";
import {
  colorFamilySchema,
  departmentSchema,
  fitFamilySchema,
  hexColorSchema,
  idSchema,
  imageSchema,
  moneySchema,
  publishStatusSchema,
  seoSchema,
  sizeTypeSchema,
  slugSchema,
  timestampSchema,
} from "./common";

/** Badges a product can carry. */
export const PRODUCT_BADGES = [
  "sale",
  "final_sale",
  "low_stock",
  "back_in_stock",
  "online_exclusive",
  "new",
] as const;
/** One product badge. */
export const productBadgeSchema = z.enum(PRODUCT_BADGES);
export type ProductBadge = z.infer<typeof productBadgeSchema>;

/** Display priority: the first applicable badge is the one shown on a card. */
export const BADGE_PRIORITY: readonly ProductBadge[] = PRODUCT_BADGES;

/** A product colour: code, name, swatch and images. */
export const productColorSchema = z.object({
  code: slugSchema,
  name: z.string().min(1).max(60),
  family: colorFamilySchema,
  swatch: hexColorSchema,
  images: z.array(imageSchema).min(1),
  video: z.object({ url: z.string().min(1), poster: imageSchema }).optional(),
});
export type ProductColor = z.infer<typeof productColorSchema>;

/** Lowest and highest prices across a product's variants (cents). */
export const priceRangeSchema = z
  .object({
    min: moneySchema,
    max: moneySchema,
    /** Lowest and highest original prices when any variant is marked down. */
    compareAtMin: moneySchema.optional(),
    compareAtMax: moneySchema.optional(),
  })
  .refine((r) => r.min <= r.max, { message: "min must be ≤ max", path: ["max"] });
export type PriceRange = z.infer<typeof priceRangeSchema>;

/** A product (style): content, categories, fits, colours, prices and status. */
export const productSchema = z.object({
  id: idSchema,
  styleId: z.string().min(1).max(40),
  slug: slugSchema,
  name: z.string().min(1).max(120),
  description: z.string().max(4000),
  department: departmentSchema,
  /** Category slugs from department to leaf, e.g. ["women", "dresses"]. */
  categoryPath: z.array(slugSchema).min(1),
  /** Every ancestor path joined by "/", e.g. ["women", "women/dresses"], for exact subtree queries. */
  categoryKeys: z.array(z.string().min(1)).min(1),
  /** Filterable attributes: material, sleeve, length, rise, neckline, … */
  attributes: z.record(z.string(), z.union([z.string(), z.array(z.string())])),
  fitFamilies: z.array(fitFamilySchema).min(1),
  sizeType: sizeTypeSchema,
  colors: z.array(productColorSchema).min(1),
  priceRange: priceRangeSchema,
  badges: z.array(productBadgeSchema),
  ratingAvg: z.number().min(0).max(5),
  ratingCount: z.number().int().nonnegative(),
  /** Aggregate fit feedback: -1 runs small … 0 true to size … 1 runs large. */
  fitScore: z.number().min(-1).max(1).optional(),
  details: z.object({
    fitNotes: z.string().max(500).optional(),
    modelInfo: z.string().max(200).optional(),
    fabricCare: z.array(z.string().max(200)),
  }),
  completeTheLook: z.array(idSchema).max(8),
  salesRank: z.number().int().nonnegative(),
  status: publishStatusSchema,
  publishAt: timestampSchema.optional(),
  seo: seoSchema,
  searchKeywords: z.array(z.string().max(60)),
  vendorId: idSchema.optional(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export type Product = z.infer<typeof productSchema>;

/** ["women", "dresses"] → ["women", "women/dresses"] */
export function categoryKeysFor(path: readonly string[]): string[] {
  return path.map((_, i) => path.slice(0, i + 1).join("/"));
}

/** Inventory locations: the online DC plus each store id. */
export const ONLINE_LOCATION = "online";

/** A sellable SKU: colour, fit, size, price and stock per location. */
export const variantSchema = z.object({
  sku: z.string().min(1).max(64),
  productId: idSchema,
  color: slugSchema,
  fitFamily: fitFamilySchema,
  size: z.string().min(1).max(16),
  price: moneySchema,
  compareAtPrice: moneySchema.optional(),
  barcode: z.string().max(32).optional(),
  weightGrams: z.number().int().positive(),
  stockByLocation: z.record(z.string(), z.number().int().nonnegative()),
  availableOnline: z.boolean(),
  backorder: z.boolean(),
  lowStockThreshold: z.number().int().nonnegative(),
  vendorId: idSchema.optional(),
  updatedAt: timestampSchema,
});
export type Variant = z.infer<typeof variantSchema>;

/**
 * Merchandisers cannot change prices on live products directly; they file a
 * request that a pricing manager approves or rejects.
 */
export const priceChangeRequestSchema = z.object({
  id: idSchema,
  sku: z.string().min(1).max(64),
  productId: idSchema,
  currentPrice: moneySchema,
  proposedPrice: moneySchema,
  proposedCompareAtPrice: moneySchema.optional(),
  reason: z.string().min(1).max(500),
  requestedBy: idSchema,
  status: z.enum(["pending", "approved", "rejected"]),
  decidedBy: idSchema.optional(),
  decidedAt: timestampSchema.optional(),
  createdAt: timestampSchema,
});
export type PriceChangeRequest = z.infer<typeof priceChangeRequestSchema>;

/** Merchandising rules for a category: pinned, boosted and buried products. */
export const merchRulesSchema = z.object({
  pinned: z.array(idSchema),
  boosted: z.array(idSchema),
  buried: z.array(idSchema),
  defaultSort: z.enum([
    "featured",
    "newest",
    "price_asc",
    "price_desc",
    "best_sellers",
    "top_rated",
  ]),
});

/** A category in the department tree. */
export const categorySchema = z.object({
  id: idSchema,
  slug: slugSchema,
  name: z.string().min(1).max(80),
  department: departmentSchema,
  parentId: idSchema.nullable(),
  /** Slugs from department to this category, e.g. ["women", "dresses"]. */
  path: z.array(slugSchema).min(1),
  sortOrder: z.number().int(),
  sizeType: sizeTypeSchema,
  /** Attribute keys offered as filters on this category's PLP. */
  facets: z.array(z.string()),
  merchRules: merchRulesSchema,
  banner: z
    .object({
      image: imageSchema,
      headline: z.string().max(80),
      body: z.string().max(240).optional(),
    })
    .optional(),
  status: publishStatusSchema,
  seo: seoSchema,
});
export type Category = z.infer<typeof categorySchema>;

/** A curated collection of products. */
export const collectionSchema = z.object({
  id: idSchema,
  slug: slugSchema,
  name: z.string().min(1).max(80),
  description: z.string().max(1000),
  hero: imageSchema.optional(),
  productIds: z.array(idSchema),
  status: publishStatusSchema,
  publishAt: timestampSchema.optional(),
  seo: seoSchema,
});
export type Collection = z.infer<typeof collectionSchema>;
