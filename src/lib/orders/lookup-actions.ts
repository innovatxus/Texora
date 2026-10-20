"use server";

import { z } from "zod";
import { ActionError, runAction } from "@/lib/actions/run-action";
import { getOrderByNumberAndEmail } from "@/lib/data/orders";
import { RETURN_REASON_VALUES } from "@/lib/validation";
import { requestReturn } from "@/lib/returns/request-return";
import { getAuthorisedOrder } from "./access";
import { orderAccessToken } from "./token";

/**
 * Guest order lookup by order number + email. Both must match; the error
 * never says which one was wrong, so the form can't be used to discover
 * order numbers or email addresses.
 */
export async function lookupOrder(input: unknown) {
  return runAction(input, {
    schema: z.object({
      orderNumber: z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^(TX-?)?\d{6,12}$/, "Order numbers look like TX-100482")
        .transform((v) => `TX-${v.replace(/^TX-?/, "")}`),
      email: z.email("Enter the email you used at checkout").max(254).toLowerCase(),
    }),
    access: { public: true },
    handler: async ({ orderNumber, email }) => {
      const order = await getOrderByNumberAndEmail(orderNumber, email);
      if (!order) {
        throw new ActionError(
          "not_found",
          "We couldn't find an order with that number and email. Check both and try again.",
        );
      }
      return { href: `/orders/${order.id}?t=${encodeURIComponent(orderAccessToken(order.id))}` };
    },
  });
}

/** Starts a return on an order the caller can see (signed link, owner or staff). */
export async function submitReturn(input: unknown) {
  return runAction(input, {
    schema: z
      .object({
        orderId: z.string().min(1).max(128),
        token: z.string().max(128).optional(),
        lines: z
          .array(
            z.object({
              sku: z.string().min(1).max(64),
              quantity: z.number().int().min(1).max(10),
              reason: z.enum(RETURN_REASON_VALUES, "Choose a reason"),
              comment: z.string().trim().max(500).optional(),
            }),
          )
          .min(1, "Choose at least one item to return")
          .max(50),
        method: z.enum(["mail", "store"]),
        storeId: z.string().max(64).optional(),
        refundTo: z.enum(["original", "store_credit"]),
      })
      .refine((r) => r.method === "mail" || Boolean(r.storeId), {
        message: "Choose a store",
        path: ["storeId"],
      }),
    access: { public: true },
    handler: async ({ orderId, token, ...request }) => {
      const order = await getAuthorisedOrder(orderId, token);
      if (!order) throw new ActionError("not_found", "We couldn't find that order");
      const created = await requestReturn(order, request);
      return {
        ...created,
        href: `/orders/${order.id}/returns/${created.returnId}?t=${encodeURIComponent(orderAccessToken(order.id))}`,
      };
    },
  });
}
