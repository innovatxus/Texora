// Draws the placeholder product imagery referenced by the seed:
//   public/media/placeholders/{garment}-{colour}-{view}.svg
// Self-drawn flat illustrations (no third-party imagery). Runs before dev/build.
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { CATEGORIES, COLORS } from "./seed/catalog-definitions";

const OUT = fileURLToPath(new URL("../public/media/placeholders/", import.meta.url));
const W = 1200;
const H = 1600;

type View = "model" | "flat" | "detail";

function mix(hex: string, target: string, amount: number): string {
  const parse = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const a = parse(hex);
  const b = parse(target);
  return `#${a
    .map((v, i) =>
      Math.round(v + ((b[i] ?? 0) - v) * amount)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

function luminance(hex: string): number {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

interface Garment {
  /** Main silhouette. */
  body: string;
  /** Darker panels: collars, waistbands, cuffs, lapels. */
  panels?: string;
  /** Seam and stitch lines. */
  lines?: string;
  /** Button / rivet positions. */
  dots?: Array<[number, number]>;
  /** Where the hanger touches the shoulders (y), or null for bottoms (clip hanger). */
  shoulderY: number | null;
}

const GARMENTS: Record<string, Garment> = {
  tee: {
    body: "M430 380 L530 340 Q600 390 670 340 L770 380 L900 530 L820 600 L775 555 L775 1180 L425 1180 L425 555 L380 600 L300 530 Z",
    panels: "M530 340 Q600 390 670 340 L655 333 Q600 372 545 333 Z",
    lines: "M425 1150 L775 1150 M380 600 L425 555 M820 600 L775 555",
    shoulderY: 360,
  },
  shirt: {
    body: "M435 360 L535 330 L600 385 L665 330 L765 360 L860 470 L965 1040 L885 1062 L800 610 L790 1230 L410 1230 L400 610 L315 1062 L235 1040 L340 470 Z",
    panels:
      "M535 330 L600 425 L665 330 L640 312 L600 368 L560 312 Z M235 1040 L315 1062 L305 1010 L245 990 Z M965 1040 L885 1062 L895 1010 L955 990 Z",
    lines: "M600 425 L600 1230 M470 520 L540 520 L540 600 L470 600 Z",
    dots: [
      [600, 500],
      [600, 640],
      [600, 780],
      [600, 920],
      [600, 1060],
    ],
    shoulderY: 345,
  },
  top: {
    body: "M450 370 L545 340 Q600 470 655 340 L750 370 L850 500 L905 860 L830 880 L775 600 L790 1150 Q600 1185 410 1150 L425 600 L370 880 L295 860 L350 500 Z",
    panels: "M545 340 Q600 470 655 340 L640 335 Q600 440 560 335 Z",
    lines: "M425 1110 Q600 1145 775 1110",
    shoulderY: 355,
  },
  sweater: {
    body: "M440 360 L540 335 Q600 375 660 335 L760 360 L865 470 L960 1070 L875 1092 L800 620 L790 1210 L410 1210 L400 620 L325 1092 L240 1070 L335 470 Z",
    panels:
      "M540 335 Q600 375 660 335 L670 355 Q600 400 530 355 Z M410 1150 L790 1150 L790 1210 L410 1210 Z M240 1070 L325 1092 L318 1040 L250 1020 Z M960 1070 L875 1092 L882 1040 L950 1020 Z",
    lines:
      "M450 1160 L450 1205 M500 1160 L500 1205 M550 1160 L550 1205 M600 1160 L600 1205 M650 1160 L650 1205 M700 1160 L700 1205 M750 1160 L750 1205",
    shoulderY: 350,
  },
  dress: {
    body: "M505 300 Q600 345 695 300 L730 330 L705 560 Q695 625 725 665 L915 1420 Q600 1465 285 1420 L475 665 Q505 625 495 560 L470 330 Z",
    panels: "M495 560 Q600 590 705 560 L700 610 Q600 640 500 610 Z",
    lines: "M505 300 L520 230 M695 300 L680 230 M600 640 L600 1440",
    shoulderY: 235,
  },
  pants: {
    body: "M435 300 L765 300 L805 1420 L640 1420 L600 640 L560 1420 L395 1420 Z",
    panels: "M435 300 L765 300 L768 370 L432 370 Z",
    lines: "M600 370 L600 560 M470 420 Q500 470 540 420 M660 420 Q700 470 730 420",
    dots: [[600, 335]],
    shoulderY: null,
  },
  jeans: {
    body: "M435 300 L765 300 L800 1420 L640 1420 L600 640 L560 1420 L400 1420 Z",
    panels: "M435 300 L765 300 L767 360 L433 360 Z",
    lines:
      "M600 360 L600 570 Q590 600 560 610 M455 380 Q490 460 560 440 M745 380 Q710 460 640 440 M520 1380 L440 1380 M760 1380 L680 1380",
    dots: [
      [600, 330],
      [462, 386],
      [738, 386],
    ],
    shoulderY: null,
  },
  coat: {
    body: "M440 300 L540 280 L600 345 L660 280 L760 300 L880 425 L985 1210 L905 1230 L825 650 L835 1450 L365 1450 L375 650 L295 1230 L215 1210 L320 425 Z",
    panels:
      "M540 280 L600 345 L660 280 L700 300 L640 520 L600 470 L560 520 L500 300 Z M215 1210 L295 1230 L288 1170 L225 1150 Z M985 1210 L905 1230 L912 1170 L975 1150 Z",
    lines: "M600 470 L600 1450 M375 880 L825 880",
    dots: [
      [560, 620],
      [640, 620],
      [560, 760],
      [640, 760],
      [560, 1000],
      [640, 1000],
    ],
    shoulderY: 295,
  },
};

function garmentGroup(g: Garment, fill: string) {
  const shade = mix(fill, "#000000", 0.18);
  const line = mix(fill, "#000000", 0.32);
  const light = luminance(fill) > 0.8;
  const outline = light ? `stroke="${mix(fill, "#000000", 0.22)}" stroke-width="3"` : "";
  return [
    `<path d="${g.body}" fill="${fill}" ${outline} stroke-linejoin="round"/>`,
    // A soft vertical highlight so the silhouette reads as fabric, not a flat shape.
    `<path d="${g.body}" fill="url(#sheen)"/>`,
    g.panels ? `<path d="${g.panels}" fill="${shade}"/>` : "",
    g.lines
      ? `<path d="${g.lines}" fill="none" stroke="${line}" stroke-width="4" stroke-linecap="round" stroke-dasharray="${light ? "0" : "14 10"}" opacity="0.75"/>`
      : "",
    ...(g.dots ?? []).map(([x, y]) => `<circle cx="${x}" cy="${y}" r="11" fill="${line}"/>`),
  ].join("");
}

