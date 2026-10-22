// Builds the home hero from the store's own photograph
// (public/media/assets/texora hero.png): a wide desktop frame and a phone
// frame on the photo's own white, with feathered edges, so the headline sits
// on a clean area and nobody is cropped on narrow screens. Re-run after
// replacing the photo:
//
//   npx tsx scripts/hero-images.ts
import { mkdirSync } from "node:fs";
import sharp from "sharp";
import { HOME_HERO } from "./stock-catalog";

const SOURCE = "public/media/assets/texora hero.png";
const OUT = "public/media/hero";

/** The photo's backdrop colour: the average of its top band (the open studio wall). */
async function backdropColour(input: Buffer): Promise<{ r: number; g: number; b: number }> {
  const { data, info } = await sharp(input)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const frame = 12;
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (y >= frame) continue;
      const i = (y * info.width + x) * info.channels;
      r += data[i] ?? 0;
      g += data[i + 1] ?? 0;
      b += data[i + 2] ?? 0;
      n++;
    }
  }
  return { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) };
}

/** The photo with soft, transparent edges, so it melts into the backdrop. */
async function feathered(input: Buffer, fade: number): Promise<Buffer> {
  const { width = 1, height = 1 } = await sharp(input).metadata();
  const mask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><filter id="b" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${fade / 2.5}"/></filter></defs><rect x="${fade}" y="${fade}" width="${width - fade * 2}" height="${height - fade * 2}" fill="#fff" filter="url(#b)"/></svg>`,
  );
  return sharp(input)
    .ensureAlpha()
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toBuffer();
}

async function compose(
  photo: Buffer,
  canvas: { width: number; height: number },
  place: { left: number; top: number },
  background: { r: number; g: number; b: number },
  fade: number,
  file: string,
) {
  await sharp({ create: { ...canvas, channels: 3, background } })
    .composite([{ input: await feathered(photo, fade), ...place }])
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(file);
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const source = await sharp(SOURCE).toBuffer();
  const { width = 2027, height = 776 } = await sharp(source).metadata();
  const background = await backdropColour(source);

  // Desktop 2400×1200: the photo at 90% width, right-aligned and centred
  // vertically, so the group starts past the headline's column.
  const desktopW = 2160;
  const desktop = await sharp(source).resize({ width: desktopW }).toBuffer();
  const desktopH = Math.round((height * desktopW) / width);
  await compose(
    desktop,
    { width: 2400, height: 1200 },
    { left: 2400 - desktopW, top: Math.round((1200 - desktopH) / 2) },
    background,
    120,
    `public${HOME_HERO.desktop}`,
  );

  // Phone 1200×1500: just the group, at 80% width and centred, in the top
  // half (phones crop the sides; the copy sits in the lower half).
  const groupLeft = Math.round(width * 0.3);
  const groupRight = width;
  const group = await sharp(source)
    .extract({ left: groupLeft, top: 0, width: groupRight - groupLeft, height })
    .resize({ width: 960 })
    .toBuffer();
  await compose(
    group,
    { width: 1200, height: 1500 },
    { left: 120, top: 80 },
    background,
    80,
    `public${HOME_HERO.mobile}`,
  );
}

if (process.argv[1]?.endsWith("hero-images.ts")) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
