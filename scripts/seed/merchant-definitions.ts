// Seed merchants: three approved shops (one each of brand, boutique and
// designer), one waiting for review and one with changes requested. Shared by
// the seed and the placeholder generator (which draws each shop's logo and banner).
import type { FitFamily } from "@/lib/validation/common";
import type { ShopAccent, ShopType } from "@/config/merchant";

export interface SeedLocation {
  name: string;
  types: Array<"retail" | "ship_from">;
  line1: string;
  city: string;
  region: string;
  postalCode: string;
  timezone: string;
  geo: { lat: number; lng: number };
  phone: string;
}

export interface SeedProductLine {
  categoryKey: string;
  /** Placeholder garment drawing (public/media/placeholders/{garment}-{colour}-{view}.svg). */
  garment: string;
  names: readonly string[];
  /** Colour codes from catalog-definitions COLORS. */
  colors: readonly string[];
  materials: ReadonlyArray<{ material: string; percent: number }>;
  attributes: Record<string, string>;
  /** Price in dollars. */
  price: number;
  care: readonly string[];
}

export interface SeedMerchant {
  key: string;
  username: string;
  displayName: string;
  shop: {
    name: string;
    slug: string;
    tagline: string;
    description: string;
    shopType: ShopType;
    accent: ShopAccent;
    /** Logo and banner colours for the drawn placeholders. */
    palette: { ground: string; ink: string };
    monogram: string;
    departments: Array<"women" | "men">;
    website: string;
    instagram: string;
    processingTime: "1-2" | "3-5" | "5-10";
    returnWindow: 0 | 14 | 30 | 60 | null;
  };
  status: "approved" | "pending_review" | "changes_requested";
  trusted: boolean;
  fits: readonly FitFamily[];
  sizes: readonly string[];
  locations: readonly SeedLocation[];
  lines: readonly SeedProductLine[];
  /** For "changes_requested": what the reviewer asked for. */
  reasons?: readonly string[];
}

const ALPHA = ["XS", "S", "M", "L", "XL", "XXL"] as const;

