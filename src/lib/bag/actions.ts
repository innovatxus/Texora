"use server";

import { z } from "zod";
import { runAction } from "@/lib/actions/run-action";
import { compareSizes } from "@/lib/catalog/sizes";
import { getProductById, getVariantsForProduct } from "@/lib/data/products";
import { ONLINE_LOCATION } from "@/lib/validation";
import { priceBag } from "./price-bag";
import { bagRequestSchema } from "./types";

/** Server-priced bag: called by the bag drawer, bag page and checkout on every change. */
export async function getPricedBag(input: unknown) {
  return runAction(input, {
    schema: bagRequestSchema,
    access: { public: true },
    handler: (request) => priceBag(request),
  });
}

/** Colours and sizes a bag line can switch to (same product and fit), with stock. */
export async function getVariantOptions(input: unknown) {
  return runAction(input, {
    schema: z.object({ productId: z.string().min(1).max(128), fitFamily: z.string().max(20) }),
    access: { public: true },
    handler: async ({ productId, fitFamily }) => {
      const [product, variants] = await Promise.all([
        getProductById(productId),
        getVariantsForProduct(productId),
      ]);
      if (!product) return [];
      const names = new Map(product.colors.map((c) => [c.code, c.name]));
      return variants
        .filter((v) => v.fitFamily === fitFamily)
        .map((v) => ({
          sku: v.sku,
          color: v.color,
          colorName: names.get(v.color) ?? v.color,
          size: v.size,
          inStock: (v.stockByLocation[ONLINE_LOCATION] ?? 0) > 0,
        }))
        .sort((a, b) => a.colorName.localeCompare(b.colorName) || compareSizes(a.size, b.size));
    },
  });
}
