"use server";

import { z } from "zod";
import { ActionError, runAction } from "@/lib/actions/run-action";
import { adjustStock, ADJUSTMENT_REASONS } from "./inventory-service";

const REASONS = ADJUSTMENT_REASONS.map((r) => r.value) as [
  (typeof ADJUSTMENT_REASONS)[number]["value"],
  ...Array<(typeof ADJUSTMENT_REASONS)[number]["value"]>,
];

/** Adds or removes stock at a location with a reason code. */
export async function adjustStockAction(input: unknown) {
  return runAction(input, {
    schema: z.object({
      sku: z.string().min(1).max(64),
      location: z.string().min(1).max(64),
      delta: z.coerce
        .number("Enter a whole number, e.g. 5 or -2")
        .int("Enter a whole number, e.g. 5 or -2")
        .min(-10_000)
        .max(10_000),
      reason: z.enum(REASONS, "Choose a reason"),
      note: z.string().trim().max(300).optional(),
    }),
    access: { permission: "inventory.write" },
    handler: async (adjustment, { session }) => {
      if (!session) throw new ActionError("unauthenticated", "Sign in again");
      return adjustStock(session, adjustment);
    },
  });
}
