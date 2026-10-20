import "server-only";
import { timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/env/server";

/** Scheduled jobs authenticate with `Authorization: Bearer $CRON_SECRET`. */
export function isAuthorisedCron(header: string | null): boolean {
  const secret = serverEnv.CRON_SECRET;
  if (!secret || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
