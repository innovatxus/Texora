import { timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/env/server";
import { releaseExpiredReservations } from "@/lib/orders/payments";

function authorised(header: string | null): boolean {
  const secret = serverEnv.CRON_SECRET;
  if (!secret || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** Scheduled every few minutes: returns stock held by abandoned card payments. */
export async function POST(request: Request) {
  if (!authorised(request.headers.get("authorization")))
    return new Response("Unauthorized", { status: 401 });
  const released = await releaseExpiredReservations();
  return Response.json({ released });
}
