"use server";

import { z } from "zod";
import { runAction } from "@/lib/actions/run-action";
import { applyFilters, parseListingQuery } from "./listing";
import { listingScopeSchema, resolveScope } from "./scope";

const countSchema = z.object({
  scope: listingScopeSchema,
  /** The drawer's staged selection, as a query string. */
  query: z.string().max(2000),
});

/** Live result count for the mobile filter drawer ("Show N results"). */
export async function countListing(input: unknown) {
  return runAction(input, {
    schema: countSchema,
    access: { public: true },
    handler: async ({ scope, query }) => {
      const resolved = await resolveScope(scope);
      const params: Record<string, string[]> = {};
      for (const [key, value] of new URLSearchParams(query)) (params[key] ??= []).push(value);
      const { filters } = parseListingQuery(params, resolved.context.attributeKeys);
      return { total: applyFilters(resolved.products, filters, Date.now()).length };
    },
  });
}
