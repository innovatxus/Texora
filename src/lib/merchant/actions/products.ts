"use server";

import { z } from "zod";
import { ActionError, runAction } from "@/lib/actions/run-action";
import type { Session } from "@/lib/auth/session";
import { getMerchantContext } from "../context";
import {
  PublishBlockedError,
  submitProduct,
  syncArchived,
  syncPublishedStock,
  unpublishProduct,
} from "../publishing/publish";
import type { PublishProblem } from "../publishing/validate";
import {
  createDraft,
  getOwnedDraftRecord,
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

/**
 * Bulk actions from the product list. "publish" submits each product
 * (straight live for trusted merchants); products with problems are listed
 * back instead of failing the whole batch.
 */
export async function bulkProductAction(input: unknown) {
  return runAction(input, {
    schema: z.object({
      productIds: z.array(productId).min(1).max(100),
      operation: z.enum(["archive", "restore", "duplicate", "publish", "unpublish"]),
    }),
    access: { permission: "vendor.catalog.write" },
    handler: async ({ productIds, operation }, { session }) => {
      const actor = actorOf(session);
      if (operation === "duplicate") {
        const ids: string[] = [];
        for (const id of productIds) ids.push(await duplicateDraft(actor, id));
        return { changed: ids.length, ids, failures: [] as string[] };
      }
      if (operation === "publish" || operation === "unpublish") {
        let changed = 0;
        const failures: string[] = [];
        for (const id of productIds) {
          try {
            if (operation === "publish") await submitProduct(actor, id);
            else await unpublishProduct(actor, id);
            changed++;
          } catch (error) {
            if (!(error instanceof ActionError)) throw error;
            const name =
              (await getOwnedDraftRecord(actor, id).catch(() => null))?.summary?.name ??
              "A product";
            failures.push(
              `${name}: ${error instanceof PublishBlockedError ? error.problems[0]?.message : error.message}`,
            );
          }
        }
        return { changed, ids: productIds, failures };
      }
      const changed = await setArchived(actor, productIds, operation === "archive", syncArchived);
      return { changed, ids: productIds, failures: [] as string[] };
    },
  });
}

/** Submit for review, or publish for trusted merchants. Returns every problem when blocked. */
export async function submitProductAction(input: unknown) {
  return runAction(input, {
    schema: z.object({ productId }),
    access: { permission: "vendor.catalog.write" },
    handler: async ({ productId: id }, { session }) => {
      try {
        return { ...(await submitProduct(actorOf(session), id)), problems: [] as PublishProblem[] };
      } catch (error) {
        // Problems are part of the answer, so the editor can list and link them.
        if (error instanceof PublishBlockedError) return { status: null, problems: error.problems };
        throw error;
      }
    },
  });
}

/** Takes a product off sale (back to draft). */
export async function unpublishProductAction(input: unknown) {
  return runAction(input, {
    schema: z.object({ productId }),
    access: { permission: "vendor.catalog.write" },
    handler: async ({ productId: id }, { session }) => {
      await unpublishProduct(actorOf(session), id);
      return { status: "draft" as const };
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
    handler: async ({ productId: id, key, locationId, quantity }, { session }) => {
      const result = await updateDraftStock(actorOf(session), id, key, locationId, quantity);
      // Stock changes reach a live product straight away; other edits wait for review.
      await syncPublishedStock(id);
      return result;
    },
  });
}
