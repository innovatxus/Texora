import type { Merchant, MerchantLocation, Shop } from "@/lib/validation/merchant";
import { GOVERNORATES, normalizeEgyptianMobile, toE164 } from "@/config/locale";
import { geocodeByGovernorate, GOVERNORATE_OPTIONS } from "./geo";
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

describe("Egyptian addresses", () => {
  it("covers all 27 governorates once, each with a position", () => {
    expect(GOVERNORATES).toHaveLength(27);
    expect(new Set(GOVERNORATE_OPTIONS.map((g) => g.value)).size).toBe(27);
    for (const g of GOVERNORATES) expect(geocodeByGovernorate(g.code)?.geo).toBeDefined();
  });

  it("gives an approximate position and Cairo time without a provider", () => {
    expect(geocodeByGovernorate("ALX")).toMatchObject({
      timezone: "Africa/Cairo",
      precision: "governorate",
    });
    expect(geocodeByGovernorate("XX")).toBeNull();
  });

  it("normalises Egyptian phone numbers", () => {
    expect(normalizeEgyptianMobile("010 1234 5678")).toBe("+201012345678");
    expect(normalizeEgyptianMobile("+20 115-555-0000")).toBe("+201155550000");
    expect(normalizeEgyptianMobile("0161234567")).toBeNull();
    expect(toE164("02 2735 0000")).toBe("+20227350000");
    expect(toE164("0020 100 000 0000")).toBe("+201000000000");
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
