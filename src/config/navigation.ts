/**
 * Site navigation. Structure mirrors the seeded category tree; in Phase 8 the
 * merchandising team edits this through the back office.
 */
import { brand } from "./brand";

export interface NavLink {
  label: string;
  href: string;
  /** Visually emphasised (e.g. Sale). */
  tone?: "sale";
}

export interface NavColumn {
  title: string;
  links: NavLink[];
}

export interface NavFeature {
  eyebrow: string;
  title: string;
  href: string;
  image: string;
  imageAlt: string;
}

export interface NavDepartment {
  id: string;
  label: string;
  href: string;
  tone?: "sale";
  /** Mega menu content; departments without it are plain links. */
  menu?: { columns: NavColumn[]; feature: NavFeature };
}

/** Header navigation: departments with their mega menus, plus top-level links. */
export const MAIN_NAV: readonly NavDepartment[] = [
  {
    id: "women",
    label: "Women",
    href: "/women",
    menu: {
      columns: [
        {
          title: "Clothing",
          links: [
            { label: "New arrivals", href: "/collections/new-arrivals" },
            { label: "Dresses", href: "/women/dresses" },
            { label: "Tops & shirts", href: "/women/tops" },
            { label: "Sweaters", href: "/women/sweaters" },
            { label: "Pants", href: "/women/pants" },
            { label: "Jeans", href: "/women/jeans" },
            { label: "Coats & jackets", href: "/women/outerwear" },
            { label: "Shop all women", href: "/women" },
          ],
        },
        {
          title: "Shop by fit",
          links: [
            { label: "Regular", href: "/women?fit=regular" },
            { label: "Petite", href: "/women?fit=petite" },
            { label: "Tall", href: "/women?fit=tall" },
          ],
        },
        {
          title: "Edits",
          links: [
            { label: "The Linen Edit", href: "/collections/the-linen-edit" },
            { label: "Considered Knitwear", href: "/collections/knitwear" },
            { label: "Sale", href: "/sale/women", tone: "sale" },
          ],
        },
      ],
      feature: {
        eyebrow: "The Linen Edit",
        title: "Easy pieces for warm days",
        href: "/collections/the-linen-edit",
        image: "/media/stock/womenDresses-tile.jpg",
        imageAlt: "A woman in a long beige dress",
      },
    },
  },
  {
    id: "men",
    label: "Men",
    href: "/men",
    menu: {
      columns: [
        {
          title: "Clothing",
          links: [
            { label: "New arrivals", href: "/collections/new-arrivals" },
            { label: "Shirts", href: "/men/shirts" },
            { label: "Tees & polos", href: "/men/tees-polos" },
            { label: "Sweaters", href: "/men/sweaters" },
            { label: "Pants & chinos", href: "/men/pants" },
            { label: "Jeans", href: "/men/jeans" },
            { label: "Coats & jackets", href: "/men/outerwear" },
            { label: "Shop all men", href: "/men" },
          ],
        },
        {
          title: "Shop by fit",
          links: [
            { label: "Regular", href: "/men?fit=regular" },
            { label: "Tall", href: "/men?fit=tall" },
          ],
        },
        {
          title: "Edits",
          links: [
            { label: "Considered Knitwear", href: "/collections/knitwear" },
            { label: "Sale", href: "/sale/men", tone: "sale" },
          ],
        },
      ],
      feature: {
        eyebrow: "Outerwear",
        title: "Coats made for the long season",
        href: "/men/outerwear",
        image: "/media/stock/menCoats-tile.jpg",
        imageAlt: "A man in a cream padded jacket",
      },
    },
  },
  { id: "new", label: "New arrivals", href: "/collections/new-arrivals" },
  { id: "knitwear", label: "Knitwear", href: "/collections/knitwear" },
  { id: "sale", label: "Sale", href: "/sale", tone: "sale" },
];

/** Suggested searches shown when the search overlay opens. */
export const POPULAR_SEARCHES = [
  "linen",
  "cashmere",
  "wide-leg",
  "trench",
  "oxford shirt",
  "petite",
] as const;

/** Category shortcuts shown in the search overlay. */
export const POPULAR_CATEGORIES: readonly NavLink[] = [
  { label: "Women's dresses", href: "/women/dresses" },
  { label: "Women's sweaters", href: "/women/sweaters" },
  { label: "Men's shirts", href: "/men/shirts" },
  { label: "Men's outerwear", href: "/men/outerwear" },
];

/** Footer link columns. */
export const FOOTER_COLUMNS: readonly NavColumn[] = [
  {
    title: "Help",
    links: [
      { label: "Help centre", href: "/help" },
      { label: "Track an order", href: "/orders/lookup" },
      { label: "Shipping", href: "/help/shipping" },
      { label: "Returns & exchanges", href: "/help/returns" },
      { label: "Size guides", href: "/help/size-guides" },
    ],
  },
  {
    title: "Account",
    links: [
      { label: "Sign in", href: "/auth/signin" },
      { label: "Create an account", href: "/auth/register" },
      { label: "Texora Rewards", href: "/account/rewards" },
      { label: "Wishlist", href: "/account/wishlist" },
      { label: "Gift cards", href: "/gift-cards" },
    ],
  },
  {
    title: "Stores",
    links: [
      { label: "Find a store", href: "/stores" },
      { label: "Texora Zamalek", href: "/stores/zamalek" },
      { label: "Texora New Cairo", href: "/stores/new-cairo" },
      { label: "Texora Alexandria", href: "/stores/alexandria" },
    ],
  },
  {
    title: "Merchants",
    links: [
      { label: `Sell on ${brand.name}`, href: "/merchants" },
      { label: "Merchant sign in", href: "/merchant/sign-in" },
      { label: "Merchant help", href: "/help/merchants" },
    ],
  },
  {
    title: "About",
    links: [
      { label: "Our story", href: "/help/about" },
      { label: "Materials & care", href: "/help/materials" },
      { label: "Careers", href: "/help/careers" },
    ],
  },
];

export type SocialNetwork =
  "facebook" | "instagram" | "tiktok" | "whatsapp" | "telegram" | "youtube" | "pinterest";

/** A social profile: replace each href with the shop's own page or number. */
export interface SocialLink extends NavLink {
  network: SocialNetwork;
}

/** Social media links in the footer. */
export const SOCIAL_LINKS: readonly SocialLink[] = [
  { network: "facebook", label: "Facebook", href: "https://www.facebook.com/" },
  { network: "instagram", label: "Instagram", href: "https://www.instagram.com/" },
  { network: "tiktok", label: "TikTok", href: "https://www.tiktok.com/" },
  // WhatsApp: https://wa.me/<number in international form, digits only>, e.g. https://wa.me/201012345678
  { network: "whatsapp", label: "WhatsApp", href: "https://wa.me/" },
  { network: "telegram", label: "Telegram", href: "https://t.me/" },
  { network: "youtube", label: "YouTube", href: "https://www.youtube.com/" },
  { network: "pinterest", label: "Pinterest", href: "https://www.pinterest.com/" },
];

/** Legal links in the footer, including the cookie settings control. */
export const LEGAL_LINKS: readonly NavLink[] = [
  { label: "Privacy policy", href: "/help/privacy" },
  { label: "Terms of use", href: "/help/terms" },
  { label: "Accessibility", href: "/help/accessibility" },
  { label: "Cookie settings", href: "#cookie-settings" },
];
