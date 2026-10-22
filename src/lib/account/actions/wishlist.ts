"use server";

import { z } from "zod";
import { runAction } from "@/lib/actions/run-action";
import { getListingIndex } from "@/lib/catalog/queries";

/**
 * Current card data for saved products, in the order given. Public: guests'
 * wishlists live on their device, and shared lists are opened by anyone.
 * Products that are no longer live are left out.
 */
export async function getWishlistProducts(input: unknown) {
  return runAction(input, {
    schema: z.object({ ids: z.array(z.string().min(1).max(128)).max(200) }),
    access: { public: true },
    handler: async ({ ids }) => {
      const index = await getListingIndex();
      const byId = new Map(index.map((p) => [p.id, p]));
      return { products: ids.flatMap((id) => byId.get(id) ?? []) };
    },
  });
}
