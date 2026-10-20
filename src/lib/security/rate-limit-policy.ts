import { createHash } from "node:crypto";

/** Limits per action: attempts allowed per fixed window (D-063). Pure, so it is unit tested. */
export const RATE_LIMITS = {
  /** Merchant registrations per IP. */
  register: { limit: 5, windowSeconds: 60 * 60 },
  /** Sign-in attempts per IP. */
  signInIp: { limit: 30, windowSeconds: 15 * 60 },
  /** Failed sign-ins per account before a 15-minute lockout. */
  signInAccount: { limit: 5, windowSeconds: 15 * 60 },
  /** Username and shop address availability checks per IP. */
  availability: { limit: 60, windowSeconds: 60 },
  /** Verification email resends per user. */
  verifyResend: { limit: 1, windowSeconds: 60 },
  /** Password reset emails per IP. */
  passwordReset: { limit: 5, windowSeconds: 60 * 60 },
  /** Media uploads per merchant. */
  upload: { limit: 300, windowSeconds: 60 * 60 },
  /** Publish or submit-for-review attempts per merchant. */
  publish: { limit: 120, windowSeconds: 60 * 60 },
} as const satisfies Record<string, { limit: number; windowSeconds: number }>;

export type RateLimitAction = keyof typeof RATE_LIMITS;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Seconds until the window resets (0 when allowed). */
  retryAfterSeconds: number;
}

/** The start (ms) of the window containing `now`. Pure, so it is unit tested. */
export function windowStart(now: Date, windowSeconds: number): number {
  const size = windowSeconds * 1000;
  return Math.floor(now.getTime() / size) * size;
}

/** The document id for an action, identifier and window. Identifiers are hashed, never stored. */
export function rateLimitDocId(action: RateLimitAction, identifier: string, start: number): string {
  const hash = createHash("sha256")
    .update(`${action}\u0000${identifier.toLowerCase()}`)
    .digest("hex");
  return `${action}_${hash.slice(0, 32)}_${start}`;
}
