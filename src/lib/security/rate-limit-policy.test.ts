import { rateLimitDocId, RATE_LIMITS, windowStart } from "./rate-limit-policy";

describe("windowStart", () => {
  it("aligns to fixed windows", () => {
    const at = new Date("2026-10-20T10:07:42Z");
    expect(new Date(windowStart(at, 60)).toISOString()).toBe("2026-10-20T10:07:00.000Z");
    expect(new Date(windowStart(at, 15 * 60)).toISOString()).toBe("2026-10-20T10:00:00.000Z");
    expect(new Date(windowStart(at, 60 * 60)).toISOString()).toBe("2026-10-20T10:00:00.000Z");
  });

  it("starts a new window at the boundary", () => {
    const end = new Date("2026-10-20T10:15:00Z");
    expect(windowStart(end, 15 * 60)).toBe(end.getTime());
  });
});

describe("rateLimitDocId", () => {
  it("hashes the identifier so emails and IPs are never stored", () => {
    const id = rateLimitDocId("signInAccount", "ada@example.com", 0);
    expect(id).not.toContain("ada");
    expect(id).toMatch(/^signInAccount_[0-9a-f]{32}_0$/);
  });

  it("ignores identifier case and separates actions and windows", () => {
    expect(rateLimitDocId("register", "Ada@Example.com", 0)).toBe(
      rateLimitDocId("register", "ada@example.com", 0),
    );
    expect(rateLimitDocId("register", "x", 0)).not.toBe(rateLimitDocId("availability", "x", 0));
    expect(rateLimitDocId("register", "x", 0)).not.toBe(rateLimitDocId("register", "x", 1));
  });
});

describe("RATE_LIMITS", () => {
  it("locks an account after five failed sign-ins for 15 minutes", () => {
    expect(RATE_LIMITS.signInAccount).toEqual({ limit: 5, windowSeconds: 900 });
  });

  it("allows one verification resend a minute", () => {
    expect(RATE_LIMITS.verifyResend).toEqual({ limit: 1, windowSeconds: 60 });
  });
});
