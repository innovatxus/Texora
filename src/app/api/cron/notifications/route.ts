import { deliverScheduledGiftCards } from "@/lib/giftcards/service";
import { processAlerts } from "@/lib/notifications/process";
import { isAuthorisedCron } from "@/lib/security/cron";

/**
 * Scheduled hourly: sends back-in-stock and price-drop alerts whose
 * condition is met, and e-gift cards whose delivery date has arrived.
 */
export async function POST(request: Request) {
  if (!isAuthorisedCron(request.headers.get("authorization")))
    return new Response("Unauthorized", { status: 401 });
  const [alerts, giftCards] = await Promise.all([processAlerts(), deliverScheduledGiftCards()]);
  return Response.json({ alerts, giftCardsDelivered: giftCards });
}

/** Vercel Cron calls with GET and `Authorization: Bearer $CRON_SECRET`; same handler and check. */
export const GET = POST;
