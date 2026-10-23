import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Pure Paymob helpers (no network, no env), unit tested: the reference that
 * ties a payment to an order or gift card purchase, and the HMAC check on
 * transaction callbacks.
 */

export type PaymentSubject = { kind: "order"; id: string } | { kind: "gift_card"; id: string };

/**
 * Paymob's `special_reference` must be unique per payment, so each attempt
 * gets a suffix: "o_<orderId>_<attempt>" or "g_<purchaseId>_<attempt>".
 */
export function paymentReference(subject: PaymentSubject, attempt: string): string {
  return `${subject.kind === "order" ? "o" : "g"}_${subject.id}_${attempt}`;
}

/** The order or gift card purchase a payment reference points to, or null. */
export function parsePaymentReference(reference: string | null | undefined): PaymentSubject | null {
  const match = /^([og])_([A-Za-z0-9-]{1,128})_[A-Za-z0-9]{1,32}$/.exec(reference ?? "");
  if (!match?.[2]) return null;
  return { kind: match[1] === "o" ? "order" : "gift_card", id: match[2] };
}

/** The transaction fields Paymob signs, in the order it concatenates them. */
const HMAC_FIELDS = [
  "amount_cents",
  "created_at",
  "currency",
  "error_occured",
  "has_parent_transaction",
  "id",
  "integration_id",
  "is_3d_secure",
  "is_auth",
  "is_capture",
  "is_refunded",
  "is_standalone_payment",
  "is_voided",
  "order.id",
  "owner",
  "pending",
  "source_data.pan",
  "source_data.sub_type",
  "source_data.type",
  "success",
] as const;

function field(obj: unknown, path: string): string {
  let value: unknown = obj;
  for (const key of path.split(".")) {
    value =
      value && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined;
  }
  if (value === undefined || value === null) return "";
  return typeof value === "object" ? JSON.stringify(value) : String(value as string | number);
}

/** HMAC-SHA512 (hex) of a transaction callback's `obj`, as Paymob computes it. */
export function transactionHmac(transaction: unknown, secret: string): string {
  const message = HMAC_FIELDS.map((path) => field(transaction, path)).join("");
  return createHmac("sha512", secret).update(message).digest("hex");
}

/** Whether a callback's HMAC matches, compared in constant time. */
export function verifyTransactionHmac(transaction: unknown, hmac: string, secret: string): boolean {
  const expected = Buffer.from(transactionHmac(transaction, secret), "hex");
  const given = Buffer.from(hmac.toLowerCase(), "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** What a verified transaction callback means for us. */
export interface TransactionOutcome {
  subject: PaymentSubject;
  transactionId: string;
  amount: number;
  outcome: "succeeded" | "failed";
}

/**
 * Reads a transaction callback: final payments only (not pending, not a
 * refund or void of an earlier transaction) with a reference we issued.
 */
export function readTransaction(transaction: unknown): TransactionOutcome | null {
  if (field(transaction, "pending") !== "false") return null;
  if (field(transaction, "has_parent_transaction") === "true") return null;
  if (field(transaction, "is_refunded") === "true" || field(transaction, "is_voided") === "true")
    return null;
  const subject = parsePaymentReference(field(transaction, "order.merchant_order_id"));
  const transactionId = field(transaction, "id");
  const amount = Number(field(transaction, "amount_cents"));
  if (!subject || !transactionId || !Number.isInteger(amount)) return null;
  return {
    subject,
    transactionId,
    amount,
    outcome: field(transaction, "success") === "true" ? "succeeded" : "failed",
  };
}
