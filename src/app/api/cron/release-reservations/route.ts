import { releaseExpiredReservations } from "@/lib/orders/payments";
import { isAuthorisedCron } from "@/lib/security/cron";

/** Scheduled every few minutes: returns stock held by abandoned card payments. */
export async function POST(request: Request) {
  if (!isAuthorisedCron(request.headers.get("authorization")))
    return new Response("Unauthorized", { status: 401 });
  const released = await releaseExpiredReservations();
  return Response.json({ released });
}
