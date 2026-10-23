import { createHmac } from "node:crypto";
import {
  parsePaymentReference,
  paymentReference,
  readTransaction,
  transactionHmac,
  verifyTransactionHmac,
} from "./paymob";

const SECRET = "test-hmac-secret-0000000000";

const transaction = (overrides: Record<string, unknown> = {}) => ({
  id: 192036465,
  pending: false,
  amount_cents: 129900,
  success: true,
  is_auth: false,
  is_capture: false,
  is_standalone_payment: true,
  is_voided: false,
  is_refunded: false,
  is_3d_secure: true,
  integration_id: 4096,
  has_parent_transaction: false,
  error_occured: false,
  owner: 302852,
  currency: "EGP",
  created_at: "2026-10-22T12:00:00.000000",
  source_data: { pan: "2346", type: "card", sub_type: "MasterCard" },
  order: { id: 217503754, merchant_order_id: "o_abc123DEF_9f8e7d" },
  ...overrides,
});

describe("payment references", () => {
  it("round-trips orders and gift card purchases", () => {
    const order = paymentReference({ kind: "order", id: "abc123DEF" }, "9f8e7d");
    expect(order).toBe("o_abc123DEF_9f8e7d");
    expect(parsePaymentReference(order)).toEqual({ kind: "order", id: "abc123DEF" });
    expect(parsePaymentReference("g_gcp-1b2c_01")).toEqual({ kind: "gift_card", id: "gcp-1b2c" });
  });

  it("rejects anything we didn't issue", () => {
    for (const bad of ["", "x_abc_1", "o_abc", "o_../x_1", null, undefined]) {
      expect(parsePaymentReference(bad)).toBeNull();
    }
  });
});

describe("transaction HMAC", () => {
  it("signs the documented fields in order", () => {
    const tx = transaction();
    const message =
      "1299002026-10-22T12:00:00.000000EGPfalsefalse1920364654096truefalsefalsefalsetruefalse217503754302852false2346MasterCardcardtrue";
    expect(transactionHmac(tx, SECRET)).toBe(
      createHmac("sha512", SECRET).update(message).digest("hex"),
    );
  });

  it("accepts a genuine callback and rejects tampering", () => {
    const tx = transaction();
    const hmac = transactionHmac(tx, SECRET);
    expect(verifyTransactionHmac(tx, hmac, SECRET)).toBe(true);
    expect(verifyTransactionHmac(tx, hmac.toUpperCase(), SECRET)).toBe(true);
    expect(verifyTransactionHmac(transaction({ amount_cents: 100 }), hmac, SECRET)).toBe(false);
    expect(verifyTransactionHmac(tx, hmac, "another-secret-000000000")).toBe(false);
    expect(verifyTransactionHmac(tx, "not-hex", SECRET)).toBe(false);
  });
});

describe("reading transactions", () => {
  it("maps final payments to an outcome", () => {
    expect(readTransaction(transaction())).toEqual({
      subject: { kind: "order", id: "abc123DEF" },
      transactionId: "192036465",
      amount: 129900,
      outcome: "succeeded",
    });
    expect(readTransaction(transaction({ success: false }))?.outcome).toBe("failed");
  });

  it("ignores pending payments, refunds and unknown references", () => {
    expect(readTransaction(transaction({ pending: true }))).toBeNull();
    expect(readTransaction(transaction({ has_parent_transaction: true }))).toBeNull();
    expect(readTransaction(transaction({ is_refunded: true }))).toBeNull();
    expect(
      readTransaction(transaction({ order: { id: 1, merchant_order_id: "elsewhere" } })),
    ).toBeNull();
  });
});
