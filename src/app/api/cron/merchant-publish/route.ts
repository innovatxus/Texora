import { publishDueProducts } from "@/lib/merchant/publishing/publish";
import { isAuthorisedCron } from "@/lib/security/cron";

/** Scheduled every 15 minutes: merchant products whose publish time has come go live. */
export async function POST(request: Request) {
  if (!isAuthorisedCron(request.headers.get("authorization")))
    return new Response("Unauthorized", { status: 401 });
  return Response.json({ published: await publishDueProducts() });
}

/** Vercel Cron calls with GET and `Authorization: Bearer $CRON_SECRET`; same handler and check. */
export const GET = POST;
