import { describe, expect, it } from "vitest";
import { hasPermission, requiredPermissionForPath, ROLES } from "@/lib/auth/rbac";
import { ADMIN_NAV } from "./admin-nav";

const items = ADMIN_NAV.flatMap((g) => g.items);

describe("admin navigation", () => {
  it.each(items.map((i) => [i.href, i.permission]))(
    "%s shows for exactly the roles the proxy lets in",
    (href, permission) => {
      expect(requiredPermissionForPath(href)).toBe(permission);
    },
  );

  it("has unique links", () => {
    expect(new Set(items.map((i) => i.href)).size).toBe(items.length);
  });

  it("gives every staff role at least one screen, and customers none", () => {
    for (const role of ROLES) {
      const visible = items.filter((i) => hasPermission(role, i.permission));
      if (role === "guest" || role === "customer" || role === "loyalty_member") {
        expect(visible).toEqual([]);
      } else {
        expect(visible.length).toBeGreaterThan(0);
      }
    }
  });
});
