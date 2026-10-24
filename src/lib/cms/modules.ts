import { z } from "zod";
import { audienceSchema, idSchema, scheduleSchema } from "@/lib/validation/common";

/**
 * CMS module registry: each module type has a schema here and a component in
 * components/editorial. Pages are ordered lists of modules, edited in the
 * back office (Phase 8) and validated on read.
 */

const ctaSchema = z.object({ label: z.string().min(1).max(40), href: z.string().startsWith("/") });

const focal = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) });

/** Art-directed image: separate crops for mobile and desktop. */
const responsiveImageSchema = z.object({
  alt: z.string().max(200),
  desktop: z.object({
    url: z.string().min(1),
    width: z.number().int(),
    height: z.number().int(),
    focal,
  }),
  mobile: z.object({
    url: z.string().min(1),
    width: z.number().int(),
    height: z.number().int(),
    focal,
  }),
});
export type ResponsiveImage = z.infer<typeof responsiveImageSchema>;

const simpleImageSchema = z.object({ url: z.string().min(1), alt: z.string().max(200) });

const localMedia = z.string().startsWith("/media/");

/**
 * Optional hero video. It plays muted and looped over its poster (the first
 * frame), loads only after the page has finished loading, and never plays for
 * visitors who prefer reduced motion or have data saving on. `backdrop` is the
 * video's own background colour, so the frame blends into the page seamlessly.
 */
