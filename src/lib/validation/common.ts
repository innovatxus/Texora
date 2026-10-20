import { z } from "zod";

/** Money in minor units (cents). Never use floats for prices. */
export const moneySchema = z.number().int().nonnegative();

/** A document id. */
export const idSchema = z.string().min(1).max(128);

/** A URL slug: lower-case words joined by hyphens. */
export const slugSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and single hyphens");

/** A #RRGGBB colour. */
export const hexColorSchema = z.string().regex(/^#[0-9a-f]{6}$/i, "Use a #RRGGBB colour");

/** A point in time (Firestore Timestamps are converted to Dates on read). */
export const timestampSchema = z.date();

/** Supported currencies. */
export const CURRENCIES = ["USD"] as const;
/** One supported currency. */
export const currencySchema = z.enum(CURRENCIES);

/** Shop departments. */
export const DEPARTMENTS = ["women", "men"] as const;
/** One department. */
export const departmentSchema = z.enum(DEPARTMENTS);
export type Department = z.infer<typeof departmentSchema>;

/** Fit families a style can be cut in. */
export const FIT_FAMILIES = ["regular", "petite", "tall"] as const;
/** One fit family. */
export const fitFamilySchema = z.enum(FIT_FAMILIES);
export type FitFamily = z.infer<typeof fitFamilySchema>;

/** How a product is sized. */
export const SIZE_TYPES = ["alpha", "numeric", "waist_inseam", "shoe"] as const;
/** One size type. */
export const sizeTypeSchema = z.enum(SIZE_TYPES);
export type SizeType = z.infer<typeof sizeTypeSchema>;

/** Colour groups used by the colour filter. */
export const COLOR_FAMILIES = [
  "black",
  "white",
  "neutral",
  "brown",
  "grey",
  "blue",
  "green",
  "red",
  "pink",
  "yellow",
  "orange",
  "purple",
  "multi",
] as const;
/** One colour family. */
export const colorFamilySchema = z.enum(COLOR_FAMILIES);
export type ColorFamily = z.infer<typeof colorFamilySchema>;

/** Publication lifecycle shared by catalog and CMS documents. */
export const PUBLISH_STATUSES = ["draft", "scheduled", "live", "archived"] as const;
/** Draft, scheduled, live or archived. */
export const publishStatusSchema = z.enum(PUBLISH_STATUSES);
export type PublishStatus = z.infer<typeof publishStatusSchema>;

/** Optional SEO overrides for a page. */
export const seoSchema = z.object({
  title: z.string().max(70).optional(),
  description: z.string().max(160).optional(),
  canonicalPath: z.string().startsWith("/").optional(),
});

/** An image with alt text and dimensions. */
export const imageSchema = z.object({
  url: z.string().min(1),
  alt: z.string().max(200),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  /** Focal point (0–1) used for responsive cropping. */
  focal: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).optional(),
});
export type Image = z.infer<typeof imageSchema>;

/** A postal address, with customer-facing validation messages. */
export const addressSchema = z.object({
  firstName: z.string().trim().min(1, "Enter a first name").max(60),
  lastName: z.string().trim().min(1, "Enter a last name").max(60),
  company: z.string().trim().max(100).optional(),
  line1: z.string().trim().min(1, "Enter an address").max(120),
  line2: z.string().trim().max(120).optional(),
  city: z.string().trim().min(1, "Enter a city").max(80),
  region: z.string().trim().min(1, "Enter a state or region").max(80),
  postalCode: z.string().trim().min(3, "Enter a postcode").max(12),
  country: z.string().length(2, "Use a 2-letter country code").toUpperCase(),
  phone: z.string().trim().max(30).optional(),
});
export type Address = z.infer<typeof addressSchema>;

/** Latitude and longitude. */
export const geoSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

/** Audience targeting for CMS modules and promotions. */
export const AUDIENCES = ["everyone", "guest", "member", "core", "enthusiast", "icon"] as const;
/** Who a promotion or module is shown to. */
export const audienceSchema = z.enum(AUDIENCES);

/** Optional start and end times; the end must be after the start. */
export const scheduleSchema = z
  .object({
    startsAt: timestampSchema.optional(),
    endsAt: timestampSchema.optional(),
  })
  .refine((s) => !s.startsAt || !s.endsAt || s.startsAt < s.endsAt, {
    message: "End must be after start",
    path: ["endsAt"],
  });
