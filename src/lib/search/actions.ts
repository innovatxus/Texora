"use server";

import { z } from "zod";
import { runAction } from "@/lib/actions/run-action";
import { getSearchDocuments } from "./index-data";
import { buildIndex, search } from "./match";

const suggestSchema = z.object({ query: z.string().trim().min(1).max(80) });

/** Instant results for the search overlay: top products, categories and query completions. */
export async function suggest(input: unknown) {
  return runAction(input, {
    schema: suggestSchema,
    access: { public: true },
    handler: async ({ query }) => search(buildIndex(await getSearchDocuments()), query, 4),
  });
}
