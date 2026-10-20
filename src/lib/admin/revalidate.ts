import "server-only";
import { revalidateTag } from "next/cache";
import { logger } from "@/lib/observability/logger";

/**
 * Marks cached storefront data stale after a back office change. Visitors
 * get the old page while the new one renders ("max" profile), so a save
 * never makes the storefront slow. Outside a Next.js request (scripts,
 * tests) there is no cache to invalidate, so failures are logged and ignored.
 */
export function invalidate(...tags: string[]): void {
  for (const tag of tags) {
    try {
      revalidateTag(tag, "max");
    } catch (error) {
      logger.debug("cache.revalidate_skipped", { tag, error });
    }
  }
}
