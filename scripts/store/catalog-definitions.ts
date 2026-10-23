// Static catalog definitions for the seed. All names and copy are original.
import type { ColorFamily, Department, FitFamily, SizeType } from "../../src/lib/validation";

export interface ColorDefinition {
  code: string;
  name: string;
  family: ColorFamily;
  hex: string;
}

/** Colour palette used across the seeded catalog: code, display name, filter family and swatch hex. */
export const COLORS: readonly ColorDefinition[] = [
  { code: "black", name: "Black", family: "black", hex: "#1c1b1a" },
  { code: "ivory", name: "Ivory", family: "white", hex: "#f2ece0" },
  { code: "optic-white", name: "Optic White", family: "white", hex: "#fbfbf8" },
  { code: "oat", name: "Oat", family: "neutral", hex: "#d8c9ae" },
  { code: "sand", name: "Sand", family: "neutral", hex: "#c9b48f" },
  { code: "camel", name: "Camel", family: "brown", hex: "#b08a5b" },
  { code: "chocolate", name: "Chocolate", family: "brown", hex: "#5a3d2b" },
  { code: "charcoal", name: "Charcoal", family: "grey", hex: "#3f3f3f" },
  { code: "heather-grey", name: "Heather Grey", family: "grey", hex: "#a7a5a1" },
  { code: "navy", name: "Navy", family: "blue", hex: "#1f2a44" },
  { code: "chambray", name: "Chambray", family: "blue", hex: "#7f97b3" },
  { code: "indigo", name: "Indigo", family: "blue", hex: "#2e3a63" },
  { code: "light-wash", name: "Light Wash", family: "blue", hex: "#9fb4c9" },
  { code: "olive", name: "Olive", family: "green", hex: "#5d5d3b" },
  { code: "sage", name: "Sage", family: "green", hex: "#a3ad92" },
  { code: "forest", name: "Forest", family: "green", hex: "#2f4a3a" },
  { code: "burgundy", name: "Burgundy", family: "red", hex: "#5e1f2a" },
  { code: "terracotta", name: "Terracotta", family: "orange", hex: "#b4603f" },
  { code: "blush", name: "Blush", family: "pink", hex: "#e3c3bd" },
  { code: "butter", name: "Butter", family: "yellow", hex: "#ecdca0" },
  { code: "plum", name: "Plum", family: "purple", hex: "#5b3a55" },
  { code: "stripe", name: "Navy Stripe", family: "multi", hex: "#43506b" },
];

/** Size runs per size type, in display order. */
export const SIZE_RUNS = {
  womenAlpha: ["XXS", "XS", "S", "M", "L", "XL", "XXL"],
  menAlpha: ["XS", "S", "M", "L", "XL", "XXL"],
  womenNumeric: ["00", "0", "2", "4", "6", "8", "10", "12", "14", "16"],
  womenDenim: ["24", "25", "26", "27", "28", "29", "30", "31", "32", "33"],
} as const;

/** Men's waist sizes (inches) for pants and jeans. */
export const MEN_WAISTS = ["28", "29", "30", "31", "32", "33", "34", "36", "38"] as const;
/** Inseams per fit family: tall gets the longer lengths. */
export const MEN_INSEAMS: Record<"regular" | "tall", readonly string[]> = {
  regular: ["30", "32"],
  tall: ["34", "36"],
};

export interface CategoryDefinition {
  department: Department;
  slug: string;
  name: string;
  /** Silhouette name used for generated placeholder imagery. */
  garment: string;
  sizeType: SizeType;
  sizeRun: readonly string[] | "men-waist-inseam";
  fitFamilies: readonly FitFamily[];
  /** Base price in dollars; products vary around it. */
  basePrice: number;
  attributes: Record<string, readonly string[]>;
  materials: readonly string[];
  care: readonly string[];
  /** One product per entry: [name, defining attribute values]. */
  products: ReadonlyArray<readonly [string, Record<string, string>]>;
}

const CARE_COTTON = ["Machine wash cold, inside out", "Tumble dry low", "Warm iron if needed"];
const CARE_LINEN = [
  "Machine wash cold on gentle",
  "Line dry",
  "Iron while damp for a crisp finish",
];
const CARE_WOOL = ["Hand wash cold or dry clean", "Dry flat", "Store folded"];
const CARE_DENIM = ["Wash sparingly, inside out", "Machine wash cold", "Hang to dry"];
const CARE_OUTER = ["Dry clean only", "Use a garment brush between wears"];