export const SEED_MERCHANTS: readonly SeedMerchant[] = [
  {
    key: "harbor-pine",
    username: "harborpine",
    displayName: "Owen Marsh",
    shop: {
      name: "Harbor & Pine",
      slug: "harbor-and-pine",
      tagline: "Coastal workwear, made to last",
      description:
        "Harbor & Pine makes heavyweight shirts, knits and jackets in small runs from our Portland workshop. Every piece is cut for daily wear and mended for free.",
      shopType: "brand",
      accent: "harbour",
      palette: { ground: "#1f3a4a", ink: "#f2ece0" },
      monogram: "H&P",
      departments: ["men"],
      website: "https://harborandpine.example",
      instagram: "harborandpine",
      processingTime: "1-2",
      returnWindow: 60,
    },
    status: "approved",
    trusted: true,
    fits: ["regular", "tall"],
    sizes: ALPHA,
    locations: [
      {
        name: "Fore Street flagship",
        types: ["retail", "ship_from"],
        line1: "212 Fore St",
        city: "Portland",
        region: "ME",
        postalCode: "04101",
        timezone: "America/New_York",
        geo: { lat: 43.6573, lng: -70.2523 },
        phone: "+12075550142",
      },
      {
        name: "Lewiston workshop",
        types: ["ship_from"],
        line1: "35 Canal St",
        city: "Lewiston",
        region: "ME",
        postalCode: "04240",
        timezone: "America/New_York",
        geo: { lat: 44.0979, lng: -70.2201 },
        phone: "+12075550188",
      },
    ],
    lines: [
      {
        categoryKey: "men/shirts",
        garment: "shirt",
        names: ["Dockside Oxford Shirt", "Chamois Work Shirt", "Mariner Twill Overshirt"],
        colors: ["chambray", "navy", "oat"],
        materials: [{ material: "cotton", percent: 100 }],
        attributes: { cut: "standard", sleeve: "long", closure: "button" },
        price: 98,
        care: ["Machine wash cold", "Hang to dry"],
      },
      {
        categoryKey: "men/tees-polos",
        garment: "tee",
        names: ["Pocket Tee", "Heavyweight Henley", "Harbor Polo"],
        colors: ["heather-grey", "navy", "olive"],
        materials: [{ material: "organic cotton", percent: 100 }],
        attributes: { style: "tee", sleeve: "short" },
        price: 42,
        care: ["Machine wash cold", "Tumble dry low"],
      },
      {
        categoryKey: "men/sweaters",
        garment: "sweater",
        names: ["Fisherman Crew", "Lambswool Shawl Cardigan", "Rib Mockneck"],
        colors: ["ivory", "charcoal", "forest"],
        materials: [{ material: "wool", percent: 100 }],
        attributes: { neckline: "crew", season: "autumn-winter" },
        price: 148,
        care: ["Hand wash cold", "Dry flat"],
      },
      {
        categoryKey: "men/outerwear",
        garment: "coat",
        names: ["Waxed Field Jacket", "Chore Coat", "Quilted Liner Vest"],
        colors: ["olive", "navy", "camel"],
        materials: [
          { material: "cotton", percent: 80 },
          { material: "nylon", percent: 20 },
        ],
        attributes: { length: "hip", closure: "zip" },
        price: 228,
        care: ["Spot clean", "Re-wax once a year"],
      },
    ],
  },
  {
    key: "maison-rue",
    username: "maisonrue",
    displayName: "Camille Laurent",
    shop: {
      name: "Maison Rue",
      slug: "maison-rue",
      tagline: "Linen and silk for long, warm days",
      description:
        "Maison Rue is a Brooklyn boutique for easy dresses and tops in natural fibres, chosen by Camille from small European ateliers and our own studio.",
      shopType: "boutique",
      accent: "clay",
      palette: { ground: "#b4603f", ink: "#fbfbf8" },
      monogram: "MR",
      departments: ["women"],
      website: "https://maisonrue.example",
      instagram: "maison.rue",
      processingTime: "1-2",
      returnWindow: 30,
    },
    status: "approved",
    trusted: false,
    fits: ["regular", "petite"],
    sizes: ALPHA,
    locations: [
      {
        name: "Atlantic Avenue boutique",
        types: ["retail", "ship_from"],
        line1: "318 Atlantic Ave",
        city: "Brooklyn",
        region: "NY",
        postalCode: "11201",
        timezone: "America/New_York",
        geo: { lat: 40.6879, lng: -73.9876 },
        phone: "+17185550123",
      },
      {
        name: "Red Hook stockroom",
        types: ["ship_from"],
        line1: "160 Van Brunt St",
        city: "Brooklyn",
        region: "NY",
        postalCode: "11231",
        timezone: "America/New_York",
        geo: { lat: 40.6829, lng: -74.0081 },
        phone: "+17185550177",
      },
    ],
    lines: [
      {
        categoryKey: "women/dresses",
        garment: "dress",
        names: [
          "Linen Midi Dress",
          "Tiered Sundress",
          "Silk Slip Dress",
          "Smocked Maxi Dress",
          "Wrap Day Dress",
        ],
        colors: ["sand", "terracotta", "black"],
        materials: [{ material: "linen", percent: 100 }],
        attributes: { length: "midi", sleeve: "short", occasion: "everyday" },
        price: 168,
        care: ["Machine wash cold, gentle", "Line dry"],
      },
      {
        categoryKey: "women/tops",
        garment: "top",
        names: [
          "Gauze Peasant Blouse",
          "Silk Shell Top",
          "Linen Boat-Neck Tee",
          "Poplin Camp Shirt",
        ],
        colors: ["ivory", "blush", "sage"],
        materials: [
          { material: "linen", percent: 55 },
          { material: "cotton", percent: 45 },
        ],
        attributes: { sleeve: "short", neckline: "v-neck" },
        price: 88,
        care: ["Machine wash cold", "Line dry"],
      },
      {
        categoryKey: "women/sweaters",
        garment: "sweater",
        names: ["Cotton Rib Cardigan", "Open-Stitch Crew", "Cashmere V-Neck"],
        colors: ["oat", "butter", "navy"],
        materials: [{ material: "cotton", percent: 100 }],
        attributes: { neckline: "cardigan" },
        price: 128,
        care: ["Hand wash cold", "Dry flat"],
      },
    ],
  },
  {
    key: "studio-ines",
    username: "studioines",
    displayName: "Ines Duarte",
    shop: {
      name: "Studio Ines",
      slug: "studio-ines",
      tagline: "Sculptural tailoring in every size",
      description:
        "Studio Ines is the Los Angeles label of designer Ines Duarte: precise coats, dresses and shirting cut from deadstock wool and silk, graded from XS to XXL with a plus fit.",
      shopType: "designer",
      accent: "plum",
      palette: { ground: "#5b3a55", ink: "#ecdca0" },
      monogram: "SI",
      departments: ["women"],
      website: "https://studioines.example",
      instagram: "studio.ines",
      processingTime: "3-5",
      returnWindow: 14,
    },
    status: "approved",
    trusted: false,
    fits: ["regular", "plus"],
    sizes: ALPHA,
    locations: [
      {
        name: "Arts District atelier",
        types: ["retail", "ship_from"],
        line1: "820 E 3rd St",
        city: "Los Angeles",
        region: "CA",
        postalCode: "90013",
        timezone: "America/Los_Angeles",
        geo: { lat: 34.0453, lng: -118.2363 },
        phone: "+12135550164",
      },
      {
        name: "Vernon studio",
        types: ["ship_from"],
        line1: "4600 S Santa Fe Ave",
        city: "Vernon",
        region: "CA",
        postalCode: "90058",
        timezone: "America/Los_Angeles",
        geo: { lat: 33.9993, lng: -118.2296 },
        phone: "+13235550119",
      },
    ],
    lines: [
      {
        categoryKey: "women/outerwear",
        garment: "coat",
        names: ["Cocoon Wool Coat", "Double-Faced Wrap Coat", "Cropped Boxy Jacket", "Long Trench"],
        colors: ["camel", "charcoal", "burgundy"],
        materials: [
          { material: "wool", percent: 90 },
          { material: "cashmere", percent: 10 },
        ],
        attributes: { length: "knee", closure: "button" },
        price: 420,
        care: ["Dry clean only"],
      },
      {
        categoryKey: "women/dresses",
        garment: "dress",
        names: ["Pleated Column Dress", "Draped Jersey Dress", "Bias Silk Gown", "Shirt Dress"],
        colors: ["black", "plum", "ivory"],
        materials: [{ material: "silk", percent: 100 }],
        attributes: { length: "maxi", sleeve: "long", occasion: "evening" },
        price: 310,
        care: ["Dry clean only"],
      },
      {
        categoryKey: "women/tops",
        garment: "top",
        names: ["Architectural Poplin Shirt", "Silk Tie-Neck Blouse", "Sculpted Shell"],
        colors: ["optic-white", "black", "chocolate"],
        materials: [{ material: "cotton poplin", percent: 100 }],
        attributes: { sleeve: "long", neckline: "collared" },
        price: 185,
        care: ["Machine wash cold", "Iron on medium"],
      },
    ],
  },
  {
    key: "northline",
    username: "northline",
    displayName: "Priya Nair",
    shop: {
      name: "Northline Supply",
      slug: "northline-supply",
      tagline: "Pre-loved outdoor and workwear",
      description:
        "Northline Supply restores and resells quality outdoor and workwear: every piece is cleaned, repaired and graded before it ships from Minneapolis.",
      shopType: "reseller",
      accent: "moss",
      palette: { ground: "#2f4a3a", ink: "#ecdca0" },
      monogram: "NS",
      departments: ["men", "women"],
      website: "https://northlinesupply.example",
      instagram: "northline.supply",
      processingTime: "3-5",
      returnWindow: 14,
    },
    status: "pending_review",
    trusted: false,
    fits: ["regular"],
    sizes: ["S", "M", "L", "XL"],
    locations: [
      {
        name: "Northeast warehouse",
        types: ["ship_from"],
        line1: "1500 Jackson St NE",
        city: "Minneapolis",
        region: "MN",
        postalCode: "55413",
        timezone: "America/Chicago",
        geo: { lat: 44.9993, lng: -93.2484 },
        phone: "+16125550190",
      },
    ],
    lines: [
      {
        categoryKey: "men/outerwear",
        garment: "coat",
        names: ["Restored Canvas Chore Coat", "Vintage Wool Mackinaw"],
        colors: ["camel", "forest"],
        materials: [{ material: "cotton", percent: 100 }],
        attributes: { length: "hip" },
        price: 145,
        care: ["Spot clean"],
      },
    ],
  },
  {
    key: "petal-thread",
    username: "petalthread",
    displayName: "June Okafor",
    shop: {
      name: "Petal & Thread",
      slug: "petal-and-thread",
      tagline: "Florals, mostly",
      description: "Hand-printed florals from our Austin studio.",
      shopType: "boutique",
      accent: "rose",
      palette: { ground: "#e3c3bd", ink: "#5e1f2a" },
      monogram: "P&T",
      departments: ["women"],
      website: "https://petalandthread.example",
      instagram: "petal.and.thread",
      processingTime: "5-10",
      returnWindow: null,
    },
    status: "changes_requested",
    trusted: false,
    fits: ["regular"],
    sizes: ["XS", "S", "M", "L"],
    reasons: [
      "Add a banner image so shoppers recognise your shop",
      "Tell shoppers more about your shop: at least two sentences on what you make",
    ],
    locations: [
      {
        name: "East Austin studio",
        types: ["retail", "ship_from"],
        line1: "1209 E 6th St",
        city: "Austin",
        region: "TX",
        postalCode: "78702",
        timezone: "America/Chicago",
        geo: { lat: 30.2632, lng: -97.7287 },
        phone: "+15125550133",
      },
    ],
    lines: [
      {
        categoryKey: "women/dresses",
        garment: "dress",
        names: ["Block-Print Midi Dress"],
        colors: ["blush"],
        materials: [{ material: "cotton", percent: 100 }],
        attributes: { length: "midi", sleeve: "short", pattern: "floral" },
        price: 138,
        care: ["Machine wash cold"],
      },
    ],
  },
];
