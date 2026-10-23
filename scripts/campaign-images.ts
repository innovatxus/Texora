// Builds every storefront photo slot from the store's own campaign
// photography (public/media/assets/campaign) into public/media/stock, at the
// same paths the pages already use. Re-run after changing a photo or crop in
// scripts/stock-catalog.ts:
//
//   npx tsx scripts/campaign-images.ts
//
// Desktop heroes (2400×1200) keep a calm area on the left for the headline:
// wide photos are cropped to 2:1; portrait photos sit on the right and fade
// into a warm limestone tone. Phone heroes (1200×1500) fill the frame and
// fade to the same tone at the bottom, where the copy sits. Campaign panels
// (panel*) are 1200×1500; category tiles are 900×1200.
import { readFileSync, writeFileSync } from "node:fs";
import sharp, { type Sharp } from "sharp";
import {
  CAMPAIGN,
  stockUrl,
  type CampaignKey,
  type CampaignShot,
  type Crop,
} from "./stock-catalog";

const SOURCE = "public/media/assets/campaign";

/** Warm light limestone, matching the photos' sunlit walls; the headline sits on it. */
const LIMESTONE = { r: 243, g: 236, b: 225 };
const LIMESTONE_HEX = "#f3ece1";

const cropped = (source: Buffer, crop?: Crop) =>
  crop ? sharp(source).extract(crop).toBuffer() : Promise.resolve(source);

const jpeg = (image: Sharp) => image.jpeg({ quality: 82, mozjpeg: true }).toBuffer();

/** Portrait photo flush right, its left edge fading into limestone. */
async function heroDesktopPortrait(source: Buffer): Promise<Buffer> {
  const W = 2400;
  const H = 1200;
  const placed = await sharp(source).resize({ height: H }).toBuffer();
  const { width: pw = 960 } = await sharp(placed).metadata();
  const fade = Math.round(pw * 0.35);
  const mask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${pw}" height="${H}"><defs><linearGradient id="g" x1="0" y1="0" x2="${fade / pw}" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`,
  );
  const soft = await sharp(placed)
    .ensureAlpha()
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toBuffer();
  return jpeg(
    sharp({ create: { width: W, height: H, channels: 3, background: LIMESTONE } }).composite([
      { input: soft, left: W - pw, top: 0 },
    ]),
  );
}

/** Phone hero: the photo fills the frame and fades to limestone at the bottom. */
async function heroMobile(source: Buffer): Promise<Buffer> {
  const W = 1200;
  const H = 1500;
  const gradient = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0.5" stop-color="${LIMESTONE_HEX}" stop-opacity="0"/><stop offset="0.82" stop-color="${LIMESTONE_HEX}" stop-opacity="0.94"/><stop offset="1" stop-color="${LIMESTONE_HEX}"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`,
  );
  return jpeg(
    sharp(source)
      .resize(W, H, { fit: "cover", position: "top" })
      .composite([{ input: gradient }]),
  );
}

async function main() {
  for (const [key, shot] of Object.entries(CAMPAIGN) as Array<[CampaignKey, CampaignShot]>) {
    const source = readFileSync(`${SOURCE}/${shot.file}`);
    if (key.startsWith("hero")) {
      const desktop = shot.desktopCrop
        ? await jpeg(
            sharp(await cropped(source, shot.desktopCrop)).resize(2400, 1200, { fit: "cover" }),
          )
        : await heroDesktopPortrait(await cropped(source, shot.crop));
      writeFileSync(`public${stockUrl(key, "desktop")}`, desktop);
      writeFileSync(
        `public${stockUrl(key, "mobile")}`,
        await heroMobile(await cropped(source, shot.mobileCrop ?? shot.crop)),
      );
    } else if (key.startsWith("panel")) {
      const panel = await jpeg(
        sharp(await cropped(source, shot.crop)).resize(1200, 1500, {
          fit: "cover",
          position: sharp.strategy.attention,
        }),
      );
      writeFileSync(`public${stockUrl(key, "panel")}`, panel);
    } else {
      const tile = await jpeg(
        sharp(await cropped(source, shot.crop)).resize(900, 1200, {
          fit: "cover",
          position: sharp.strategy.attention,
        }),
      );
      writeFileSync(`public${stockUrl(key, "tile")}`, tile);
    }
    console.log(`${key}: ${shot.file}`);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
