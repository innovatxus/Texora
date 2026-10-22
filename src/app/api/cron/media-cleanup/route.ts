import { cleanupStaleMedia } from "@/lib/merchant/media/media-service";
import { isAuthorisedCron } from "@/lib/security/cron";

/**
 * Scheduled hourly: deletes merchant uploads that were never used and media
 * replaced more than 24 hours ago, from Storage and Firestore.
 */
export async function POST(request: Request) {
  if (!isAuthorisedCron(request.headers.get("authorization")))
    return new Response("Unauthorized", { status: 401 });
  return Response.json(await cleanupStaleMedia());
}
