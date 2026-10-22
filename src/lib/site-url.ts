import { clientEnv } from "@/lib/env/client";

/** An absolute URL on this site, for emails and redirects. */
export function siteUrl(path: string): string {
  return new URL(path, clientEnv.NEXT_PUBLIC_SITE_URL).toString();
}