/** Category tree with garments, materials and price bands that the seed turns into products. */
export const CATEGORIES: readonly CategoryDefinition[] = [
  {
    department: "women",
    slug: "dresses",
    name: "Dresses",
    garment: "dress",
    sizeType: "alpha",
    sizeRun: SIZE_RUNS.womenAlpha,
    fitFamilies: ["regular", "petite", "tall"],
    basePrice: 3_700,
    attributes: { length: ["mini", "midi", "maxi"], sleeve: ["sleeveless", "short", "long"] },
    materials: ["linen", "silk", "cotton poplin", "viscose crepe"],
    care: CARE_LINEN,
    products: [
      ["Linen Midi Shirt Dress", { length: "midi", sleeve: "short", material: "linen" }],
      ["Silk Bias-Cut Slip Dress", { length: "midi", sleeve: "sleeveless", material: "silk" }],
      ["Poplin Tiered Maxi Dress", { length: "maxi", sleeve: "short", material: "cotton poplin" }],
      ["Crepe Wrap Dress", { length: "midi", sleeve: "long", material: "viscose crepe" }],
      ["Linen Square-Neck Mini Dress", { length: "mini", sleeve: "sleeveless", material: "linen" }],
      [
        "Smocked Poplin Midi Dress",
        { length: "midi", sleeve: "sleeveless", material: "cotton poplin" },
      ],
      ["Silk Column Maxi Dress", { length: "maxi", sleeve: "sleeveless", material: "silk" }],
      ["Belted Crepe Shirt Dress", { length: "midi", sleeve: "long", material: "viscose crepe" }],
      ["Puff-Sleeve Linen Dress", { length: "mini", sleeve: "short", material: "linen" }],
      ["Pleated Crepe Maxi Dress", { length: "maxi", sleeve: "long", material: "viscose crepe" }],
      [
        "Halter Poplin Midi Dress",
        { length: "midi", sleeve: "sleeveless", material: "cotton poplin" },
      ],
    ],
  },
  {
    department: "women",
    slug: "tops",
    name: "Tops & Shirts",
    garment: "top",
    sizeType: "alpha",
    sizeRun: SIZE_RUNS.womenAlpha,
    fitFamilies: ["regular", "petite", "tall"],
    basePrice: 1_950,
    attributes: {
      sleeve: ["sleeveless", "short", "long"],
      neckline: ["crew", "v-neck", "collared", "boat"],
    },
    materials: ["cotton poplin", "silk", "linen", "pima cotton"],
    care: CARE_COTTON,
    products: [
      ["Classic Poplin Shirt", { sleeve: "long", neckline: "collared", material: "cotton poplin" }],
      ["Washed Silk Camp Shirt", { sleeve: "short", neckline: "collared", material: "silk" }],
      ["Pima Cotton Boatneck Tee", { sleeve: "long", neckline: "boat", material: "pima cotton" }],
      ["Linen Popover Blouse", { sleeve: "long", neckline: "v-neck", material: "linen" }],
      ["Silk Shell Top", { sleeve: "sleeveless", neckline: "crew", material: "silk" }],
      ["Relaxed Linen Shirt", { sleeve: "long", neckline: "collared", material: "linen" }],
      ["Pima Crew Tee", { sleeve: "short", neckline: "crew", material: "pima cotton" }],
      ["Tie-Neck Silk Blouse", { sleeve: "long", neckline: "v-neck", material: "silk" }],
      [
        "Cropped Poplin Shirt",
        { sleeve: "short", neckline: "collared", material: "cotton poplin" },
      ],
      ["Ribbed Pima Tank", { sleeve: "sleeveless", neckline: "crew", material: "pima cotton" }],
      [
        "Oversized Oxford Shirt",
        { sleeve: "long", neckline: "collared", material: "cotton poplin" },
      ],
    ],
  },
  {
    department: "women",
    slug: "sweaters",
    name: "Sweaters",
    garment: "sweater",
    sizeType: "alpha",
    sizeRun: SIZE_RUNS.womenAlpha,
    fitFamilies: ["regular", "petite", "tall"],
    basePrice: 3_200,
    attributes: { neckline: ["crew", "v-neck", "turtleneck", "cardigan"] },
    materials: ["merino wool", "cashmere", "cotton", "alpaca blend"],
    care: CARE_WOOL,
    products: [
      ["Merino Crew Sweater", { neckline: "crew", material: "merino wool" }],
      ["Cashmere V-Neck Sweater", { neckline: "v-neck", material: "cashmere" }],
      ["Cotton Fisherman Sweater", { neckline: "crew", material: "cotton" }],
      ["Alpaca-Blend Cardigan", { neckline: "cardigan", material: "alpaca blend" }],
      ["Cashmere Turtleneck", { neckline: "turtleneck", material: "cashmere" }],
      ["Merino Polo Sweater", { neckline: "v-neck", material: "merino wool" }],
      ["Ribbed Cotton Cardigan", { neckline: "cardigan", material: "cotton" }],
      ["Cashmere Crew Sweater", { neckline: "crew", material: "cashmere" }],
      ["Alpaca-Blend Mock Neck", { neckline: "turtleneck", material: "alpaca blend" }],
      ["Merino Longline Cardigan", { neckline: "cardigan", material: "merino wool" }],
      ["Open-Stitch Cotton Sweater", { neckline: "crew", material: "cotton" }],
    ],
  },
  {
    department: "women",
    slug: "pants",
    name: "Pants",
    garment: "pants",
    sizeType: "numeric",
    sizeRun: SIZE_RUNS.womenNumeric,
    fitFamilies: ["regular", "petite", "tall"],
    basePrice: 2_750,
    attributes: { rise: ["high", "mid"], leg: ["wide", "straight", "tapered"] },
    materials: ["wool blend", "linen", "cotton twill", "crepe"],
    care: CARE_COTTON,
    products: [
      ["High-Rise Wide-Leg Trouser", { rise: "high", leg: "wide", material: "wool blend" }],
      ["Linen Drawstring Pant", { rise: "mid", leg: "straight", material: "linen" }],
      ["Pleated Twill Trouser", { rise: "high", leg: "tapered", material: "cotton twill" }],
      ["Crepe Pull-On Pant", { rise: "mid", leg: "straight", material: "crepe" }],
      ["Sailor Wide-Leg Pant", { rise: "high", leg: "wide", material: "cotton twill" }],
      ["Slim Ankle Trouser", { rise: "mid", leg: "tapered", material: "wool blend" }],
      ["Linen Palazzo Pant", { rise: "high", leg: "wide", material: "linen" }],
      ["Straight Crepe Trouser", { rise: "high", leg: "straight", material: "crepe" }],
      ["Utility Twill Pant", { rise: "mid", leg: "tapered", material: "cotton twill" }],
      ["Wool-Blend Flare Trouser", { rise: "high", leg: "wide", material: "wool blend" }],
      ["Cropped Linen Trouser", { rise: "mid", leg: "straight", material: "linen" }],
    ],
  },
  {
    department: "women",
    slug: "jeans",
    name: "Jeans",
    garment: "jeans",
    sizeType: "numeric",
    sizeRun: SIZE_RUNS.womenDenim,
    fitFamilies: ["regular", "petite", "tall"],
    basePrice: 2_950,
    attributes: { rise: ["high", "mid"], leg: ["wide", "straight", "slim", "barrel"] },
    materials: ["rigid denim", "stretch denim"],
    care: CARE_DENIM,
    products: [
      ["High-Rise Straight Jean", { rise: "high", leg: "straight", material: "rigid denim" }],
      ["Wide-Leg Jean", { rise: "high", leg: "wide", material: "rigid denim" }],
      ["Mid-Rise Slim Jean", { rise: "mid", leg: "slim", material: "stretch denim" }],
      ["Barrel-Leg Jean", { rise: "high", leg: "barrel", material: "rigid denim" }],
      ["Cropped Straight Jean", { rise: "high", leg: "straight", material: "stretch denim" }],
      ["Sculpt Slim Jean", { rise: "high", leg: "slim", material: "stretch denim" }],
      ["Relaxed Straight Jean", { rise: "mid", leg: "straight", material: "rigid denim" }],
      ["Wide-Leg Trouser Jean", { rise: "high", leg: "wide", material: "stretch denim" }],
      ["Vintage Straight Jean", { rise: "mid", leg: "straight", material: "rigid denim" }],
      ["Ankle Slim Jean", { rise: "mid", leg: "slim", material: "stretch denim" }],
      ["Raw-Hem Barrel Jean", { rise: "high", leg: "barrel", material: "rigid denim" }],
    ],
  },
  {
    department: "women",
    slug: "outerwear",
    name: "Coats & Jackets",
    garment: "coat",
    sizeType: "alpha",
    sizeRun: SIZE_RUNS.womenAlpha,
    fitFamilies: ["regular", "petite"],
    basePrice: 7_450,
    attributes: { length: ["cropped", "hip", "knee", "long"] },
    materials: ["wool", "cotton gabardine", "suede", "quilted nylon"],
    care: CARE_OUTER,
    products: [
      ["Double-Faced Wool Coat", { length: "long", material: "wool" }],
      ["Classic Trench Coat", { length: "knee", material: "cotton gabardine" }],
      ["Suede Shirt Jacket", { length: "hip", material: "suede" }],
      ["Quilted Liner Jacket", { length: "hip", material: "quilted nylon" }],
      ["Wool Car Coat", { length: "knee", material: "wool" }],
      ["Cropped Trench Jacket", { length: "cropped", material: "cotton gabardine" }],
      ["Belted Wool Wrap Coat", { length: "long", material: "wool" }],
      ["Suede Bomber", { length: "cropped", material: "suede" }],
      ["Longline Quilted Coat", { length: "long", material: "quilted nylon" }],
      ["Collarless Wool Jacket", { length: "hip", material: "wool" }],
      ["Unlined Gabardine Blazer", { length: "hip", material: "cotton gabardine" }],
    ],
  },
  {
    department: "men",
    slug: "shirts",
    name: "Shirts",
    garment: "shirt",
    sizeType: "alpha",
    sizeRun: SIZE_RUNS.menAlpha,
    fitFamilies: ["regular", "tall"],
    basePrice: 2_250,
    attributes: { cut: ["slim", "standard", "relaxed"], sleeve: ["short", "long"] },
    materials: ["oxford cotton", "linen", "flannel", "poplin"],
    care: CARE_COTTON,
    products: [
      ["Oxford Button-Down Shirt", { cut: "standard", sleeve: "long", material: "oxford cotton" }],
      ["Linen Camp-Collar Shirt", { cut: "relaxed", sleeve: "short", material: "linen" }],
      ["Brushed Flannel Shirt", { cut: "standard", sleeve: "long", material: "flannel" }],
      ["Slim Poplin Dress Shirt", { cut: "slim", sleeve: "long", material: "poplin" }],
      ["Linen Band-Collar Shirt", { cut: "standard", sleeve: "long", material: "linen" }],
      ["Garment-Dyed Oxford Shirt", { cut: "relaxed", sleeve: "long", material: "oxford cotton" }],
      ["Poplin Short-Sleeve Shirt", { cut: "standard", sleeve: "short", material: "poplin" }],
      ["Flannel Overshirt", { cut: "relaxed", sleeve: "long", material: "flannel" }],
      ["Slim Linen Shirt", { cut: "slim", sleeve: "long", material: "linen" }],
      ["Stretch Oxford Shirt", { cut: "slim", sleeve: "long", material: "oxford cotton" }],
      ["Striped Poplin Shirt", { cut: "standard", sleeve: "long", material: "poplin" }],
    ],
  },
  {
    department: "men",
    slug: "tees-polos",
    name: "Tees & Polos",
    garment: "tee",
    sizeType: "alpha",
    sizeRun: SIZE_RUNS.menAlpha,
    fitFamilies: ["regular", "tall"],
    basePrice: 1_200,
    attributes: { style: ["tee", "polo", "henley"], sleeve: ["short", "long"] },
    materials: ["pima cotton", "slub cotton", "piqué", "merino"],
    care: CARE_COTTON,
    products: [
      ["Pima Crew Tee", { style: "tee", sleeve: "short", material: "pima cotton" }],
      ["Slub Pocket Tee", { style: "tee", sleeve: "short", material: "slub cotton" }],
      ["Piqué Polo", { style: "polo", sleeve: "short", material: "piqué" }],
      ["Merino Polo", { style: "polo", sleeve: "short", material: "merino" }],
      ["Waffle Henley", { style: "henley", sleeve: "long", material: "slub cotton" }],
      ["Long-Sleeve Pima Tee", { style: "tee", sleeve: "long", material: "pima cotton" }],
      ["Johnny-Collar Polo", { style: "polo", sleeve: "short", material: "piqué" }],
      ["Heavyweight Tee", { style: "tee", sleeve: "short", material: "pima cotton" }],
      ["Merino Henley", { style: "henley", sleeve: "long", material: "merino" }],
      ["Long-Sleeve Piqué Polo", { style: "polo", sleeve: "long", material: "piqué" }],
      ["Garment-Dyed Slub Tee", { style: "tee", sleeve: "short", material: "slub cotton" }],
    ],
  },
  {
    department: "men",
    slug: "sweaters",
    name: "Sweaters",
    garment: "sweater",
    sizeType: "alpha",
    sizeRun: SIZE_RUNS.menAlpha,
    fitFamilies: ["regular", "tall"],
    basePrice: 3_200,
    attributes: { neckline: ["crew", "v-neck", "quarter-zip", "cardigan", "turtleneck"] },
    materials: ["merino wool", "cashmere", "cotton", "lambswool"],
    care: CARE_WOOL,
    products: [
      ["Merino Crew Sweater", { neckline: "crew", material: "merino wool" }],
      ["Cashmere Crew Sweater", { neckline: "crew", material: "cashmere" }],
      ["Merino Quarter-Zip", { neckline: "quarter-zip", material: "merino wool" }],
      ["Lambswool Shawl Cardigan", { neckline: "cardigan", material: "lambswool" }],
      ["Cotton Waffle Crew", { neckline: "crew", material: "cotton" }],
      ["Cashmere Turtleneck", { neckline: "turtleneck", material: "cashmere" }],
      ["Merino V-Neck Sweater", { neckline: "v-neck", material: "merino wool" }],
      ["Cable-Knit Lambswool Crew", { neckline: "crew", material: "lambswool" }],
      ["Cotton Quarter-Zip", { neckline: "quarter-zip", material: "cotton" }],
      ["Merino Cardigan", { neckline: "cardigan", material: "merino wool" }],
      ["Lambswool Rollneck", { neckline: "turtleneck", material: "lambswool" }],
    ],
  },
  {
    department: "men",
    slug: "pants",
    name: "Pants & Chinos",
    garment: "pants",
    sizeType: "waist_inseam",
    sizeRun: "men-waist-inseam",
    fitFamilies: ["regular", "tall"],
    basePrice: 2_450,
    attributes: { cut: ["slim", "straight", "relaxed"], style: ["chino", "trouser", "drawstring"] },
    materials: ["cotton twill", "wool blend", "linen", "corduroy"],
    care: CARE_COTTON,
    products: [
      ["Slim Stretch Chino", { cut: "slim", style: "chino", material: "cotton twill" }],
      ["Straight Chino", { cut: "straight", style: "chino", material: "cotton twill" }],
      ["Pleated Wool Trouser", { cut: "relaxed", style: "trouser", material: "wool blend" }],
      ["Linen Drawstring Pant", { cut: "relaxed", style: "drawstring", material: "linen" }],
      ["Wide-Wale Corduroy Pant", { cut: "straight", style: "trouser", material: "corduroy" }],
      ["Slim Wool Trouser", { cut: "slim", style: "trouser", material: "wool blend" }],
      ["Relaxed Pleated Chino", { cut: "relaxed", style: "chino", material: "cotton twill" }],
      ["Travel Trouser", { cut: "slim", style: "trouser", material: "wool blend" }],
      ["Linen Trouser", { cut: "straight", style: "trouser", material: "linen" }],
      ["Garment-Dyed Chino", { cut: "straight", style: "chino", material: "cotton twill" }],
      ["Corduroy Drawstring Pant", { cut: "relaxed", style: "drawstring", material: "corduroy" }],
    ],
  },
  {
    department: "men",
    slug: "jeans",
    name: "Jeans",
    garment: "jeans",
    sizeType: "waist_inseam",
    sizeRun: "men-waist-inseam",
    fitFamilies: ["regular", "tall"],
    basePrice: 2_750,
    attributes: { cut: ["slim", "straight", "relaxed", "tapered"] },
    materials: ["selvedge denim", "stretch denim", "rigid denim"],
    care: CARE_DENIM,
    products: [
      ["Slim Selvedge Jean", { cut: "slim", material: "selvedge denim" }],
      ["Straight Rigid Jean", { cut: "straight", material: "rigid denim" }],
      ["Athletic Taper Jean", { cut: "tapered", material: "stretch denim" }],
      ["Relaxed Straight Jean", { cut: "relaxed", material: "rigid denim" }],
      ["Slim Stretch Jean", { cut: "slim", material: "stretch denim" }],
      ["Straight Selvedge Jean", { cut: "straight", material: "selvedge denim" }],
      ["Tapered Rigid Jean", { cut: "tapered", material: "rigid denim" }],
      ["Relaxed Carpenter Jean", { cut: "relaxed", material: "rigid denim" }],
      ["Slim Black Jean", { cut: "slim", material: "stretch denim" }],
      ["Straight Light-Wash Jean", { cut: "straight", material: "stretch denim" }],
      ["Tapered Selvedge Jean", { cut: "tapered", material: "selvedge denim" }],
    ],
  },
  {
    department: "men",
    slug: "outerwear",
    name: "Coats & Jackets",
    garment: "coat",
    sizeType: "alpha",
    sizeRun: SIZE_RUNS.menAlpha,
    fitFamilies: ["regular", "tall"],
    basePrice: 7_450,
    attributes: { length: ["hip", "thigh", "knee"] },
    materials: ["wool", "waxed cotton", "suede", "quilted nylon"],
    care: CARE_OUTER,
    products: [
      ["Wool Topcoat", { length: "knee", material: "wool" }],
      ["Waxed Field Jacket", { length: "thigh", material: "waxed cotton" }],
      ["Suede Trucker Jacket", { length: "hip", material: "suede" }],
      ["Quilted Vest", { length: "hip", material: "quilted nylon" }],
      ["Wool Peacoat", { length: "thigh", material: "wool" }],
      ["Waxed Harrington Jacket", { length: "hip", material: "waxed cotton" }],
      ["Unstructured Wool Blazer", { length: "hip", material: "wool" }],
      ["Quilted Field Jacket", { length: "thigh", material: "quilted nylon" }],
      ["Suede Overshirt", { length: "hip", material: "suede" }],
      ["Wool Overcoat", { length: "knee", material: "wool" }],
      ["Waxed Mac", { length: "knee", material: "waxed cotton" }],
    ],
  },
];

