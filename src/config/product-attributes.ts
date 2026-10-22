/**
 * What each category asks merchants for in the product editor: the size type,
 * which fits are allowed, whether custom sizes are allowed, and its attribute
 * fields. Attribute keys and values match the storefront filters exactly
 * (`ATTRIBUTE_LABELS` in lib/catalog/listing), so merchant products filter
 * the same way as Texora's own.
 */
import type { FitFamily, SizeType } from "@/lib/validation/common";

export interface AttributeDefinition {
  key: string;
  label: string;
  /** "single": one value; "multi": several. */
  kind: "single" | "multi";
  options: readonly string[];
  required: boolean;
}

export interface CategoryProductConfig {
  categoryKey: string;
  label: string;
  sizeType: SizeType;
  fitFamilies: readonly FitFamily[];
  allowCustomSize: boolean;
  attributes: readonly AttributeDefinition[];
}

/** Fibres for the composition rows (material + %, summing to 100). */
export const MATERIALS = [
  "cotton",
  "organic cotton",
  "pima cotton",
  "cotton poplin",
  "linen",
  "silk",
  "wool",
  "merino",
  "cashmere",
  "alpaca",
  "viscose",
  "viscose crepe",
  "lyocell",
  "modal",
  "polyester",
  "recycled polyester",
  "nylon",
  "elastane",
  "denim",
  "leather",
] as const;

const single = (key: string, label: string, options: readonly string[], required = false) =>
  ({ key, label, kind: "single", options, required }) as const;
const multi = (key: string, label: string, options: readonly string[], required = false) =>
  ({ key, label, kind: "multi", options, required }) as const;

/** Fields every category offers (optional). */
const COMMON: readonly AttributeDefinition[] = [
  single("pattern", "Pattern", ["solid", "stripe", "check", "floral", "print"]),
  multi("occasion", "Occasion", ["everyday", "work", "evening", "holiday"]),
  single("season", "Season", ["all-season", "spring-summer", "autumn-winter"]),
  single("closure", "Closure", ["none", "button", "zip", "tie", "pull-on"]),
];

const WOMEN_FITS: readonly FitFamily[] = ["regular", "petite", "tall", "plus"];
const MEN_FITS: readonly FitFamily[] = ["regular", "tall", "plus"];

export const CATEGORY_PRODUCT_CONFIG: readonly CategoryProductConfig[] = [
  {
    categoryKey: "women/dresses",
    label: "Dresses",
    sizeType: "alpha",
    fitFamilies: WOMEN_FITS,
    allowCustomSize: false,
    attributes: [
      single("length", "Length", ["mini", "midi", "maxi"], true),
      single("sleeve", "Sleeve", ["sleeveless", "short", "long"], true),
      single("neckline", "Neckline", ["crew", "v-neck", "square", "halter", "collared"]),
      ...COMMON,
    ],
  },
  {
    categoryKey: "women/tops",
    label: "Tops & Shirts",
    sizeType: "alpha",
    fitFamilies: WOMEN_FITS,
    allowCustomSize: false,
    attributes: [
      single("sleeve", "Sleeve", ["sleeveless", "short", "long"], true),
      single("neckline", "Neckline", ["crew", "v-neck", "collared", "boat"], true),
      ...COMMON,
    ],
  },
  {
    categoryKey: "women/sweaters",
    label: "Sweaters",
    sizeType: "alpha",
    fitFamilies: WOMEN_FITS,
    allowCustomSize: false,
    attributes: [
      single("neckline", "Neckline", ["crew", "v-neck", "turtleneck", "cardigan"], true),
      ...COMMON,
    ],
  },
  {
    categoryKey: "women/pants",
    label: "Pants",
    sizeType: "numeric",
    fitFamilies: WOMEN_FITS,
    allowCustomSize: false,
    attributes: [
      single("rise", "Rise", ["high", "mid"], true),
      single("leg", "Leg shape", ["wide", "straight", "tapered"], true),
      ...COMMON,
    ],
  },
  {
    categoryKey: "women/jeans",
    label: "Jeans",
    sizeType: "numeric",
    fitFamilies: WOMEN_FITS,
    allowCustomSize: false,
    attributes: [
      single("rise", "Rise", ["high", "mid"], true),
      single("leg", "Leg shape", ["wide", "straight", "slim", "barrel"], true),
      ...COMMON,
    ],
  },
  {
    categoryKey: "women/outerwear",
    label: "Coats & Jackets",
    sizeType: "alpha",
    fitFamilies: WOMEN_FITS,
    allowCustomSize: false,
    attributes: [single("length", "Length", ["cropped", "hip", "knee", "long"], true), ...COMMON],
  },
  {
    categoryKey: "men/shirts",
    label: "Shirts",
    sizeType: "alpha",
    fitFamilies: MEN_FITS,
    allowCustomSize: false,
    attributes: [
      single("cut", "Cut", ["slim", "standard", "relaxed"], true),
      single("sleeve", "Sleeve", ["short", "long"], true),
      ...COMMON,
    ],
  },
  {
    categoryKey: "men/tees-polos",
    label: "Tees & Polos",
    sizeType: "alpha",
    fitFamilies: MEN_FITS,
    allowCustomSize: false,
    attributes: [
      single("style", "Style", ["tee", "polo", "henley"], true),
      single("sleeve", "Sleeve", ["short", "long"], true),
      ...COMMON,
    ],
  },
  {
    categoryKey: "men/sweaters",
    label: "Sweaters",
    sizeType: "alpha",
    fitFamilies: MEN_FITS,
    allowCustomSize: false,
    attributes: [
      single(
        "neckline",
        "Neckline",
        ["crew", "v-neck", "quarter-zip", "cardigan", "turtleneck"],
        true,
      ),
      ...COMMON,
    ],
  },
  {
    categoryKey: "men/pants",
    label: "Pants",
    sizeType: "waist_inseam",
    fitFamilies: MEN_FITS,
    allowCustomSize: false,
    attributes: [
      single("cut", "Cut", ["slim", "straight", "relaxed"], true),
      single("style", "Style", ["chino", "trouser", "drawstring"], true),
      ...COMMON,
    ],
  },
  {
    categoryKey: "men/jeans",
    label: "Jeans",
    sizeType: "waist_inseam",
    fitFamilies: MEN_FITS,
    allowCustomSize: false,
    attributes: [single("cut", "Cut", ["slim", "straight", "relaxed", "tapered"], true), ...COMMON],
  },
  {
    categoryKey: "men/outerwear",
    label: "Coats & Jackets",
    sizeType: "alpha",
    fitFamilies: MEN_FITS,
    allowCustomSize: false,
    attributes: [single("length", "Length", ["hip", "thigh", "knee"], true), ...COMMON],
  },
];

