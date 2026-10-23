import { contentSecurityPolicy, securityHeaders } from "./security-headers";

const base = { dev: false, https: true, emulators: false, staging: false };
const header = (key: string, opts = base) =>
  securityHeaders(opts).find((h) => h.key === key)?.value;

describe("security headers", () => {
  it("locks the page down to this site and Firebase", () => {
    const csp = contentSecurityPolicy(base);
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-src 'none'");
    expect(csp).not.toContain("stripe");
    expect(csp).toContain("https://*.googleapis.com");
    expect(csp).toContain("upgrade-insecure-requests");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).not.toContain("127.0.0.1");
  });

  it("only opens up for development and the test emulators", () => {
    const csp = contentSecurityPolicy({ ...base, dev: true, https: false, emulators: true });
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).toContain("http://127.0.0.1:*");
    expect(csp).not.toContain("upgrade-insecure-requests");
  });

  it("adds HSTS on HTTPS and noindex on staging", () => {
    expect(header("Strict-Transport-Security")).toMatch(/max-age=\d+/);
    expect(header("Strict-Transport-Security", { ...base, https: false })).toBeUndefined();
    expect(header("X-Robots-Tag", { ...base, staging: true })).toBe("noindex, nofollow");
    expect(header("X-Robots-Tag")).toBeUndefined();
    expect(header("X-Content-Type-Options")).toBe("nosniff");
  });
});
