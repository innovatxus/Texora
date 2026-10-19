import { DEPARTMENTS } from "@/lib/validation/common";

/**
 * Top-level route folders that exist under src/app (any route group).
 * The proxy answers 404 for any other first path segment, because with
 * Partial Prerendering a dynamic route's fallback shell would otherwise be
 * served with status 200. routes.test.ts keeps this list in sync with src/app.
 */
export const STATIC_TOP_LEVEL_ROUTES = [
  "access-denied",
  "api",
  "bag",
  "checkout",
  "collections",
  "order-confirmation",
  "product",
  "sale",
  "search",
  "styleguide",
] as const;

const KNOWN_FIRST_SEGMENTS = new Set<string>([...STATIC_TOP_LEVEL_ROUTES, ...DEPARTMENTS]);

/** True for paths whose first segment is a real route (or a file / framework path). */
export function isKnownPath(pathname: string): boolean {
  const first = pathname.split("/")[1] ?? "";
  if (first === "" || first.startsWith("_next") || first.includes(".")) return true;
  return KNOWN_FIRST_SEGMENTS.has(decodeURIComponent(first));
}