const BY_KEY = new Map(CATEGORY_PRODUCT_CONFIG.map((c) => [c.categoryKey, c]));

/** The editor config for a leaf category, or undefined for one merchants can't use. */
export function productConfigFor(categoryKey: string): CategoryProductConfig | undefined {
  return BY_KEY.get(categoryKey);
}

/** Problems with attribute values for a category: missing required fields or unknown values. */
export function attributeProblems(
  categoryKey: string,
  attributes: Readonly<Record<string, string | readonly string[]>>,
): Array<{ key: string; message: string }> {
  const config = productConfigFor(categoryKey);
  if (!config) return [{ key: "category", message: "Choose a specific category" }];
  const problems: Array<{ key: string; message: string }> = [];
  for (const def of config.attributes) {
    const raw = attributes[def.key];
    const values = raw === undefined ? [] : Array.isArray(raw) ? raw : [raw];
    if (def.required && values.length === 0) {
      problems.push({ key: def.key, message: `Fill in the required attribute: ${def.label}` });
    }
    if (values.some((v) => !def.options.includes(v))) {
      problems.push({ key: def.key, message: `Choose ${def.label.toLowerCase()} from the list` });
    }
  }
  return problems;
}

/** Composition rows must name known materials, have whole percentages and add up to 100. */
export function compositionProblem(
  rows: ReadonlyArray<{ material: string; percent: number }>,
): string | null {
  if (rows.length === 0) return "Add the fabric composition";
  if (rows.some((r) => !(MATERIALS as readonly string[]).includes(r.material))) {
    return "Choose each material from the list";
  }
  if (new Set(rows.map((r) => r.material)).size !== rows.length) {
    return "List each material once";
  }
  if (rows.some((r) => !Number.isInteger(r.percent) || r.percent <= 0)) {
    return "Use whole percentages above 0";
  }
  const total = rows.reduce((sum, r) => sum + r.percent, 0);
  return total === 100 ? null : `Total ${total}% — composition must add up to 100%`;
}

/** "55% linen, 45% cotton" for the product's fabric line. */
export function formatComposition(
  rows: ReadonlyArray<{ material: string; percent: number }>,
): string {
  return [...rows]
    .sort((a, b) => b.percent - a.percent)
    .map((r) => `${r.percent}% ${r.material}`)
    .join(", ");
}
