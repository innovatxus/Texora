import { parseConsent, readConsentCookie, serializeConsent } from "./consent";

describe("consent cookie", () => {
  it("round-trips choices", () => {
    const value = serializeConsent({ analytics: true, marketing: false }, 1000);
    expect(parseConsent(value)).toEqual({
      version: 1,
      analytics: true,
      marketing: false,
      decidedAt: 1000,
    });
  });

  it("reads the consent cookie from a cookie header", () => {
    const header = `a=1; tx_consent=${serializeConsent({ analytics: false, marketing: true }, 5)}; b=2`;
    expect(readConsentCookie(header)).toMatchObject({ analytics: false, marketing: true });
  });

  it("treats missing, malformed or old-version values as no decision", () => {
    expect(parseConsent(undefined)).toBeNull();
    expect(parseConsent("not json")).toBeNull();
    expect(
      parseConsent(
        encodeURIComponent(
          JSON.stringify({ version: 0, analytics: true, marketing: true, decidedAt: 1 }),
        ),
      ),
    ).toBeNull();
    expect(
      parseConsent(encodeURIComponent(JSON.stringify({ version: 1, analytics: "yes" }))),
    ).toBeNull();
  });
});