export const heroVideoSchema = z.object({
  desktop: z.object({ webm: localMedia.optional(), mp4: localMedia }),
  mobile: z.object({ webm: localMedia.optional(), mp4: localMedia }),
  poster: z.object({
    webp: localMedia,
    jpg: localMedia,
    width: z.number().int(),
    height: z.number().int(),
  }),
  backdrop: z.string().regex(/^#[0-9a-f]{6}$/i),
});
export type HeroVideo = z.infer<typeof heroVideoSchema>;

/** Hero banner: headline, copy, call to action and art-directed images. */
export const heroBannerSchema = z.object({
  video: heroVideoSchema.optional(),
  eyebrow: z.string().max(40).optional(),
  headline: z.string().min(1).max(80),
  body: z.string().max(200).optional(),
  ctas: z.array(ctaSchema).min(1).max(2),
  image: responsiveImageSchema,
  /** Copy placement over the image. */
  align: z.enum(["left", "center"]),
  /** Text colour chosen for contrast against the image. */
  tone: z.enum(["dark", "light"]),
  size: z.enum(["full", "medium"]),
});

/** Promo strip: one message with an optional link. */
export const promoStripSchema = z.object({
  message: z.string().min(1).max(120),
  link: ctaSchema.optional(),
  tone: z.enum(["muted", "inverse"]),
});

/**
 * Category tiles: image tiles linking to categories.
 * - compact: small label under each tile (quick navigation).
 * - editorial: large label and a "Shop now" link (a seasonal edit).
 * - bleed: edge-to-edge photos, each with its own links, e.g. "Shop women · Shop men"
 *   (one category across departments).
 */
export const categoryTilesSchema = z.object({
  heading: z.string().max(60).optional(),
  subheading: z.string().max(120).optional(),
  variant: z.enum(["compact", "editorial", "bleed"]).default("compact"),
  tiles: z
    .array(
      z.object({
        label: z.string().min(1).max(40),
        href: z.string().startsWith("/"),
        image: simpleImageSchema,
        /** Extra links under the tile (bleed and editorial); the label still opens `href`. */
        links: z.array(ctaSchema).min(1).max(3).optional(),
      }),
    )
    .min(2)
    .max(8),
});

/** Product carousel: a heading and a product selection rule. */
export const productCarouselSchema = z.object({
  heading: z.string().min(1).max(60),
  /** One line under the heading saying why these products, e.g. "Chosen for the season". */
  subheading: z.string().max(120).optional(),
  cta: ctaSchema.optional(),
  source: z.discriminatedUnion("type", [
    z.object({ type: z.literal("manual"), productIds: z.array(idSchema).min(1).max(24) }),
    z.object({
      type: z.literal("rule"),
      /** Category key, e.g. "women" or "women/dresses"; omitted = whole catalogue. */
      categoryKey: z.string().optional(),
      sort: z.enum(["featured", "newest", "best_sellers", "top_rated", "price_asc", "price_desc"]),
      onlySale: z.boolean().optional(),
      limit: z.number().int().min(4).max(24),
    }),
  ]),
});

/** Split feature: image and copy side by side. */
export const splitFeatureSchema = z.object({
  eyebrow: z.string().max(40).optional(),
  headline: z.string().min(1).max(80),
  body: z.string().max(400),
  cta: ctaSchema,
  image: simpleImageSchema,
  imageSide: z.enum(["left", "right"]),
});

/** Story block: centred editorial text. */
export const storyBlockSchema = z.object({
  eyebrow: z.string().max(40).optional(),
  headline: z.string().min(1).max(120),
  body: z.string().max(600),
  cta: ctaSchema.optional(),
});

/**
 * Campaign diptych: two photos side by side, with the headline, copy and up
 * to three calls to action over the first.
 * - pair: two full-bleed campaign photos (a seasonal campaign launch).
 * - framed: the second photo sits in a white frame on limestone, with an
 *   optional handwritten accent (an occasion or gift promotion).
 */
export const campaignDiptychSchema = z.object({
  eyebrow: z.string().max(40).optional(),
  headline: z.string().min(1).max(80),
  body: z.string().max(200).optional(),
  ctas: z.array(ctaSchema).min(1).max(3),
  primary: simpleImageSchema,
  secondary: simpleImageSchema,
  layout: z.enum(["pair", "framed"]),
  /** Handwritten accent over the framed photo, e.g. "Wrap it up". */
  accent: z.string().max(40).optional(),
});

const hotspotSchema = z.object({
  productId: idSchema,
  /** Position as a fraction of the image. */
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
});

/** Lookbook grid: looks with product hotspots. */
export const lookbookGridSchema = z.object({
  heading: z.string().min(1).max(60),
  looks: z
    .array(
      z.object({
        image: simpleImageSchema,
        title: z.string().max(60),
        hotspots: z.array(hotspotSchema).max(6),
      }),
    )
    .min(1)
    .max(6),
});

/** Shop the look: one look with hotspots and featured products. */
export const shopTheLookSchema = z.object({
  heading: z.string().min(1).max(60),
  body: z.string().max(240).optional(),
  image: simpleImageSchema,
  productIds: z.array(idSchema).min(1).max(6),
});

const moduleBase = {
  id: idSchema,
  schedule: scheduleSchema,
  audience: z.array(audienceSchema).min(1),
};

/** Any page module, discriminated by type, with scheduling and audience. */
export const cmsModuleSchema = z.discriminatedUnion("type", [
  z.object({ ...moduleBase, type: z.literal("hero"), data: heroBannerSchema }),
  z.object({ ...moduleBase, type: z.literal("promoStrip"), data: promoStripSchema }),
  z.object({ ...moduleBase, type: z.literal("categoryTiles"), data: categoryTilesSchema }),
  z.object({ ...moduleBase, type: z.literal("productCarousel"), data: productCarouselSchema }),
  z.object({ ...moduleBase, type: z.literal("splitFeature"), data: splitFeatureSchema }),
  z.object({ ...moduleBase, type: z.literal("storyBlock"), data: storyBlockSchema }),
  z.object({ ...moduleBase, type: z.literal("lookbookGrid"), data: lookbookGridSchema }),
  z.object({ ...moduleBase, type: z.literal("shopTheLook"), data: shopTheLookSchema }),
  z.object({ ...moduleBase, type: z.literal("campaignDiptych"), data: campaignDiptychSchema }),
]);

export type CmsModule = z.infer<typeof cmsModuleSchema>;
export type CmsModuleType = CmsModule["type"];

/** A CMS page: slug, SEO and its ordered modules. */
export const cmsPageSchema = z.object({
  id: idSchema,
  slug: z.string().min(1),
  title: z.string().min(1).max(120),
  seo: z.object({
    title: z.string().max(70).optional(),
    description: z.string().max(160).optional(),
  }),
  modules: z.array(cmsModuleSchema),
  status: z.enum(["draft", "scheduled", "live", "archived"]),
  updatedAt: z.date(),
});
export type CmsPage = z.infer<typeof cmsPageSchema>;

/** A module is shown when "now" is inside its schedule window. */
export function isModuleLive(module: Pick<CmsModule, "schedule">, now: number): boolean {
  const { startsAt, endsAt } = module.schedule;
  return (!startsAt || startsAt.getTime() <= now) && (!endsAt || endsAt.getTime() > now);
}
