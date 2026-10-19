import { decideAccess, safeNextPath } from "./access";

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
