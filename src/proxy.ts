import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_DENIED_PATH, decideAccess, SIGN_IN_PATH } from "@/lib/auth/access";
import { SESSION_COOKIE, verifySessionCookie } from "@/lib/auth/session";

/**
 * Route access: the first of three enforcement points (proxy → Server Actions
 * → Firestore rules). This is an early, optimistic gate; every Server Action
 * and protected page re-checks authorisation itself.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
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

export const config = {
  matcher: ["/account/:path*", "/admin/:path*"],
};
