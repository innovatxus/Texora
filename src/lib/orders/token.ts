import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/env/server";

/** Signed token that lets a guest open their own confirmation page. */
export function orderAccessToken(orderId: string): string {
  return createHmac("sha256", serverEnv.ORDER_TOKEN_SECRET)
    .update(`order:${orderId}`)
    .digest("base64url");
}

export function verifyOrderAccessToken(orderId: string, token: string | null | undefined): boolean {
  if (!token) return false;
  const expected = Buffer.from(orderAccessToken(orderId));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
