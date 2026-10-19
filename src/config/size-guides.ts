/** Body measurements (inches) per size, shown in the size guide. */
export interface SizeGuide {
  title: string;
  columns: string[];
  rows: Array<{ size: string; values: string[] }>;
  notes: string[];
}

const WOMEN_ALPHA: SizeGuide = {
  title: "Women's tops, dresses and outerwear",
  columns: ["Bust", "Waist", "Hip"],
  rows: [
    { size: "XXS", values: ["31", "24", "34"] },
    { size: "XS", values: ["32–33", "25–26", "35–36"] },
    { size: "S", values: ["34–35", "27–28", "37–38"] },
    { size: "M", values: ["36–37", "29–30", "39–40"] },
    { size: "L", values: ["38.5–40", "31.5–33", "41.5–43"] },
    { size: "XL", values: ["41.5–43", "34.5–36", "44.5–46"] },
    { size: "XXL", values: ["44.5–46", "37.5–39", "47.5–49"] },
  ],
  notes: [
    "Petite is cut for 5'3\" and under; Tall for 5'9\" and over.",
    "Between sizes? Size up for a relaxed fit.",
  ],
};

const WOMEN_NUMERIC: SizeGuide = {
  title: "Women's pants and jeans",
  columns: ["Waist", "Hip", "Regular inseam"],
  rows: [
    { size: "00 / 24", values: ["24", "34", "30"] },
    { size: "0 / 25", values: ["25", "35", "30"] },
    { size: "2 / 26", values: ["26", "36", "30"] },
    { size: "4 / 27", values: ["27", "37", "30"] },
    { size: "6 / 28", values: ["28", "38", "30.5"] },
    { size: "8 / 29", values: ["29", "39", "30.5"] },
    { size: "10 / 30", values: ["30", "40", "31"] },
    { size: "12 / 31", values: ["31.5", "41.5", "31"] },
    { size: "14 / 32", values: ["33", "43", "31"] },
    { size: "16 / 33", values: ["34.5", "44.5", "31"] },
  ],
  notes: ['Petite inseams are 2" shorter; Tall inseams are 3" longer.'],
};

const MEN_ALPHA: SizeGuide = {
  title: "Men's shirts, knitwear and outerwear",
  columns: ["Chest", "Waist", "Sleeve"],
  rows: [
    { size: "XS", values: ["33–35", "27–29", "32"] },
    { size: "S", values: ["36–38", "29–31", "33"] },
    { size: "M", values: ["39–41", "32–34", "34"] },
    { size: "L", values: ["42–44", "35–37", "35"] },
    { size: "XL", values: ["45–47", "38–40", "36"] },
    { size: "XXL", values: ["48–50", "41–43", "37"] },
  ],
  notes: ['Tall adds 1.5" to body length and 1" to sleeves.'],
};

const MEN_WAIST: SizeGuide = {
  title: "Men's pants and jeans",
  columns: ["Waist", "Hip"],
  rows: ["28", "29", "30", "31", "32", "33", "34", "36", "38"].map((w) => ({
    size: w,
    values: [w, String(Number(w) + 9)],
  })),
  notes: [
    'Sizes read waist × inseam. Regular inseams are 30" and 32"; Tall inseams are 34" and 36".',
  ],
};

export function sizeGuideFor(department: string, sizeType: string): SizeGuide {
  if (department === "men") return sizeType === "waist_inseam" ? MEN_WAIST : MEN_ALPHA;
  return sizeType === "numeric" ? WOMEN_NUMERIC : WOMEN_ALPHA;
}

export const HOW_TO_MEASURE = [
  {
    label: "Bust / chest",
    text: "Around the fullest part, keeping the tape level under your arms.",
  },
  { label: "Waist", text: "Around your natural waistline, the narrowest part of your torso." },
  { label: "Hip", text: "Around the fullest part of your hips, feet together." },
  { label: "Inseam", text: "From the top of your inner thigh to just below the ankle bone." },
];
