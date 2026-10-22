// Builds the storefront's interim photography from royalty-free Pexels photos
// (free for commercial use, no attribution required; credited anyway in
// docs/IMAGE_CREDITS.md). Used by the live-store starter pages until real
// product and campaign photography replaces it in /admin/content.
//
//   npx tsx scripts/stock-images.ts
//
// Heroes are composed, not just cropped: the portrait photo sits on the right
// (on phones, at the top) and the rest of the frame continues the photo's own
// studio backdrop, so the dark headline always sits on a calm, light area.
import { mkdirSync, writeFileSync } from "node:fs";
import sharp, { type OverlayOptions, type Sharp } from "sharp";
import { STOCK, stockUrl, type StockKey, type StockSource } from "./stock-catalog";

const OUT = "public/media/stock";

async function download(id: number): Promise<Buffer> {
  const url = `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=2000`;
  const response = await fetch(url, { headers: { "user-agent": "texora-stock-images" } });
  if (!response.ok) throw new Error(`Pexels ${id}: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

/** The photo's own backdrop: one edge, averaged and stretched across the frame. */
async function backdrop(
  photo: Sharp,
  edge: "left" | "bottom",
  width: number,
  height: number,
): Promise<Buffer> {
  const { width: w = 1, height: h = 1 } = await photo.metadata();
  const strip =
    edge === "left"
      ? { left: 0, top: 0, width: Math.max(1, Math.round(w * 0.03)), height: h }
      : {
          left: 0,
          top: h - Math.max(1, Math.round(h * 0.03)),
          width: w,
          height: Math.max(1, Math.round(h * 0.03)),
        };
  const line = await photo
    .clone()
    .extract(strip)
    .resize(edge === "left" ? 1 : width, edge === "left" ? height : 1, { fit: "fill" })
    .toBuffer();
  return sharp(line).resize(width, height, { fit: "fill", kernel: "nearest" }).blur(12).toBuffer();
}

/** A gradient alpha mask: transparent at the start edge, opaque after `fade` px. */
function fadeMask(width: number, height: number, fade: number, from: "left" | "bottom") {
  const gradient =
    from === "left"
      ? `<linearGradient id="g" x1="0" y1="0" x2="${fade / width}" y2="0">`
      : `<linearGradient id="g" x1="0" y1="1" x2="0" y2="${1 - fade / height}">`;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs>${gradient}<stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity="1"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`,
  );
}

async function withFade(photo: Buffer, fade: number, from: "left" | "bottom") {
  const { width = 1, height = 1 } = await sharp(photo).metadata();
  return sharp(photo)
    .ensureAlpha()
    .composite([{ input: fadeMask(width, height, fade, from), blend: "dest-in" }])
    .png()
    .toBuffer();
}

/** Desktop hero (2400×1200): photo on the right, backdrop continued to the left. */
async function heroDesktop(source: Buffer): Promise<Buffer> {
  const W = 2400;
  const H = 1200;
  const photo = sharp(source);
  const placed = await photo.clone().resize({ height: H }).toBuffer();
  const { width: pw = 900 } = await sharp(placed).metadata();
  const faded = await withFade(placed, Math.round(pw * 0.25), "left");
  const left = Math.max(0, W - pw - Math.round(W * 0.05));
  const right = W - left - pw;
  const layers: OverlayOptions[] = [{ input: faded, left, top: 0 }];
  if (right > 0) {
    // Continue the right edge too, so the photo never ends in a hard line.
    const edge = await sharp(placed)
      .extract({ left: pw - 2, top: 0, width: 2, height: H })
      .resize(right, H, { fit: "fill" })
      .toBuffer();
    layers.push({ input: edge, left: left + pw, top: 0 });
  }
  return sharp(await backdrop(photo, "left", W, H))
    .composite(layers)
    .jpeg({ quality: 80, mozjpeg: true })
    .toBuffer();
}

/** Soft-edged alpha mask: opaque inside, fading out at the sides and bottom (the top stays hard). */
function vignette(width: number, height: number, fade: number) {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><filter id="b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${fade / 2.5}"/></filter></defs><rect x="${fade}" y="${-fade * 2}" width="${width - fade * 2}" height="${height + fade}" fill="#fff" filter="url(#b)"/></svg>`,
  );
}

/**
 * Mobile hero (1200×1500): the whole photo, smaller, in the upper part of the
 * frame and blended into its own studio; the floor continues below for the copy.
 */
async function heroMobile(source: Buffer): Promise<Buffer> {
  const W = 1200;
  const H = 1500;
  const photo = sharp(source);
  const ph = Math.round(H * 0.66);
  const placed = await photo.clone().resize({ height: ph }).toBuffer();
  const { width: pw = 600 } = await sharp(placed).metadata();
  const soft = await sharp(placed)
    .ensureAlpha()
    .composite([{ input: vignette(pw, ph, Math.round(pw * 0.12)), blend: "dest-in" }])
    .png()
    .toBuffer();
  // The studio wall continues to the bottom of the frame (edge pixels repeated).
  const base = await sharp(await backdrop(photo, "left", W, ph))
    .extend({ bottom: H - ph, extendWith: "copy" })
    .png()
    .toBuffer();
  return sharp(base)
    .composite([{ input: soft, left: Math.round((W - pw) / 2), top: 0 }])
    .jpeg({ quality: 80, mozjpeg: true })
    .toBuffer();
}

/** Category tile (900×1200, 3:4), cropped around the person. */
async function tile(source: Buffer): Promise<Buffer> {
  return sharp(source)
    .resize(900, 1200, { fit: "cover", position: sharp.strategy.attention })
    .jpeg({ quality: 80, mozjpeg: true })
    .toBuffer();
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const credits: string[] = [];
  for (const [key, source] of Object.entries(STOCK) as Array<[StockKey, StockSource]>) {
    const original = await download(source.id);
    if (key.startsWith("hero")) {
      writeFileSync(`public${stockUrl(key, "desktop")}`, await heroDesktop(original));
      writeFileSync(`public${stockUrl(key, "mobile")}`, await heroMobile(original));
    } else {
      writeFileSync(`public${stockUrl(key, "tile")}`, await tile(original));
    }
    credits.push(
      `| ${key} | [Pexels ${source.id}](https://www.pexels.com/photo/${source.page}-${source.id}/) | ${source.alt} |`,
    );
    console.log(`${key}: ${source.id}`);
  }
  writeFileSync(
    "docs/IMAGE_CREDITS.md",
    `# Image credits

Interim storefront photography for the live-store starter pages (\`npm run bootstrap\`), until real product and campaign photography replaces it in \`/admin/content\`. Every photo is from [Pexels](https://www.pexels.com/license/): free for commercial use, modification allowed, no attribution required. None shows a brand's product or campaign. Regenerate with \`npx tsx scripts/stock-images.ts\`; heroes are composed (photo plus its own backdrop) so the headline sits on a calm area.

| Slot | Source | Description |
| --- | --- | --- |
${credits.join("\n")}
`,
  );
}

if (process.argv[1]?.endsWith("stock-images.ts")) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