/** The three physical stores: address, coordinates, phone and time zone. */
export const STORES = [
  {
    id: "zamalek",
    name: "Texora Zamalek",
    address: {
      line1: "26 July Street",
      city: "Zamalek",
      region: "C",
      postalCode: "11211",
      country: "EG",
    },
    geo: { lat: 30.0618, lng: 31.2193 },
    phone: "+20 2 2735 0141",
    timezone: "Africa/Cairo",
  },
  {
    id: "new-cairo",
    name: "Texora New Cairo",
    address: {
      line1: "90th Street, Fifth Settlement",
      city: "New Cairo",
      region: "C",
      postalCode: "11835",
      country: "EG",
    },
    geo: { lat: 30.0283, lng: 31.47 },
    phone: "+20 2 2812 0188",
    timezone: "Africa/Cairo",
  },
  {
    id: "alexandria",
    name: "Texora Alexandria",
    address: {
      line1: "Fouad Street",
      city: "Alexandria",
      region: "ALX",
      postalCode: "21131",
      country: "EG",
    },
    geo: { lat: 31.199, lng: 29.903 },
    phone: "+20 3 486 0129",
    timezone: "Africa/Cairo",
  },
] as const;

/** Review titles and bodies by sentiment, combined at random for seeded reviews. */
export const REVIEW_SNIPPETS = {
  positive: [
    [
      "Wear it constantly",
      "The fabric has a lovely weight and it has kept its shape through a lot of washes.",
    ],
    [
      "Better than expected",
      "The cut is clean and the colour is exactly as pictured. Already ordered a second.",
    ],
    [
      "A new favourite",
      "Comfortable from the first wear and it looks polished at the office and on weekends.",
    ],
    [
      "Beautifully made",
      "The stitching and finishing are lovely. It feels far more expensive than it is.",
    ],
    ["Great everyday piece", "Easy to style and it travels well without wrinkling much."],
  ],
  mixed: [
    [
      "Nice, but check the size",
      "Quality is good. I'd consider sizing based on the fit notes before ordering.",
    ],
    [
      "Good fabric, odd length",
      "The material is lovely, though the length was not quite right for me.",
    ],
  ],
  negative: [
    ["Not for me", "The fabric was thinner than I hoped and it didn't drape the way I expected."],
  ],
} as const;

/** First names for seeded reviewer display names. */
export const FIRST_NAMES = [
  "Amara",
  "Jonah",
  "Priya",
  "Mateo",
  "Ines",
  "Theo",
  "Hana",
  "Lucas",
  "Zoe",
  "Owen",
  "Mina",
  "Elias",
  "Noor",
  "Felix",
  "Sofia",
  "Kai",
  "Leila",
  "Marcus",
  "Ana",
  "Ravi",
] as const;
/** Last-name initials for seeded reviewer display names. */
export const LAST_INITIALS = [
  "A",
  "B",
  "C",
  "D",
  "F",
  "G",
  "H",
  "K",
  "L",
  "M",
  "N",
  "P",
  "R",
  "S",
  "T",
  "W",
] as const;
