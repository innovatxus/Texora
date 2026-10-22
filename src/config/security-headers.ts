/**
 * Security headers for every response (spec 10). The Content Security Policy
 * has no nonces, which would force every page to render per request and rule
 * out Partial Prerendering. Inline scripts are therefore allowed, but every
 * other source is limited to this site plus exactly what Stripe (payment
 * fields) and Firebase (direct uploads) need. Pure, so it is unit tested.
 */
export interface SecurityHeaderOptions {
  /** Development server: allows eval (React refresh) and websocket HMR. */
  dev: boolean;
  /** HTTPS deployment: adds HSTS and upgrades stray http requests. */
  https: boolean;
  /** Automated tests: the local Firebase emulators must be reachable. */
  emulators: boolean;
  /** Test deployment: tells crawlers not to index anything. */
  staging: boolean;
}

export function contentSecurityPolicy({ dev, https, emulators }: SecurityHeaderOptions): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": [
      "'self'",
      "'unsafe-inline'",
      "https://js.stripe.com",
      ...(dev ? ["'unsafe-eval'"] : []),
    ],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", "https://*.stripe.com"],
    "font-src": ["'self'"],
    "media-src": ["'self'", "blob:"],
    "connect-src": [
      "'self'",
      "https://*.googleapis.com",
      "https://api.stripe.com",
      ...(emulators ? ["http://127.0.0.1:*", "http://localhost:*"] : []),
      ...(dev ? ["ws:"] : []),
    ],
    "frame-src": ["https://js.stripe.com", "https://hooks.stripe.com"],
    "worker-src": ["'self'", "blob:"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };
  const policy = Object.entries(directives).map(([name, values]) => `${name} ${values.join(" ")}`);
  if (https) policy.push("upgrade-insecure-requests");
  return policy.join("; ");
}

export function securityHeaders(
  options: SecurityHeaderOptions,
): Array<{ key: string; value: string }> {
  return [
    { key: "Content-Security-Policy", value: contentSecurityPolicy(options) },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: 'camera=(), microphone=(), geolocation=(self), payment=(self "https://js.stripe.com")',
    },
    ...(options.https
      ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]
      : []),
    ...(options.staging ? [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] : []),
  ];
}
