/** Account sections, in menu order (spec 7.8). */
export const ACCOUNT_NAV = [
  { href: "/account", label: "Overview" },
  { href: "/account/orders", label: "Orders" },
  { href: "/account/returns", label: "Returns" },
  { href: "/account/rewards", label: "Rewards" },
  { href: "/account/wishlist", label: "Wishlist" },
  { href: "/account/addresses", label: "Addresses" },
  { href: "/account/payment-methods", label: "Payment methods" },
  { href: "/account/preferences", label: "Sizes & preferences" },
  { href: "/account/security", label: "Security" },
] as const;
