import "server-only";
import { headers } from "next/headers";
import { ActionError } from "@/lib/actions/run-action";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import {
  RATE_LIMITS,
  rateLimitDocId,
  windowStart,
  type RateLimitAction,
  type RateLimitResult,
} from "./rate-limit-policy";

export { RATE_LIMITS, type RateLimitAction, type RateLimitResult } from "./rate-limit-policy";

/**
 * Fixed-window rate limits stored in Firestore (D-063), so they hold across
 * server instances. Each window is one document, counted in a transaction,
 * with `expiresAt` for a Firestore TTL policy to delete it afterwards.
 */
const collection = () => getFirebaseAdmin().db.collection("rateLimits");

/** Counts one attempt; `allowed` is false once the window's limit is reached. */
export async function consumeRateLimit(
  action: RateLimitAction,
  identifier: string,
  now: Date = new Date(),
): Promise<RateLimitResult> {
  const { limit, windowSeconds } = RATE_LIMITS[action];
  const start = windowStart(now, windowSeconds);
  const end = start + windowSeconds * 1000;
  const ref = collection().doc(rateLimitDocId(action, identifier, start));
  const retryAfterSeconds = Math.max(1, Math.ceil((end - now.getTime()) / 1000));

  return getFirebaseAdmin().db.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    const count = snapshot.exists ? Number(snapshot.get("count") ?? 0) : 0;
    if (count >= limit) return { allowed: false, remaining: 0, retryAfterSeconds };
    tx.set(ref, {
      action,
      count: count + 1,
      windowStart: new Date(start),
      expiresAt: new Date(end),
    });
    return { allowed: true, remaining: limit - count - 1, retryAfterSeconds: 0 };
  });
}

/** Whether the window is already exhausted, without counting an attempt. */
export async function isRateLimited(
  action: RateLimitAction,
  identifier: string,
  now: Date = new Date(),
): Promise<boolean> {
  const { limit, windowSeconds } = RATE_LIMITS[action];
  const snapshot = await collection()
    .doc(rateLimitDocId(action, identifier, windowStart(now, windowSeconds)))
    .get();
  return snapshot.exists && Number(snapshot.get("count") ?? 0) >= limit;
}

/** Clears the current window, e.g. failed sign-ins after a successful one. */
export async function resetRateLimit(
  action: RateLimitAction,
  identifier: string,
  now: Date = new Date(),
): Promise<void> {
  const { windowSeconds } = RATE_LIMITS[action];
  await collection()
    .doc(rateLimitDocId(action, identifier, windowStart(now, windowSeconds)))
    .delete();
}

/** Copy shown when a limit is hit. */
export const RATE_LIMITED_MESSAGE = "Too many attempts. Wait a minute and try again.";

/** Counts an attempt and throws `limit_exceeded` when the limit is reached. */
export async function enforceRateLimit(
  action: RateLimitAction,
  identifier: string,
  message: string = RATE_LIMITED_MESSAGE,
): Promise<void> {
  const result = await consumeRateLimit(action, identifier);
  if (!result.allowed) throw new ActionError("limit_exceeded", message);
}

/** The caller's IP from proxy headers; "unknown" outside a request or without headers. */
export async function clientIp(): Promise<string> {
  try {
    const h = await headers();
    return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  } catch {
    return "unknown";
  }
}