function hanger(g: Garment): string {
  const stroke = `fill="none" stroke="#8c8579" stroke-width="7" stroke-linecap="round"`;
  if (g.shoulderY === null) {
    // Clip hanger for bottoms.
    return `<path d="M600 150 Q600 110 630 110 Q660 110 660 140 M600 150 L600 230 M400 230 L800 230 M440 230 L440 300 M760 230 L760 300" ${stroke}/>`;
  }
  const y = g.shoulderY;
  return `<path d="M600 ${y - 150} Q600 ${y - 190} 630 ${y - 190} Q660 ${y - 190} 660 ${y - 160} M600 ${y - 150} L600 ${y - 115} L380 ${y + 25} M600 ${y - 115} L820 ${y + 25}" ${stroke}/>`;
}

function svg(garmentKey: string, hex: string, view: View): string {
  const g = GARMENTS[garmentKey];
  if (!g) throw new Error(`Unknown garment ${garmentKey}`);
  const defs = `<defs><linearGradient id="sheen" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="0.42" stop-color="#fff" stop-opacity="0.10"/><stop offset="0.6" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.08"/></linearGradient></defs>`;

  if (view === "detail") {
    const base = hex;
    const dark = mix(hex, "#000000", 0.12);
    const lightLine = mix(hex, "#ffffff", 0.12);
    const weave = Array.from({ length: 80 }, (_, i) => {
      const x = i * 40 - 1600;
      return `<path d="M${x} 0 L${x + 1600} ${H}" stroke="${i % 2 ? dark : lightLine}" stroke-width="14" opacity="0.55"/>`;
    }).join("");
    const seam = mix(hex, "#000000", 0.35);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="${base}"/>${weave}<path d="M-20 980 Q600 900 1220 1000" fill="none" stroke="${seam}" stroke-width="6" stroke-dasharray="22 14"/><circle cx="760" cy="620" r="70" fill="${mix(hex, "#000000", 0.2)}"/><circle cx="745" cy="605" r="9" fill="${base}"/><circle cx="775" cy="605" r="9" fill="${base}"/><circle cx="745" cy="635" r="9" fill="${base}"/><circle cx="775" cy="635" r="9" fill="${base}"/></svg>`;
  }

  const bg = view === "model" ? "#ebe6de" : "#f3f0ea";
  const transform =
    view === "flat" ? `transform="translate(600 820) scale(0.86) translate(-600 -820)"` : "";
  const shadow =
    view === "flat"
      ? `<path d="${g.body}" fill="#000" opacity="0.07" transform="translate(616 846) scale(0.86) translate(-600 -820)"/>`
      : `<ellipse cx="600" cy="1530" rx="360" ry="26" fill="#000" opacity="0.06"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">${defs}<rect width="${W}" height="${H}" fill="${bg}"/>${shadow}${view === "model" ? hanger(g) : ""}<g ${transform}>${garmentGroup(g, hex)}</g></svg>`;
}

