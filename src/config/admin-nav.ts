import type { Permission } from "@/lib/auth/rbac";

export interface AdminNavItem {
  href: string;
  label: string;
  /** Hidden from roles without it; the page enforces the same permission. */
  permission: Permission;
}

export interface AdminNavGroup {
  title: string;
  items: AdminNavItem[];
}

/** Back office navigation, grouped by area. Keep in sync with ROUTE_PERMISSIONS in rbac.ts. */
export const ADMIN_NAV: readonly AdminNavGroup[] = [
  {
    title: "Overview",
    items: [{ href: "/admin", label: "Dashboard", permission: "admin.access" }],
  },
  {
    title: "Sales",
    items: [
      { href: "/admin/orders", label: "Orders", permission: "orders.read" },
      { href: "/admin/fulfillment", label: "Fulfilment", permission: "fulfillment.write" },
      { href: "/admin/returns", label: "Returns", permission: "returns.read" },
      { href: "/admin/customers", label: "Customers", permission: "customers.read" },
    ],
  },
  {
    title: "Catalog",
    items: [
      { href: "/admin/catalog", label: "Products", permission: "catalog.read_drafts" },
      { href: "/admin/categories", label: "Categories", permission: "merch.write" },
      { href: "/admin/inventory", label: "Inventory", permission: "inventory.read" },
      { href: "/admin/reviews", label: "Reviews", permission: "reviews.moderate" },
      { href: "/admin/content", label: "Content", permission: "content.write" },
    ],
  },
  {
    title: "Marketplace",
    items: [
      { href: "/admin/merchants", label: "Merchant shops", permission: "merchants.review" },
      {
        href: "/admin/merchants/products",
        label: "Product reviews",
        permission: "merchants.review",
      },
    ],
  },
  {
    title: "Pricing",
    items: [
      { href: "/admin/pricing", label: "Price changes", permission: "pricing.write" },
      { href: "/admin/promotions", label: "Promotions", permission: "promotions.write" },
    ],
  },
  {
    title: "Administration",
    items: [
      { href: "/admin/users", label: "Users & roles", permission: "users.read" },
      { href: "/admin/settings", label: "Settings", permission: "settings.read" },
      { href: "/admin/audit", label: "Audit log", permission: "audit.read" },
      { href: "/admin/emails", label: "Email outbox", permission: "emails.outbox.read" },
    ],
  },
];
