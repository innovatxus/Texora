import { serializeConsent } from "@/lib/consent";
import { analyticsAllowed, dollars, track, trackOnce } from "./events";

const consent = (analytics: boolean) =>
  `tx_consent=${serializeConsent({ analytics, marketing: false })}`;

const event = {
  name: "add_to_cart" as const,
  params: {
    currency: "EGP" as const,
    value: dollars(4800),
    items: [{ item_id: "p1", item_name: "Tee", price: 48, quantity: 1 }],
  },
};

describe("analytics", () => {
  beforeEach(() => {
    window.dataLayer = [];
    sessionStorage.clear();
    document.cookie = "tx_consent=; max-age=0";
  });

  it("reads analytics consent from the cookie", () => {
    expect(analyticsAllowed(consent(true))).toBe(true);
    expect(analyticsAllowed(consent(false))).toBe(false);
    expect(analyticsAllowed("")).toBe(false);
  });

  it("records nothing without consent", () => {
    document.cookie = consent(false);
    expect(track(event)).toBe(false);
    expect(window.dataLayer).toEqual([]);
  });

  it("pushes GA4-style ecommerce events with consent, clearing the last one first", () => {
    document.cookie = consent(true);
    expect(track(event)).toBe(true);
    expect(window.dataLayer).toEqual([
      { ecommerce: null },
      { event: "add_to_cart", ecommerce: event.params },
    ]);
  });

  it("records a purchase once per tab", () => {
    document.cookie = consent(true);
    const purchase = {
      name: "purchase" as const,
      params: {
        currency: "EGP" as const,
        value: 48,
        transaction_id: "TX-100001",
        tax: 0,
        shipping: 0,
        items: [],
      },
    };
    expect(trackOnce("purchase-TX-100001", purchase)).toBe(true);
    expect(trackOnce("purchase-TX-100001", purchase)).toBe(false);
    expect(window.dataLayer?.filter((e) => (e as { event?: string }).event)).toHaveLength(1);
  });

  it("converts cents to dollars", () => {
    expect(dollars(12345)).toBe(123.45);
  });
});
