import {
  canAssignRole,
  canSystemGrant,
  hasPermission,
  isStaffRole,
  PERMISSIONS,
  permissionsFor,
  requiredPermissionForPath,
  ROLE_PERMISSIONS,
  ROLES,
  rolesWith,
  type Role,
} from "./rbac";

describe("role bundles", () => {
  it("only reference declared permissions and have no duplicates", () => {
    for (const role of ROLES) {
      const perms = ROLE_PERMISSIONS[role];
      expect(new Set(perms).size).toBe(perms.length);
      for (const p of perms) expect(PERMISSIONS).toContain(p);
    }
  });

  it("grant every permission to super_admin", () => {
    expect([...permissionsFor("super_admin")].sort()).toEqual(
      [...PERMISSIONS]
        .filter(
          (p) =>
            !p.startsWith("vendor.") &&
            !p.startsWith("merchant.") &&
            p !== "loyalty.earn" &&
            p !== "loyalty.redeem",
        )
        .sort(),
    );
  });

  it("keep each role inside its brief", () => {
    // Customer service: refunds within a limit, no catalog or pricing edits.
    expect(hasPermission("customer_service", "orders.refund")).toBe(true);
    expect(hasPermission("customer_service", "orders.refund_unlimited")).toBe(false);
    expect(hasPermission("customer_service", "catalog.write")).toBe(false);
    expect(hasPermission("customer_service", "pricing.write")).toBe(false);

    // Merchandiser: catalog and content, but no price changes.
    expect(hasPermission("merchandiser", "catalog.write")).toBe(true);
    expect(hasPermission("merchandiser", "pricing.write")).toBe(false);

    // Pricing manager approves price changes.
    expect(hasPermission("pricing_manager", "pricing.approve")).toBe(true);

    // Only admins manage users; only super_admin exports audit logs.
    expect(rolesWith("users.assign_role")).toEqual(["admin", "super_admin"]);
    expect(rolesWith("audit.export")).toEqual(["super_admin"]);

    // Vendor scope stays separate from the store catalog.
    expect(hasPermission("vendor", "catalog.write")).toBe(false);
    expect(hasPermission("admin", "vendor.catalog.write")).toBe(false);

    // Merchants run their own shop but never enter the back office (D-060).
    expect(hasPermission("vendor", "admin.access")).toBe(false);
    expect(hasPermission("vendor", "merchant.shop.write")).toBe(true);
    expect(hasPermission("vendor", "merchants.review")).toBe(false);
    expect(rolesWith("merchants.manage")).toEqual(["admin", "super_admin"]);
    expect(rolesWith("merchants.review")).toEqual(["merchandiser", "admin", "super_admin"]);
  });

  it("let merchants shop like customers", () => {
    expect(permissionsFor("customer").every((p) => hasPermission("vendor", p))).toBe(true);
  });

  it("layer guest < customer < loyalty member", () => {
    const includes = (a: Role, b: Role) => permissionsFor(a).every((p) => hasPermission(b, p));
    expect(includes("guest", "customer")).toBe(true);
    expect(includes("customer", "loyalty_member")).toBe(true);
    expect(hasPermission("customer", "loyalty.redeem")).toBe(false);
    expect(hasPermission("guest", "account.manage")).toBe(false);
  });

  it("let every staff role reach the back office", () => {
    for (const role of [
      "customer_service",
      "merchandiser",
      "pricing_manager",
      "inventory_manager",
      "fulfillment",
      "admin",
      "super_admin",
    ] as const) {
      expect(hasPermission(role, "admin.access")).toBe(true);
      expect(isStaffRole(role)).toBe(true);
    }
    expect(isStaffRole("vendor")).toBe(false);
    expect(hasPermission("loyalty_member", "admin.access")).toBe(false);
  });
});

describe("canAssignRole", () => {
  const base = { actorUid: "a", targetUid: "b", targetCurrentRole: "customer" as Role };

  it("allows an admin to assign staff roles", () => {
    expect(canAssignRole({ ...base, actorRole: "admin", nextRole: "merchandiser" })).toEqual({
      allowed: true,
    });
  });

  it("blocks roles without users.assign_role", () => {
    expect(canAssignRole({ ...base, actorRole: "customer_service", nextRole: "admin" })).toEqual({
      allowed: false,
      reason: "no_permission",
    });
  });

  it("blocks changing your own role", () => {
    expect(
      canAssignRole({ ...base, targetUid: "a", actorRole: "admin", nextRole: "super_admin" }),
    ).toEqual({
      allowed: false,
      reason: "self_change",
    });
  });

  it("stops admins from granting or touching super_admin", () => {
    expect(canAssignRole({ ...base, actorRole: "admin", nextRole: "super_admin" })).toMatchObject({
      reason: "protected_role",
    });
    expect(
      canAssignRole({
        ...base,
        actorRole: "admin",
        targetCurrentRole: "super_admin",
        nextRole: "customer",
      }),
    ).toMatchObject({ reason: "protected_target" });
  });

  it("lets a super_admin grant super_admin", () => {
    expect(canAssignRole({ ...base, actorRole: "super_admin", nextRole: "super_admin" })).toEqual({
      allowed: true,
    });
  });

  it("never assigns guest", () => {
    expect(canAssignRole({ ...base, actorRole: "super_admin", nextRole: "guest" })).toMatchObject({
      reason: "invalid_role",
    });
  });
});

describe("canSystemGrant", () => {
  it("only turns shoppers into merchants", () => {
    expect(canSystemGrant("customer", "vendor")).toBe(true);
    expect(canSystemGrant("loyalty_member", "vendor")).toBe(true);
    expect(canSystemGrant("customer", "admin")).toBe(false);
    expect(canSystemGrant("merchandiser", "vendor")).toBe(false);
    expect(canSystemGrant("admin", "vendor")).toBe(false);
    expect(canSystemGrant("vendor", "vendor")).toBe(false);
  });
});

describe("requiredPermissionForPath", () => {
  it.each([
    ["/", null],
    ["/women/dresses", null],
    ["/account", "account.manage"],
    ["/account/orders/123", "account.manage"],
    ["/admin", "admin.access"],
    ["/admin/orders/TX-1", "orders.read"],
    ["/admin/audit", "audit.read"],
    ["/administrator", null],
    ["/accounting", null],
    ["/admin/merchants", "merchants.review"],
    ["/merchant", "vendor.catalog.write"],
    ["/merchant/products/p1", "vendor.catalog.write"],
    ["/merchant/register", null],
    ["/merchant/sign-in", null],
    ["/merchant/reset-password", null],
    ["/merchant/verify-email", null],
    ["/merchants", null],
    ["/merchant/registered", "vendor.catalog.write"],
  ])("%s → %s", (path, expected) => {
    expect(requiredPermissionForPath(path)).toBe(expected);
  });
});
