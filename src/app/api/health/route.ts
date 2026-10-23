import { timingSafeEqual } from "node:crypto";
import { connection } from "next/server";

/**
 * Health check. Anyone gets `{ ok }`. With `Authorization: Bearer $CRON_SECRET`
 * it also reports each start-up step (environment, Firebase Admin, a Firestore
 * read) with the error message when one fails. It never returns values,
 * only names and messages. Each step is loaded lazily so a failure in one is
 * reported instead of crashing the route.
 */
export async function GET(request: Request) {
  await connection();
  const steps: Record<string, string> = {};
  const run = async (name: string, step: () => Promise<unknown>) => {
    try {
      await step();
      steps[name] = "ok";
      return true;
    } catch (error) {
      steps[name] = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      return false;
    }
  };

  const envOk = await run("env", () => import("@/lib/env/server"));
  const adminOk =
    envOk &&
    (await run("firebaseAdmin", async () => {
      const { getFirebaseAdmin } = await import("@/lib/firebase/admin");
      getFirebaseAdmin();
    }));
  if (adminOk) {
    await run("firestoreRead", async () => {
      const { getFirebaseAdmin } = await import("@/lib/firebase/admin");
      await getFirebaseAdmin().db.collection("settings").doc("store").get();
    });
  }
  const ok = Object.values(steps).every((s) => s === "ok");

  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${secret ?? ""}`);
  const detailed =
    Boolean(secret) &&
    expected.length === Buffer.byteLength(header) &&
    timingSafeEqual(expected, Buffer.from(header));

  return Response.json(
    detailed
      ? {
          ok,
          steps,
          runtime: process.version,
          region: process.env.VERCEL_REGION ?? null,
          present: Object.fromEntries(
            [
              "FIREBASE_SERVICE_ACCOUNT",
              "FIREBASE_PROJECT_ID",
              "FIREBASE_STORAGE_BUCKET",
              "ORDER_TOKEN_SECRET",
              "STAGING",
              "NEXT_PUBLIC_SITE_URL",
            ].map((key) => [key, Boolean(process.env[key])]),
          ),
        }
      : { ok },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
