import type { Metadata } from "next";
import { forbidden } from "next/navigation";

/** Title only: Next.js marks 403 responses noindex itself. */
export const metadata: Metadata = { title: "Access denied" };

/**
 * Target of the proxy's rewrite for signed-in users without permission.
 * forbidden() renders forbidden.tsx with a real 403 status; a rewrite's own
 * status isn't kept once the target page renders.
 */
export default function AccessDeniedPage() {
  forbidden();
}
