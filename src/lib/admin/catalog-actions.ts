"use server";

import { z } from "zod";
import { ActionError, runAction } from "@/lib/actions/run-action";
import { hasPermission } from "@/lib/auth/rbac";
import { PRODUCT_BADGES, merchRulesSchema } from "@/lib/validation";
import {
  decidePriceChange,
  importProductsCsv,
  moveProductImage,
  requestPriceChange,
  setProductStatus,
  setVariantPrice,
  updateCategory,
  updateProduct,
} from "./catalog-service";

const id = z.string().min(1).max(128);
const status = z.enum(["draft", "scheduled", "live", "archived"]);
const dollars = z.coerce
  .number("Enter a price")
  .positive("Enter a price above zero")
  .max(100_000)
  .transform((v) => Math.round(v * 100));
const optionalDollars = z
  .union([z.literal(""), z.coerce.number().positive().max(100_000)])
  .optional()
  .transform((v) => (v === "" || v === undefined ? null : Math.round(v * 100)));
const ids = z
  .union([z.array(id), z.string()])
  .transform((v) => (typeof v === "string" ? v.split(",").filter(Boolean) : v))
  .pipe(z.array(id).min(1, "Select at least one product").max(200));

/** Saves a product's content (name, description, badges, SEO, schedule). */
export async function updateProductAction(input: unknown) {
  return runAction(input, {
    schema: z.object({
      productId: id,
      name: z.string().trim().min(1, "Enter a name").max(120),
      description: z.string().trim().max(4000),
      seoTitle: z.string().trim().max(70, "Keep SEO titles under 70 characters").optional(),
      seoDescription: z
        .string()
        .trim()
        .max(160, "Keep SEO descriptions under 160 characters")
        .optional(),
      publishAt: z.string().optional(),
      ...Object.fromEntries(PRODUCT_BADGES.map((b) => [`badge_${b}`, z.boolean().optional()])),
    }),
    access: { permission: "catalog.write" },
    handler: async (input, { session }) => {
      if (!session) throw new ActionError("unauthenticated", "Sign in again");
      const values = input as Record<string, unknown> & typeof input;
      const publishAt = values.publishAt ? new Date(values.publishAt) : null;
      if (publishAt && Number.isNaN(publishAt.getTime())) {
        throw new ActionError("conflict", "Enter a valid publish date");
      }
      await updateProduct(session, values.productId, {
        name: values.name,
        description: values.description,
        badges: PRODUCT_BADGES.filter((b) => values[`badge_${b}`] === true),
        seoTitle: values.seoTitle,
        seoDescription: values.seoDescription,
        publishAt,
      });
      return { saved: true };
    },
  });
}

/** Changes publish status for one or many products. */
export async function setProductStatusAction(input: unknown) {
  return runAction(input, {
    schema: z.object({ productIds: ids, status }),
    access: { permission: "catalog.publish" },
    handler: async ({ productIds, status: next }, { session }) => {
      if (!session) throw new ActionError("unauthenticated", "Sign in again");
      return { changed: await setProductStatus(session, productIds, next) };
    },
  });
}

/** Moves an image within a colour's gallery. */
export async function moveImageAction(input: unknown) {
  return runAction(input, {
    schema: z.object({
      productId: id,
      color: z.string().min(1).max(60),
      from: z.number().int().min(0),
      to: z.number().int().min(0),
    }),
    access: { permission: "catalog.write" },
    handler: async ({ productId, color, from, to }, { session }) => {
      if (!session) throw new ActionError("unauthenticated", "Sign in again");
      await moveProductImage(session, productId, color, from, to);
      return { moved: true };
    },
  });
}

/**
 * A new price for a SKU: applied immediately by pricing managers, filed as
 * a request for approval by anyone else with catalog access.
 */
export async function changePriceAction(input: unknown) {
  return runAction(input, {
    schema: z
      .object({
        sku: z.string().min(1).max(64),
        price: dollars,
        compareAtPrice: optionalDollars,
        reason: z.string().trim().min(3, "Add a short reason").max(500),
      })
      .refine((v) => v.compareAtPrice === null || v.compareAtPrice > v.price, {
        message: "The compare-at price must be higher than the price",
        path: ["compareAtPrice"],
      }),
    access: { permission: "catalog.write" },
    handler: async ({ sku, price, compareAtPrice, reason }, { session }) => {
      if (!session) throw new ActionError("unauthenticated", "Sign in again");
      if (hasPermission(session.role, "pricing.write")) {
        await setVariantPrice(session, sku, price, compareAtPrice, reason);
        return { applied: true as const };
      }
      await requestPriceChange(session, { sku, price, compareAtPrice, reason });
      return { applied: false as const };
    },
  });
}

/** Sets a price directly from the pricing screen (markdowns). */
export async function setPriceAction(input: unknown) {
  return runAction(input, {
    schema: z
      .object({
        sku: z.string().min(1).max(64),
        price: dollars,
        compareAtPrice: optionalDollars,
        reason: z.string().trim().min(3, "Add a short reason").max(500),
      })
      .refine((v) => v.compareAtPrice === null || v.compareAtPrice > v.price, {
        message: "The compare-at price must be higher than the price",
        path: ["compareAtPrice"],
      }),
    access: { permission: "pricing.write" },
    handler: async ({ sku, price, compareAtPrice, reason }, { session }) => {
      if (!session) throw new ActionError("unauthenticated", "Sign in again");
      await setVariantPrice(session, sku, price, compareAtPrice, reason);
      return { applied: true };
    },
  });
}

/** Approves or rejects a pending price change request. */
export async function decidePriceChangeAction(input: unknown) {
  return runAction(input, {
    schema: z.object({ requestId: id, decision: z.enum(["approved", "rejected"]) }),
    access: { permission: "pricing.approve" },
    handler: async ({ requestId, decision }, { session }) => {
      if (!session) throw new ActionError("unauthenticated", "Sign in again");
      await decidePriceChange(session, requestId, decision);
      return { decision };
    },
  });
}

/** Bulk product update from pasted or uploaded CSV text. */
export async function importProductsAction(input: unknown) {
  return runAction(input, {
    schema: z.object({ csv: z.string().min(1, "Choose a CSV file").max(2_000_000) }),
    access: { permission: "catalog.write" },
    handler: async ({ csv }, { session }) => {
      if (!session) throw new ActionError("unauthenticated", "Sign in again");
      return importProductsCsv(session, csv, {
        canPublish: hasPermission(session.role, "catalog.publish"),
      });
    },
  });
}

/** Saves a category's details and merchandising rules. */
export async function updateCategoryAction(input: unknown) {
  return runAction(input, {
    schema: z.object({
      categoryId: id,
      name: z.string().trim().min(1, "Enter a name").max(80),
      sortOrder: z.coerce.number().int().min(0).max(999),
      status,
      merchRules: merchRulesSchema,
    }),
    access: { permission: "merch.write" },
    handler: async ({ categoryId, ...edit }, { session }) => {
      if (!session) throw new ActionError("unauthenticated", "Sign in again");
      await updateCategory(session, categoryId, edit);
      return { saved: true };
    },
  });
}