mkdirSync(OUT, { recursive: true });
const garments = [...new Set(CATEGORIES.map((c) => c.garment))];
let count = 0;
for (const garment of garments) {
  for (const color of COLORS) {
    for (const view of ["model", "flat", "detail"] as const) {
      writeFileSync(`${OUT}${garment}-${color.code}-${view}.svg`, svg(garment, color.hex, view));
      count += 1;
    }
  }
}
// Editorial tiles for the home page and menus.
for (const [name, garment, color] of [
  ["editorial-women", "dress", "oat"],
  ["editorial-men", "coat", "camel"],
  ["editorial-linen", "shirt", "ivory"],
  ["editorial-knitwear", "sweater", "forest"],
] as const) {
  const hex = COLORS.find((c) => c.code === color)?.hex ?? "#c9b48f";
  writeFileSync(`${OUT}${name}.svg`, svg(garment, hex, "model"));
  count += 1;
}
// Editorial scenes: garments hanging from a rail (heroes) and outfits (lookbook).
const hex = (code: string) => COLORS.find((c) => c.code === code)?.hex ?? "#c9b48f";

function scene(
  width: number,
  height: number,
  pieces: ReadonlyArray<readonly [garment: string, color: string]>,
  options: { bg: string; rail: boolean; xStart?: number; heightFrac?: number },
): string {
  // Copy space: garments occupy [xStart, 1] horizontally and the top heightFrac vertically.
  const x0 = width * (options.xStart ?? 0);
  const span = width - x0;
  const heightFrac = options.heightFrac ?? 0.82;
  const n = pieces.length;
  const railY = height * 0.12;
  const groups = pieces
    .map(([garmentKey, color], i) => {
      const g = GARMENTS[garmentKey];
      if (!g) throw new Error(`Unknown garment ${garmentKey}`);
      if (options.rail) {
        // Side by side on a rail; the hook top sits on the rail.
        const scale = Math.min(span / n / 1000, (height * heightFrac) / 1500);
        const cx = x0 + (span / n) * (i + 0.5);
        const hookTop = g.shoulderY === null ? 110 : g.shoulderY - 190;
        const ty = railY - hookTop * scale;
        return `<g transform="translate(${cx - 600 * scale} ${ty}) scale(${scale})">${hanger(g)}${garmentGroup(g, hex(color))}</g>`;
      }
      // Outfit: pieces stacked top to bottom, overlapping slightly like a flat lay.
      const row = height / n;
      const scale = Math.min((width * 0.9) / 1000, (row * 1.15) / 1150);
      const top = g.shoulderY === null ? 300 : g.shoulderY - 30;
      const ty = row * i + height * 0.04 - top * scale;
      return `<g transform="translate(${width / 2 - 600 * scale} ${ty}) scale(${scale})">${garmentGroup(g, hex(color))}</g>`;
    })
    .join("");
  const defs = `<defs><linearGradient id="sheen" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="0.42" stop-color="#fff" stop-opacity="0.10"/><stop offset="0.6" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.08"/></linearGradient><linearGradient id="wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.18"/><stop offset="1" stop-color="#000" stop-opacity="0.05"/></linearGradient></defs>`;
  const rail = options.rail
    ? `<rect x="${Math.max(width * 0.03, x0 - width * 0.02)}" y="${railY - 8}" width="${width * 0.97 - Math.max(width * 0.03, x0 - width * 0.02)}" height="10" fill="#7d766b"/>`
    : "";
  const floor = `<rect y="${height * 0.93}" width="${width}" height="${height * 0.07}" fill="#000" opacity="0.035"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">${defs}<rect width="${width}" height="${height}" fill="${options.bg}"/><rect width="${width}" height="${height}" fill="url(#wall)"/>${floor}${rail}${groups}</svg>`;
}

