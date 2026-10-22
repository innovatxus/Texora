"use server";

import { z } from "zod";
import { ActionError, runAction } from "@/lib/actions/run-action";
import { hasPermission } from "@/lib/auth/rbac";
import { decideShop, setTrustLevel } from "../admin-service";
import { PublishBlockedError, reviewProduct } from "../publishing/publish";

const reasons = z.array(z.string().trim().max(500)).max(10).default([]);

/**
 * A reviewer's decision on a shop. Approve, request changes and reject need
 * `merchants.review`; suspend and reinstate need `merchants.manage`.
 */
export async function decideShopAction(input: unknown) {
  return runAction(input, {
    schema: z.object({
      shopId: z.string().min(1).max(128),
      decision: z.enum(["approve", "changes", "reject", "suspend", "reinstate"]),
      reasons,
    }),
    access: { permission: "merchants.review" },
    handler: async ({ shopId, decision, reasons: notes }, { session }) => {
      if (!session) throw new ActionError("unauthenticated", "Please sign in to continue");
      if (
        (decision === "suspend" || decision === "reinstate") &&
        !hasPermission(session.role, "merchants.manage")
      ) {
        throw new ActionError("forbidden", "Only admins can pause or reinstate shops.");
      }
      return { status: await decideShop(session, shopId, decision, notes) };
    },
  });
}

/** Sets a merchant's trust level (trusted merchants skip product review). */
export async function setTrustLevelAction(input: unknown) {
  return runAction(input, {
    schema: z.object({
      vendorId: z.string().min(1).max(128),
      trustLevel: z.enum(["standard", "trusted"]),
    }),
    access: { permission: "merchants.manage" },
    handler: async ({ vendorId, trustLevel }, { session }) => {
      if (!session) throw new ActionError("unauthenticated", "Please sign in to continue");
      await setTrustLevel(session, vendorId, trustLevel);
      return { trustLevel };
    },
  });
}

/** Approve a product in review, or send it back with changes. */
export async function reviewProductAction(input: unknown) {
  return runAction(input, {
    schema: z.object({
      productId: z.string().min(1).max(128),
      decision: z.enum(["approve", "changes"]),
      reasons,
    }),
    access: { permission: "merchants.review" },
    handler: async ({ productId, decision, reasons: notes }, { session }) => {
      if (!session) throw new ActionError("unauthenticated", "Please sign in to continue");
      try {
        return await reviewProduct(session, productId, decision, notes);
      } catch (error) {
        if (error instanceof PublishBlockedError) {
          throw new ActionError(
            "conflict",
            `Can't approve yet: ${error.problems.map((p) => p.message).join("; ")}.`,
          );
        }
        throw error;
      }
    },
  });
}
