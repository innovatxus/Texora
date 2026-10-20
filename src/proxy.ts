import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_DENIED_PATH, decideAccess, SIGN_IN_PATH } from "@/lib/auth/access";
import { requiredPermissionForPath } from "@/lib/auth/rbac";
import { SESSION_COOKIE, verifySessionCookie } from "@/lib/auth/session";
import { isKnownPath } from "@/config/routes";

/**
 * Route access: the first of three enforcement points (proxy → Server Actions
 * → Firestore rules). This is an early, optimistic gate; every Server Action
 * and protected page re-checks authorisation itself.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const permission = requiredPermissionForPath(pathname);
  if (!permission) {
    // Unknown top-level paths get a real 404 before any prerendered shell is sent.
    if (!isKnownPath(pathname)) {
      return NextResponse.rewrite(new URL("/_not-found", request.url), { status: 404 });
    }
    return NextResponse.next();
  }

  const cookie = request.cookies.get(SESSION_COOKIE)?.value;
  // Revocation is checked on every mutation; skipping it here keeps navigation fast.
  const session = cookie ? await verifySessionCookie(cookie, { checkRevoked: false }) : null;

  const decision = decideAccess(pathname, search, session?.role ?? null);

  if (decision.type === "sign_in") {
    const url = new URL(SIGN_IN_PATH, request.url);
    url.searchParams.set("next", decision.next);
    const response = NextResponse.redirect(url);
    if (cookie && !session) response.cookies.delete(SESSION_COOKIE);
    return response;
  }

  if (decision.type === "deny") {
    return NextResponse.rewrite(new URL(ACCESS_DENIED_PATH, request.url), { status: 403 });
  }

  return NextResponse.next();
}

/** Which requests the proxy runs on. */
export const config = {
  // Everything except framework assets, media and files with an extension.
  matcher: ["/((?!_next/static|_next/image|media/|.*\\.[a-z0-9]+$).*)"],
};
