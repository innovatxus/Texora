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
  /** Price in EGP. */
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
    processingTime: "1-2" | "3-5";
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
        "Harbor & Pine makes heavyweight shirts, knits and jackets in small runs from our Alexandria workshop. Every piece is cut for daily wear and mended for free.",
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
        name: "Saad Zaghloul flagship",
        types: ["retail", "ship_from"],
        line1: "14 Saad Zaghloul Street",
        city: "Alexandria",
        region: "ALX",
        postalCode: "21111",
        timezone: "Africa/Cairo",
        geo: { lat: 31.2001, lng: 29.9187 },
        phone: "+2034860142",
      },
      {
        name: "Borg El Arab workshop",
        types: ["ship_from"],
        line1: "Borg El Arab Industrial Zone",
        city: "Borg El Arab",
        region: "ALX",
        postalCode: "21934",
        timezone: "Africa/Cairo",
        geo: { lat: 30.85, lng: 29.58 },
        phone: "+2034590188",
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
        price: 2_450,
        care: ["Machine wash cold", "Hang to dry"],
      },
      {
        categoryKey: "men/tees-polos",
        garment: "tee",
        names: ["Pocket Tee", "Heavyweight Henley", "Harbor Polo"],
        colors: ["heather-grey", "navy", "olive"],
        materials: [{ material: "organic cotton", percent: 100 }],
        attributes: { style: "tee", sleeve: "short" },
        price: 1_050,
        care: ["Machine wash cold", "Tumble dry low"],
      },
      {
        categoryKey: "men/sweaters",
        garment: "sweater",
        names: ["Fisherman Crew", "Lambswool Shawl Cardigan", "Rib Mockneck"],
        colors: ["ivory", "charcoal", "forest"],
        materials: [{ material: "wool", percent: 100 }],
        attributes: { neckline: "crew", season: "autumn-winter" },
        price: 3_700,
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
        price: 5_700,
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
        "Maison Rue is a Zamalek boutique for easy dresses and tops in natural fibres, chosen by Camille from small European ateliers and our own studio.",
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
        name: "Zamalek boutique",
        types: ["retail", "ship_from"],
        line1: "8 Ahmed Heshmat Street",
        city: "Zamalek",
        region: "C",
        postalCode: "11211",
        timezone: "Africa/Cairo",
        geo: { lat: 30.0626, lng: 31.2197 },
        phone: "+20227350123",
      },
      {
        name: "Mazhar Street stockroom",
        types: ["ship_from"],
        line1: "15 Mohamed Mazhar Street",
        city: "Zamalek",
        region: "C",
        postalCode: "11211",
        timezone: "Africa/Cairo",
        geo: { lat: 30.0644, lng: 31.2178 },
        phone: "+20227350177",
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
        price: 4_200,
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
        price: 2_200,
        care: ["Machine wash cold", "Line dry"],
      },
      {
        categoryKey: "women/sweaters",
        garment: "sweater",
        names: ["Cotton Rib Cardigan", "Open-Stitch Crew", "Cashmere V-Neck"],
        colors: ["oat", "butter", "navy"],
        materials: [{ material: "cotton", percent: 100 }],
        attributes: { neckline: "cardigan" },
        price: 3_200,
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
        "Studio Ines is the Cairo label of designer Ines Duarte: precise coats, dresses and shirting cut from deadstock wool and silk, graded from XS to XXL with a plus fit.",
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
        name: "Maadi atelier",
        types: ["retail", "ship_from"],
        line1: "Road 9",
        city: "Maadi",
        region: "C",
        postalCode: "11728",
        timezone: "Africa/Cairo",
        geo: { lat: 29.9602, lng: 31.2569 },
        phone: "+20223580164",
      },
      {
        name: "10th of Ramadan studio",
        types: ["ship_from"],
        line1: "Industrial Zone A1",
        city: "10th of Ramadan",
        region: "SHR",
        postalCode: "44629",
        timezone: "Africa/Cairo",
        geo: { lat: 30.2967, lng: 31.7428 },
        phone: "+20554100119",
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
        price: 10_500,
        care: ["Dry clean only"],
      },
      {
        categoryKey: "women/dresses",
        garment: "dress",
        names: ["Pleated Column Dress", "Draped Jersey Dress", "Bias Silk Gown", "Shirt Dress"],
        colors: ["black", "plum", "ivory"],
        materials: [{ material: "silk", percent: 100 }],
        attributes: { length: "maxi", sleeve: "long", occasion: "evening" },
        price: 7_750,
        care: ["Dry clean only"],
      },
      {
        categoryKey: "women/tops",
        garment: "top",
        names: ["Architectural Poplin Shirt", "Silk Tie-Neck Blouse", "Sculpted Shell"],
        colors: ["optic-white", "black", "chocolate"],
        materials: [{ material: "cotton poplin", percent: 100 }],
        attributes: { sleeve: "long", neckline: "collared" },
        price: 4_600,
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
        "Northline Supply restores and resells quality outdoor and workwear: every piece is cleaned, repaired and graded before it ships from 6th of October.",
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
        name: "October warehouse",
        types: ["ship_from"],
        line1: "26th of July Corridor",
        city: "6th of October",
        region: "GZ",
        postalCode: "12573",
        timezone: "Africa/Cairo",
        geo: { lat: 30.0067, lng: 30.9733 },
        phone: "+20238270190",
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
        price: 3_600,
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
      description: "Hand-printed florals from our Gamaleya studio.",
      shopType: "boutique",
      accent: "rose",
      palette: { ground: "#e3c3bd", ink: "#5e1f2a" },
      monogram: "P&T",
      departments: ["women"],
      website: "https://petalandthread.example",
      instagram: "petal.and.thread",
      processingTime: "3-5",
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
        name: "Gamaleya studio",
        types: ["retail", "ship_from"],
        line1: "El Moez Street",
        city: "Gamaleya",
        region: "C",
        postalCode: "11571",
        timezone: "Africa/Cairo",
        geo: { lat: 30.0507, lng: 31.2616 },
        phone: "+20225910133",
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
        price: 3_450,
        care: ["Machine wash cold"],
      },
    ],
  },
];
