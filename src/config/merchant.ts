/**
 * Merchant programme configuration: limits, reserved names, size runs, shop
 * accents and the landing page copy. Shared by client forms, Server Actions,
 * Zod schemas and the `/merchants` page, so every rule lives in one place.
 */
import type { SizeType } from "@/lib/validation/common";
import { brand } from "./brand";
import { STATIC_TOP_LEVEL_ROUTES } from "./routes";

const MB = 1024 * 1024;

/** Every numeric limit in the merchant journey. */
export const MERCHANT_LIMITS = {
  username: { min: 3, max: 30, changeEveryDays: 30 },
  password: { minLength: 12, minScore: 3 },
  shop: {
    nameMin: 2,
    nameMax: 60,
    slugMin: 3,
    slugMax: 40,
    taglineMax: 80,
    descriptionMax: 1500,
    /** The data model allows more; the portal caps each merchant at this many shops. */
    maxPerMerchant: 3,
    /** A closed shop can be reopened for this many days. */
    reopenWithinDays: 30,
    returnNotesMax: 500,
  },
  logo: { minWidth: 512, minHeight: 512, maxBytes: 5 * MB },
  banner: { minWidth: 2400, minHeight: 800, aspect: 3, maxBytes: 10 * MB },
  productImage: { minLongEdge: 1600, aspect: 3 / 4, maxBytes: 15 * MB, maxPerColor: 12 },
  productVideo: { maxSeconds: 30, maxBytes: 100 * MB },
  product: {
    nameMax: 120,
    descriptionMax: 4000,
    highlightsMax: 6,
    highlightMax: 160,
    keywordsMax: 20,
    /** Upper bound on generated variants per product (colours × fits × sizes). */
    maxVariants: 600,
  },
  location: { maxPerShop: 20, rangesPerDay: 2, specialHoursMax: 60 },
  timing: {
    availabilityDebounceMs: 300,
    autosaveIdleMs: 5000,
    verifyResendCooldownSeconds: 60,
  },
  /** Temporary uploads that were never attached are deleted after this long. */
  tmpMediaMaxAgeHours: 24,
} as const;

/** Where new shop submissions and merchant questions go. */
export const MERCHANT_TEAM_EMAIL = "merchants@texora.example";

/** File types accepted per upload kind (checked again from the file's bytes on the server). */
export const MEDIA_TYPES = {
  logo: ["image/png", "image/jpeg", "image/webp", "image/svg+xml"],
  banner: ["image/png", "image/jpeg", "image/webp"],
  productImage: ["image/jpeg", "image/png", "image/webp", "image/avif"],
  productVideo: ["video/mp4", "video/webm"],
} as const;

export type MediaKind = keyof typeof MEDIA_TYPES;

/** Words no username or shop address may use: platform names, roles and every route. */
export const RESERVED_NAMES: ReadonlySet<string> = new Set([
  ...STATIC_TOP_LEVEL_ROUTES,
  "women",
  "men",
  "merchant",
  "merchants",
  "shop",
  "shops",
  "admin",
  "administrator",
  "root",
  "staff",
  "support",
  "help",
  "helpdesk",
  "contact",
  "about",
  "legal",
  "terms",
  "privacy",
  "security",
  "billing",
  "payments",
  "payouts",
  "official",
  "team",
  "system",
  "moderator",
  "texora",
  brand.name.toLowerCase(),
  "null",
  "undefined",
  "www",
  "mail",
  "email",
  "static",
  "media",
  "assets",
  "new",
  "edit",
  "settings",
  "account",
  "login",
  "logout",
  "signin",
  "sign-in",
  "signup",
  "sign-up",
  "register",
]);

/** Whether a username or shop address is reserved (also blocks names containing the brand). */
export function isReservedName(value: string): boolean {
  const lower = value.toLowerCase();
  return RESERVED_NAMES.has(lower) || lower.includes(brand.name.toLowerCase());
}

/** What kind of seller a shop is. */
export const SHOP_TYPES = [
  { value: "brand", label: "Brand", description: "You design and make your own label" },
  { value: "boutique", label: "Boutique", description: "You curate several labels" },
  { value: "designer", label: "Designer", description: "Independent designer, small runs" },
  { value: "reseller", label: "Reseller", description: "Pre-owned or vintage" },
] as const;

export type ShopType = (typeof SHOP_TYPES)[number]["value"];

/**
 * The curated shop accents. Each maps to a `--color-shop-*` token in
 * `src/styles/tokens.css`; `npm run contrast` checks every one for AA as text on
 * the page and as a button with white text. No free colour input.
 */
export const SHOP_ACCENTS = [
  { key: "ink", label: "Ink" },
  { key: "moss", label: "Moss" },
  { key: "clay", label: "Clay" },
  { key: "harbour", label: "Harbour" },
  { key: "plum", label: "Plum" },
  { key: "saffron", label: "Saffron" },
  { key: "rose", label: "Rose" },
  { key: "slate", label: "Slate" },
] as const;

export type ShopAccent = (typeof SHOP_ACCENTS)[number]["key"];

/** The CSS colour for an accent, for inline styles in previews and shop pages. */
export function accentColor(accent: ShopAccent): string {
  return `var(--color-shop-${accent})`;
}

/** How long a shop takes to send an order. */
export const PROCESSING_TIMES = [
  { value: "1-2", label: "1–2 business days" },
  { value: "3-5", label: "3–5 business days" },
] as const;

export type ProcessingTime = (typeof PROCESSING_TIMES)[number]["value"];

/** Texora's returns policy: every shop uses it (shops can't set their own). */
export const PLATFORM_RETURN_POLICY = {
  windowDays: 30,
  summary: "30-day returns, unworn with tags",
} as const;

