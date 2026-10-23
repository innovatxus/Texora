import { settleGiftCardPurchase } from "@/lib/giftcards/service";
import { serverEnv } from "@/lib/env/server";
import { logger } from "@/lib/observability/logger";
import { settleCardPayment } from "@/lib/orders/payments";
import { readTransaction, verifyTransactionHmac } from "@/lib/payments/paymob";

/**
 * Paymob transaction callback: the only source of truth for online payment
 * outcomes. The HMAC (query string) is verified over the signed fields before
 * anything is acted on. The payment reference names the order or gift card
 * purchase; the amount must match what we asked for.
 */
export async function POST(request: Request) {
  const secret = serverEnv.PAYMOB_HMAC_SECRET;
  const hmac = new URL(request.url).searchParams.get("hmac");
  if (!secret || !hmac) return new Response("Missing signature", { status: 400 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid body", { status: 400 });
  }
  const transaction = (body as { obj?: unknown; type?: string } | null)?.obj;
  if (!transaction || !verifyTransactionHmac(transaction, hmac, secret)) {
    logger.warn("paymob.webhook_rejected");
    return new Response("Invalid signature", { status: 400 });
  }
  if ((body as { type?: string }).type !== "TRANSACTION") return Response.json({ received: true });

  const result = readTransaction(transaction);
  if (!result) return Response.json({ received: true });
  const { subject, transactionId, amount, outcome } = result;
  if (subject.kind === "order") {
    const settled = await settleCardPayment(subject.id, transactionId, outcome, amount);
    logger.info("paymob.payment_settled", { orderId: subject.id, outcome, result: settled });
  } else {
    const settled = await settleGiftCardPurchase(subject.id, outcome, new Date(), amount);
    logger.info("paymob.gift_card_settled", { purchaseId: subject.id, outcome, result: settled });
  }
  return Response.json({ received: true });
}
