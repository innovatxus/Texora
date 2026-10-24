import { decideAccess, safeNextPath, signInPathFor } from "./access";

describe("decideAccess", () => {
  it("allows public routes for everyone", () => {
    expect(decideAccess("/women/dresses", "", null)).toEqual({ type: "allow" });
  });

  it("sends signed-out users to sign in, keeping where they were going", () => {
    expect(decideAccess("/account/orders", "?page=2", null)).toEqual({
      type: "sign_in",
      next: "/account/orders?page=2",
    });
    expect(decideAccess("/admin", "", "guest")).toMatchObject({ type: "sign_in" });
  });

  it("denies signed-in users without the route permission", () => {
    expect(decideAccess("/admin", "", "customer")).toEqual({ type: "deny" });
    expect(decideAccess("/admin/pricing", "", "merchandiser")).toEqual({ type: "deny" });
    expect(decideAccess("/admin/audit", "", "customer_service")).toEqual({ type: "deny" });
  });

  it("allows roles holding the route permission", () => {
    expect(decideAccess("/account", "", "customer")).toEqual({ type: "allow" });
    expect(decideAccess("/admin/catalog/p1", "", "merchandiser")).toEqual({ type: "allow" });
    expect(decideAccess("/admin/orders", "", "fulfillment")).toEqual({ type: "allow" });
    expect(decideAccess("/admin/audit", "", "admin")).toEqual({ type: "allow" });
  });
});

describe("merchant routes", () => {
  it("keeps the sign-up and recovery pages public", () => {
    expect(decideAccess("/merchant/register", "", null)).toEqual({ type: "allow" });
    expect(decideAccess("/merchant/sign-in", "", null)).toEqual({ type: "allow" });
  });

  it("lets merchants in and keeps everyone else out", () => {
    expect(decideAccess("/merchant", "", "vendor")).toEqual({ type: "allow" });
    expect(decideAccess("/merchant/products", "", "customer")).toEqual({ type: "deny" });
    expect(decideAccess("/merchant/products", "", "admin")).toEqual({ type: "deny" });
    expect(decideAccess("/admin", "", "vendor")).toEqual({ type: "deny" });
  });

  it("sends signed-out merchants to the merchant sign-in page", () => {
    expect(signInPathFor("/merchant/products")).toBe("/merchant/sign-in");
    expect(signInPathFor("/merchant")).toBe("/merchant/sign-in");
    expect(signInPathFor("/merchants")).toBe("/auth/signin");
    expect(signInPathFor("/account/orders")).toBe("/auth/signin");
  });

  it("sends signed-out staff to the back office sign-in page", () => {
    expect(signInPathFor("/admin")).toBe("/admin/sign-in");
    expect(signInPathFor("/admin/orders/abc")).toBe("/admin/sign-in");
    expect(signInPathFor("/administration")).toBe("/auth/signin");
  });
});

describe("safeNextPath", () => {
  it.each([
    ["/account/orders", "/account/orders"],
    ["https://evil.example", "/account"],
    ["//evil.example", "/account"],
    ["/\\evil.example", "/account"],
    ["", "/account"],
    [null, "/account"],
  ])("%s → %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });
});
