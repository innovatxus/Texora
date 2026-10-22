"use server";

import { z } from "zod";
import { ActionError, runAction } from "@/lib/actions/run-action";
import type { Session } from "@/lib/auth/session";
import { getMerchantContext } from "../context";
import {
  createDraft,
  duplicateDraft,
  saveDraft,
  setArchived,
  updateDraftStock,
} from "../product-service";
import type { MerchantActor } from "../shop-service";

function actorOf(session: Session | null): MerchantActor {
  if (!session?.vendorId) throw new ActionError("forbidden", "You don't have a merchant account");
  return { session, vendorId: session.vendorId };
}

const productId = z.string().min(1).max(128);

/** Starts a new product in the active shop and returns its editor URL. */
export async function createProductAction(input: unknown) {
  return runAction(input, {
    schema: z.object({}),
    access: { permission: "vendor.catalog.write" },
    handler: async (_input, { session }) => {
      const { shop } = await getMerchantContext();
      if (!shop) throw new ActionError("conflict", "Set up your shop before adding products.");
      const id = await createDraft(actorOf(session), shop.id);
      return { productId: id, redirectTo: `/merchant/products/${id}` };
    },
  });
}

/** Autosave and "Save draft": version-checked so a stale tab can't overwrite newer work. */
export async function saveProductDraftAction(input: unknown) {
  return runAction(input, {
    schema: z.object({ productId, version: z.number().int().nonnegative(), data: z.unknown() }),
    access: { permission: "vendor.catalog.write" },
    handler: async ({ productId: id, version, data }, { session }) =>
      saveDraft(actorOf(session), id, version, data),
  });
}

/** Bulk actions from the product list. Publishing arrives with review (Phase 6). */
export async function bulkProductAction(input: unknown) {
  return runAction(input, {
    schema: z.object({
      productIds: z.array(productId).min(1).max(100),
      operation: z.enum(["archive", "restore", "duplicate"]),
    }),
    access: { permission: "vendor.catalog.write" },
    handler: async ({ productIds, operation }, { session }) => {
      const actor = actorOf(session);
      if (operation === "duplicate") {
        const ids: string[] = [];
        for (const id of productIds) ids.push(await duplicateDraft(actor, id));
        return { changed: ids.length, ids };
      }
      const changed = await setArchived(actor, productIds, operation === "archive");
      return { changed, ids: productIds };
    },
  });
}

/** Inline stock edit from the product list (optimistic in the UI, rolled back on error). */
export async function updateStockAction(input: unknown) {
  return runAction(input, {
    schema: z.object({
      productId,
      key: z.string().min(1).max(200),
      locationId: z.string().min(1).max(128),
      quantity: z.number().int().min(0).max(100_000),
    }),
    access: { permission: "vendor.catalog.write" },
    handler: async ({ productId: id, key, locationId, quantity }, { session }) =>
      updateDraftStock(actorOf(session), id, key, locationId, quantity),
  });
}
