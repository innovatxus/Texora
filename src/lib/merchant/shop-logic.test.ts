import type { Merchant, MerchantLocation, Shop } from "@/lib/validation/merchant";
import { geocodeByState, US_STATES, usState, zipMatchesState } from "./geo";
import { nextStep, setupChecklist, shopBlockers } from "./onboarding";
import {
  assertShopTransition,
  canTransitionProduct,
  canTransitionShop,
  isShopVisible,
  TransitionError,
} from "./status";

describe("shop status machine", () => {
  it("lets merchants submit and admins decide", () => {
    expect(canTransitionShop("draft", "pending_review", "merchant")).toBe(true);
    expect(canTransitionShop("pending_review", "approved", "admin")).toBe(true);
    expect(canTransitionShop("pending_review", "changes_requested", "admin")).toBe(true);
    expect(canTransitionShop("changes_requested", "pending_review", "merchant")).toBe(true);
  });

  it("never lets a merchant approve, reinstate or suspend", () => {
    expect(canTransitionShop("pending_review", "approved", "merchant")).toBe(false);
    expect(canTransitionShop("suspended", "approved", "merchant")).toBe(false);
    expect(canTransitionShop("approved", "suspended", "merchant")).toBe(false);
    expect(() => assertShopTransition("draft", "approved", "merchant")).toThrow(TransitionError);
  });

  it("allows closing and reopening by the merchant", () => {
    expect(canTransitionShop("approved", "closed", "merchant")).toBe(true);
    expect(canTransitionShop("closed", "approved", "merchant")).toBe(true);
    expect(canTransitionShop("suspended", "closed", "merchant")).toBe(false);
  });

  it("only shows approved shops", () => {
    expect(isShopVisible("approved")).toBe(true);
    for (const s of [
      "draft",
      "pending_review",
      "changes_requested",
      "suspended",
      "closed",
    ] as const) {
      expect(isShopVisible(s)).toBe(false);
    }
  });
});

describe("product status machine", () => {
  it("routes untrusted merchants through review", () => {
    expect(canTransitionProduct("draft", "in_review", "merchant")).toBe(true);
    expect(canTransitionProduct("in_review", "live", "merchant")).toBe(false);
    expect(canTransitionProduct("in_review", "live", "admin")).toBe(true);
    expect(canTransitionProduct("scheduled", "live", "system")).toBe(true);
    expect(canTransitionProduct("archived", "live", "merchant")).toBe(false);
  });
});

describe("US addresses", () => {
  it("covers every state and DC once", () => {
    expect(US_STATES).toHaveLength(51);
    expect(new Set(US_STATES.map((s) => s.code)).size).toBe(51);
  });

  it("matches ZIP codes to states", () => {
    expect(zipMatchesState("10012", "NY")).toBe(true);
    expect(zipMatchesState("78701", "TX")).toBe(true);
    expect(zipMatchesState("02108", "MA")).toBe(true);
    expect(zipMatchesState("05501", "MA")).toBe(true);
    expect(zipMatchesState("10012", "CA")).toBe(false);
    expect(zipMatchesState("ABCDE", "NY")).toBe(false);
  });

  it("gives an approximate position and timezone without a provider", () => {
    expect(geocodeByState("az")).toMatchObject({ timezone: "America/Phoenix", precision: "state" });
    expect(geocodeByState("XX")).toBeNull();
    expect(usState("il")?.name).toBe("Illinois");
  });
});

const merchant = (emailVerified: boolean): Pick<Merchant, "emailVerified"> => ({ emailVerified });
const location = (
  types: MerchantLocation["types"],
  status: MerchantLocation["status"] = "active",
) => ({ types, status }) as MerchantLocation;
const shop = (extra: Partial<Shop> = {}) =>
  ({
    logo: { mediaId: "m1" },
    banner: { mediaId: "m2" },
    completedSteps: ["basics", "branding", "contact"],
    status: "draft",
    ...extra,
  }) as unknown as Shop;

describe("shopBlockers", () => {
  it("lists everything missing, with where to fix it", () => {
    expect(shopBlockers(merchant(false), null, []).map((b) => b.key)).toEqual(["email", "basics"]);
    const blockers = shopBlockers(
      merchant(true),
      shop({ logo: undefined, banner: undefined, completedSteps: ["basics"] }),
      [location(["retail"])],
    );
    expect(blockers.map((b) => b.message)).toEqual([
      "Add a logo",
      "Add a banner",
      "Add your contact details and policies",
      "Add a ship-from location",
    ]);
    expect(blockers[0]?.href).toBe("/merchant/onboarding/branding");
  });

  it("is empty when the shop is ready", () => {
    expect(shopBlockers(merchant(true), shop(), [location(["retail", "ship_from"])])).toEqual([]);
  });

  it("ignores archived ship-from locations", () => {
    expect(
      shopBlockers(merchant(true), shop(), [location(["ship_from"], "archived")]).map((b) => b.key),
    ).toEqual(["location"]);
  });
});

describe("steps and checklist", () => {
  it("moves through the steps in order", () => {
    expect(nextStep("basics")).toBe("branding");
    expect(nextStep("locations")).toBe("review");
    expect(nextStep("review")).toBe("review");
  });

  it("ticks checklist items from real state", () => {
    const items = setupChecklist(merchant(true), shop({ status: "pending_review" }), [], 2);
    expect(items.map((i) => i.done)).toEqual([true, true, false, true, true]);
  });
});
