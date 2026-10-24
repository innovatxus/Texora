/** Announcement bar messages. Moves to the CMS with the module system (Phase 8). */
export interface Announcement {
  id: string;
  message: string;
  link?: { label: string; href: string };
  /** ISO end time; shows a countdown and hides the message once passed. */
  endsAt?: string;
}

/** Messages rotated in the announcement bar. */
export const ANNOUNCEMENTS: readonly Announcement[] = [
  {
    id: "free-shipping",
    message: "Free standard delivery on orders over EGP 2,500",
    link: { label: "Details", href: "/help/shipping" },
  },
  {
    id: "linen-edit",
    message: "New: The Linen Edit",
    link: { label: "Shop now", href: "/collections/the-linen-edit" },
  },
  {
    id: "rewards",
    message: "Members earn 1 point for every EGP 1. Join Texora Rewards",
    link: { label: "Learn more", href: "/account/rewards" },
  },
];
