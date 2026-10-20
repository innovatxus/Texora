import { settleGiftCardPurchase } from "@/lib/giftcards/service";
import { logger } from "@/lib/observability/logger";
import { settleCardPayment } from "@/lib/orders/payments";
import { verifyStripeWebhook } from "@/lib/payments/provider";

/**
 * Stripe webhook: the only source of truth for card payment outcomes.
 * The signature is verified against the raw body before anything is read.
 * Intents carry either an orderId or a giftCardPurchaseId in their metadata.
 */
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });

  let event;
  try {
    event = verifyStripeWebhook(await request.text(), signature);
  } catch (error) {
    logger.warn("stripe.webhook_rejected", { error });
    return new Response("Invalid signature", { status: 400 });
  }

  if (event.type === "payment_intent.succeeded" || event.type === "payment_intent.payment_failed") {
    const intent = event.data.object;
    const outcome = event.type === "payment_intent.succeeded" ? "succeeded" : "failed";
    const { orderId, giftCardPurchaseId } = intent.metadata;
    if (orderId) {
      const result = await settleCardPayment(orderId, intent.id, outcome);
      logger.info("stripe.payment_settled", { orderId, outcome, result });
    } else if (giftCardPurchaseId) {
      const result = await settleGiftCardPurchase(giftCardPurchaseId, outcome);
      logger.info("stripe.gift_card_settled", { giftCardPurchaseId, outcome, result });
    }
  }
  return Response.json({ received: true });
}