/** Types of merchant location. There is no pickup (D-071). */
export const LOCATION_TYPES = [
  { value: "retail", label: "Retail store", description: "Shoppers can visit" },
  { value: "ship_from", label: "Warehouse / ship-from", description: "Orders ship from here" },
] as const;

export type LocationType = (typeof LOCATION_TYPES)[number]["value"];

/** Carriers a merchant can choose when marking an order shipped. */
export const CARRIERS = ["USPS", "UPS", "FedEx", "DHL", "Other"] as const;

/** Handle formats per social network (without the @). */
export const SOCIAL_HANDLE_PATTERNS = {
  instagram: /^(?!.*\.\.)(?!.*\.$)[a-z0-9._]{1,30}$/i,
  tiktok: /^[a-z0-9._]{2,24}$/i,
  facebook: /^[a-z0-9.]{5,50}$/i,
} as const;

export type SocialNetwork = keyof typeof SOCIAL_HANDLE_PATTERNS;

// ------------------------------------------------------------ size runs

/** A preset run of sizes a merchant toggles on or off. */
export interface SizeRun {
  id: string;
  label: string;
  sizes: readonly string[];
  /** Whether merchants may add their own sizes to this run. */
  allowCustom: boolean;
}

const range = (from: number, to: number, step = 1) =>
  Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);

const WAISTS = range(26, 44, 2).map(String);
const INSEAMS = ["28", "30", "32", "34", "36"];

/** Preset size runs for each size type. */
export const SIZE_RUNS: Readonly<Record<SizeType, readonly SizeRun[]>> = {
  alpha: [
    {
      id: "alpha",
      label: "XXS–4XL",
      sizes: ["XXS", "XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL"],
      allowCustom: false,
    },
  ],
  numeric: [
    {
      id: "numeric",
      label: "00–24",
      sizes: ["00", "0", ...range(2, 24, 2).map(String)],
      allowCustom: false,
    },
  ],
  waist_inseam: [
    {
      id: "waist_inseam",
      label: "Waist × inseam",
      sizes: WAISTS.flatMap((w) => INSEAMS.map((i) => `${w}x${i}`)),
      allowCustom: false,
    },
  ],
  shoe: [
    {
      id: "shoe_eu",
      label: "EU 35–47",
      sizes: range(35, 47).map((n) => `EU ${n}`),
      allowCustom: false,
    },
    {
      id: "shoe_us",
      label: "US 5–13",
      sizes: range(5, 13, 0.5).map((n) => `US ${n}`),
      allowCustom: false,
    },
  ],
  one_size: [{ id: "one_size", label: "One size", sizes: ["One size"], allowCustom: true }],
};

// ------------------------------------------------------------ landing page

/** Commission and fee summary shown on the landing page and in the terms. */
export const MERCHANT_FEES = {
  commissionPercent: 15,
  monthlyFee: 0,
  listingFee: 0,
} as const;

/** Copy for `/merchants`. Kept here so marketing can change it without touching JSX. */
export const MERCHANT_LANDING = {
  hero: {
    eyebrow: "For merchants",
    title: `Sell on ${brand.name}`,
    body: "Reach shoppers across Egypt. Your products sell under Texora, and we handle the storefront, delivery and returns.",
    cta: "Open your shop",
    secondary: "Already selling? Sign in",
  },
  steps: [
    { title: "Register", body: "Create your merchant account in two minutes." },
    { title: "Build your shop", body: "Add your logo, banner, locations and policies." },
    {
      title: "List products",
      body: "Add colours, fits and sizes. We handle the storefront, search and checkout.",
    },
  ],
  benefits: [
    {
      title: "Your shop, behind the scenes",
      body: "Set up your branding, story and locations. Your shop page is private to you and the Texora team; shoppers buy from Texora.",
    },
    {
      title: "Nationwide reach",
      body: `Your products appear in ${brand.name} search, filters and category pages next to our own.`,
    },
    {
      title: "Know what's working",
      body: "See live products, low stock and orders at a glance from your dashboard.",
    },
  ],
  requirements: [
    "A business or sole trader in Egypt with a ship-from address in Egypt",
    "Original goods, or goods you're authorised to sell",
    "Orders ship within the processing time you choose",
    "Photos of every colour you sell, with alt text",
  ],
  faq: [
    {
      question: "How long does approval take?",
      answer:
        "We review new shops within 1 business day. You can add products while you wait; they go live once your shop is approved.",
    },
    {
      question: "What can I sell?",
      answer:
        "Women's and men's clothing in our categories: tops, dresses, knitwear, trousers, jeans, outerwear and more. Every product needs real photos and accurate sizing.",
    },
    {
      question: "How does shipping work?",
      answer:
        "You ship orders yourself from your warehouse or store, within the processing time you set, and add the carrier and tracking number in your dashboard. Shoppers pay our standard delivery rates at checkout.",
    },
    {
      question: "Who handles returns?",
      answer: `Every shop uses ${brand.name}'s returns policy: 30-day returns, unworn with tags. Shoppers see it on every product, and ${brand.name} handles return requests.`,
    },
    {
      question: "What does it cost?",
      answer: `No monthly or listing fees. We take a ${MERCHANT_FEES.commissionPercent}% commission on each item sold. Payouts are arranged with our merchant team while self-serve payouts are being built.`,
    },
    {
      question: "Can I close my shop?",
      answer:
        "Yes, any time from your settings. Your products are hidden straight away, and you can reopen within 30 days.",
    },
  ],
  finalCta: { title: "Ready when you are.", cta: "Open your shop" },
} as const;
