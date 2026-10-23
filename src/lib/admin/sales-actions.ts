"use server";

import { z } from "zod";
import { ActionError, runAction } from "@/lib/actions/run-action";
import { sendOrderConfirmation } from "@/lib/orders/notifications";
import { sendReturnInstructions } from "@/lib/returns/request-return";
import {
  addOrderNote,
  addShipment,
  cancelOrder,
  markDelivered,
  markProcessing,
  refundOrder,
  updateShippingAddress,
} from "./order-service";
import { checkoutAddressSchema } from "@/lib/orders/checkout-schema";
import { decideReturn, receiveReturn, refundReturn } from "./return-service";

const id = z.string().min(1).max(128);
const reason = z.string().trim().min(3, "Add a short reason").max(500);
/** Dollars typed by staff → integer cents. */
const dollars = z.coerce
  .number("Enter an amount")
  .positive("Enter an amount above zero")
  .max(1_000_000)
  .transform((v) => Math.round(v * 100));

/** Internal note on an order. */
export async function addOrderNoteAction(input: unknown) {
  return runAction(input, {
    schema: z.object({ orderId: id, text: z.string().trim().min(1, "Write a note").max(2000) }),
    access: { permission: "orders.write" },
    handler: async ({ orderId, text }, { session }) => {
      if (!session) throw new ActionError("unauthenticated", "Sign in again");
      await addOrderNote(session, orderId, text);
      return { saved: true };
    },
  });
}

/** Cancels an unshipped order, refunding anything collected. */
export async function cancelOrderAction(input: unknown) {
  return runAction(input, {
    schema: z.object({ orderId: id, reason }),
    access: { permission: "orders.cancel" },
    handler: async ({ orderId, reason: why }, { session }) => {
      if (!session) throw new ActionError("unauthenticated", "Sign in again");
      await cancelOrder(session, orderId, why);
      return { cancelled: true };
    },
  });
}

/** Corrects the delivery address of an unshipped order (same delivery zone). */
export async function updateShippingAddressAction(input: unknown) {
  return runAction(input, {
    schema: checkoutAddressSchema.extend({ orderId: id }),
    access: { permission: "orders.write" },
    handler: async ({ orderId, ...address }, { session }) => {
      if (!session) throw new ActionError("unauthenticated", "Sign in again");
      await updateShippingAddress(session, orderId, address);
      return { updated: true };
    },
  });
}

/** Refunds an amount; agents are held to the per-order limit from settings. */
export async function refundOrderAction(input: unknown) {
  return runAction(input, {
    schema: z.object({ orderId: id, amount: dollars, reason }),
    access: { permission: "orders.refund" },
    handler: async ({ orderId, amount, reason: why }, { session }) => {
      if (!session) throw new ActionError("unauthenticated", "Sign in again");
      return refundOrder(session, orderId, amount, why);
    },
  });
}

/** Sends the order confirmation email again. */
export async function resendConfirmationAction(input: unknown) {
  return runAction(input, {
    schema: z.object({ orderId: id }),
    access: { permission: "emails.resend" },
    handler: async ({ orderId }) => {
      await sendOrderConfirmation(orderId);
      return { sent: true };
    },
  });
}

/** Fulfilment: picking has started. */
export async function markProcessingAction(input: unknown) {
  return runAction(input, {
    schema: z.object({ orderId: id }),
    access: { permission: "fulfillment.write" },
    handler: async ({ orderId }, { session }) => {
      if (!session) throw new ActionError("unauthenticated", "Sign in again");
      await markProcessing(session, orderId);
      return { done: true };
    },
  });
}

/** Fulfilment: a parcel left with a carrier. */
export async function addShipmentAction(input: unknown) {
  return runAction(input, {
    schema: z.object({
      orderId: id,
      carrier: z.string().trim().min(2, "Enter the carrier").max(60),
      trackingNumber: z.string().trim().min(4, "Enter the tracking number").max(60),
      skus: z
        .union([z.array(z.string().max(64)), z.string().max(2000)])
        .optional()
        .transform((v) =>
          typeof v === "string"
            ? v
                .split(/[\s,]+/)
                .map((s) => s.trim())
                .filter(Boolean)
            : (v ?? []),
        ),
    }),
    access: { permission: "fulfillment.write" },
    handler: async ({ orderId, ...shipment }, { session }) => {
      if (!session) throw new ActionError("unauthenticated", "Sign in again");
      await addShipment(session, orderId, shipment);
      return { shipped: true };
    },
  });
}

/** Fulfilment: every parcel has been delivered. */
export async function markDeliveredAction(input: unknown) {
  return runAction(input, {
    schema: z.object({ orderId: id }),
    access: { permission: "fulfillment.write" },
    handler: async ({ orderId }, { session }) => {
      if (!session) throw new ActionError("unauthenticated", "Sign in again");
      await markDelivered(session, orderId);
      return { delivered: true };
    },
  });
}

/** Approves or denies a requested return. */
export async function decideReturnAction(input: unknown) {
  return runAction(input, {
    schema: z.object({
      returnId: id,
      decision: z.enum(["approved", "denied"]),
      note: z.string().trim().max(500).optional(),
    }),
    access: { permission: "returns.approve" },
    handler: async ({ returnId, decision, note }, { session }) => {
      if (!session) throw new ActionError("unauthenticated", "Sign in again");
      await decideReturn(session, returnId, decision, note ?? "");
      return { decision };
    },
  });
}

/** Receives and inspects a return; resellable units are restocked. */
export async function receiveReturnAction(input: unknown) {
  return runAction(input, {
    schema: z.object({
      returnId: id,
      location: z.string().min(1).max(64),
      conditions: z.record(z.string().max(64), z.enum(["resellable", "damaged"])),
    }),
    access: { permission: "returns.receive" },
    handler: async ({ returnId, ...rest }, { session }) => {
      if (!session) throw new ActionError("unauthenticated", "Sign in again");
      await receiveReturn(session, returnId, rest);
      return { received: true };
    },
  });
}

/** Refunds an inspected return, to the original payment or as store credit. */
export async function refundReturnAction(input: unknown) {
  return runAction(input, {
    schema: z.object({ returnId: id, amount: dollars.optional() }),
    access: { permission: "orders.refund" },
    handler: async ({ returnId, amount }, { session }) => {
      if (!session) throw new ActionError("unauthenticated", "Sign in again");
      return refundReturn(session, returnId, amount);
    },
  });
}

/** Sends the return instructions email again. */
export async function resendReturnInstructionsAction(input: unknown) {
  return runAction(input, {
    schema: z.object({ returnId: id }),
    access: { permission: "emails.resend" },
    handler: async ({ returnId }) => {
      await sendReturnInstructions(returnId);
      return { sent: true };
    },
  });
}
