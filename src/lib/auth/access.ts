import { hasPermission, requiredPermissionForPath, type Role } from "./rbac";

/** Where signed-out visitors are sent when a page needs an account. */
export const SIGN_IN_PATH = "/auth/signin";
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

/** Only same-site relative paths may be used as a post-sign-in redirect. */
export function safeNextPath(value: string | null | undefined, fallback = "/account"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return fallback;
  }
  return value;
}