const SCENES: Array<
  [name: string, w: number, h: number, pieces: Array<[string, string]>, bg: string, rail: boolean]
> = [
  [
    "hero-home",
    2400,
    1200,
    [
      ["coat", "camel"],
      ["dress", "terracotta"],
      ["shirt", "ivory"],
      ["sweater", "forest"],
      ["pants", "sand"],
    ],
    "#e6dfd4",
    true,
  ],
  [
    "hero-home-mobile",
    1200,
    1500,
    [
      ["coat", "camel"],
      ["dress", "terracotta"],
      ["sweater", "forest"],
    ],
    "#e6dfd4",
    true,
  ],
  [
    "hero-women",
    2400,
    1200,
    [
      ["dress", "oat"],
      ["top", "blush"],
      ["jeans", "light-wash"],
      ["coat", "charcoal"],
      ["sweater", "butter"],
    ],
    "#ebe4dc",
    true,
  ],
  [
    "hero-women-mobile",
    1200,
    1500,
    [
      ["dress", "oat"],
      ["top", "blush"],
      ["coat", "charcoal"],
    ],
    "#ebe4dc",
    true,
  ],
  [
    "hero-men",
    2400,
    1200,
    [
      ["coat", "navy"],
      ["shirt", "chambray"],
      ["sweater", "oat"],
      ["jeans", "indigo"],
      ["tee", "black"],
    ],
    "#e3e0d9",
    true,
  ],
  [
    "hero-men-mobile",
    1200,
    1500,
    [
      ["coat", "navy"],
      ["shirt", "chambray"],
      ["jeans", "indigo"],
    ],
    "#e3e0d9",
    true,
  ],
  [
    "hero-sale",
    2400,
    1000,
    [
      ["top", "terracotta"],
      ["shirt", "sage"],
      ["dress", "plum"],
      ["tee", "butter"],
    ],
    "#efe6dc",
    true,
  ],
  [
    "hero-sale-mobile",
    1200,
    1500,
    [
      ["top", "terracotta"],
      ["dress", "plum"],
    ],
    "#efe6dc",
    true,
  ],
  [
    "split-linen",
    1200,
    1500,
    [
      ["shirt", "oat"],
      ["pants", "ivory"],
    ],
    "#ede7de",
    true,
  ],
  [
    "split-denim",
    1200,
    1500,
    [
      ["jeans", "indigo"],
      ["jeans", "light-wash"],
    ],
    "#e7e4de",
    true,
  ],
  [
    "look-1",
    1200,
    1600,
    [
      ["top", "ivory"],
      ["pants", "camel"],
    ],
    "#ece6dd",
    false,
  ],
  [
    "look-2",
    1200,
    1600,
    [
      ["sweater", "navy"],
      ["jeans", "light-wash"],
    ],
    "#e8e4dd",
    false,
  ],
  [
    "look-3",
    1200,
    1600,
    [
      ["shirt", "chambray"],
      ["pants", "olive"],
    ],
    "#eae5dc",
    false,
  ],
];

for (const [name, w, h, pieces, bg, rail] of SCENES) {
  // Heroes carry overlay copy: left side clear on desktop, bottom clear on mobile.
  const layout = name.startsWith("hero-")
    ? name.endsWith("-mobile")
      ? { heightFrac: 0.34 }
      : { xStart: 0.42, heightFrac: 0.78 }
    : {};
  writeFileSync(`${OUT}${name}.svg`, scene(w, h, pieces, { bg, rail, ...layout }));
  count += 1;
}

console.log(
  `Wrote ${count} placeholder images to public/media/placeholders (${readdirSync(OUT).length} files).`,
);
