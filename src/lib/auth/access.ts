import { hasPermission, requiredPermissionForPath, type Role } from "./rbac";

/** Where signed-out visitors are sent when a page needs an account. */
export const SIGN_IN_PATH = "/auth/signin";
/** Where signed-out visitors to the merchant portal are sent. */
export const MERCHANT_SIGN_IN_PATH = "/merchant/sign-in";
/** Where signed-out visitors to the back office are sent: the team's own sign-in. */
export const STAFF_SIGN_IN_PATH = "/admin/sign-in";
/** Where signed-in users without permission are sent. */
export const ACCESS_DENIED_PATH = "/access-denied";

export type AccessDecision =
  { type: "allow" } | { type: "sign_in"; next: string } | { type: "deny" };

/**
 * Route-level decision used by the proxy. Pure, so it is unit tested.
 * `role` is null when there is no valid session.
 */
export function decideAccess(pathname: string, search: string, role: Role | null): AccessDecision {
  const permission = requiredPermissionForPath(pathname);
  if (!permission) return { type: "allow" };
  if (role === null || role === "guest") return { type: "sign_in", next: `${pathname}${search}` };
  return hasPermission(role, permission) ? { type: "allow" } : { type: "deny" };
}

/** The sign-in page for a protected path: merchants have their own. */
export function signInPathFor(pathname: string): string {
  if (pathname === "/merchant" || pathname.startsWith("/merchant/")) return MERCHANT_SIGN_IN_PATH;
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return STAFF_SIGN_IN_PATH;
  return SIGN_IN_PATH;
}

/** Only same-site relative paths may be used as a post-sign-in redirect. */
export function safeNextPath(value: string | null | undefined, fallback = "/account"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return fallback;
  }
  return value;
}
