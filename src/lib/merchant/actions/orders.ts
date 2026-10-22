"use server";

import { z } from "zod";
import { CARRIERS } from "@/config/merchant";
import { ActionError, runAction } from "@/lib/actions/run-action";
import { markShipped } from "../order-service";

/** Marks the merchant's items in an order as shipped, with carrier and tracking. */
export async function markShippedAction(input: unknown) {
  return runAction(input, {
    schema: z.object({
      orderId: z.string().min(1).max(128),
      carrier: z.enum(CARRIERS),
      trackingNumber: z.string().trim().min(4, "Enter the tracking number").max(40),
    }),
    access: { permission: "vendor.orders.read" },
    handler: async ({ orderId, carrier, trackingNumber }, { session }) => {
      if (!session?.vendorId)
        throw new ActionError("forbidden", "You don't have a merchant account");
      const view = await markShipped({ session, vendorId: session.vendorId }, orderId, {
        carrier,
        trackingNumber,
      });
      return { status: view.status };
    },
  });
}
