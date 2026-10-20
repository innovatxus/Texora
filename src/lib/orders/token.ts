import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/env/server";

/** What a signed link unlocks. The purpose is part of the signature, so tokens can't be reused across them. */
export type TokenPurpose = "order" | "gift-card-purchase" | "unsubscribe";

/** Signed, non-expiring capability token for links in emails and guest pages. */
export function signToken(purpose: TokenPurpose, id: string): string {
  return createHmac("sha256", serverEnv.ORDER_TOKEN_SECRET)
    .update(`${purpose}:${id}`)
    .digest("base64url");
}

export function verifyToken(
  purpose: TokenPurpose,
  id: string,
  token: string | null | undefined,
): boolean {
  if (!token) return false;
  const expected = Buffer.from(signToken(purpose, id));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** Signed token that lets a guest open their own order pages. */
export function orderAccessToken(orderId: string): string {
  return signToken("order", orderId);
}

export function verifyOrderAccessToken(orderId: string, token: string | null | undefined): boolean {
  return verifyToken("order", orderId, token);
}
