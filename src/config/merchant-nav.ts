/**
 * Merchant portal navigation (journey §7). Desktop shows every item in the
 * sidebar; mobile shows `mobile` items in the bottom tab bar (thumb zone).
 * Items are added as each portal area is built.
 */
export interface MerchantNavItem {
  href: string;
  label: string;
  /** Shown in the mobile bottom tab bar. */
  mobile: boolean;
}

export const MERCHANT_NAV: readonly MerchantNavItem[] = [
  { href: "/merchant", label: "Home", mobile: true },
  { href: "/merchant/products", label: "Products", mobile: true },
  { href: "/merchant/orders", label: "Orders", mobile: true },
  { href: "/merchant/shop", label: "Shop", mobile: true },
  { href: "/help/merchants", label: "Help", mobile: false },
];
