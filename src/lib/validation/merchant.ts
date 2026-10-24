/**
 * Merchant marketplace schemas: merchants, uniqueness locks, shops, locations,
 * product drafts and media. Field rules and messages are shared by client forms
 * and Server Actions; limits come from `src/config/merchant.ts`.
 */
import { z } from "zod";
import { COUNTRY, GOVERNORATE_CODES, POSTAL_CODE_PATTERN, toE164 } from "@/config/locale";
import {
  isReservedName,
  MERCHANT_LIMITS,
  SOCIAL_HANDLE_PATTERNS,
  type LocationType,
  type MediaKind,
  type ProcessingTime,
  type ShopAccent,
  type ShopType,
} from "@/config/merchant";
import { PASSWORD_MAX_LENGTH, passwordProblem } from "@/lib/auth/password";
import { productStatusSchema } from "./catalog";
import {
  colorFamilySchema,
  departmentSchema,
  fitFamilySchema,
  geoSchema,
  hexColorSchema,
  idSchema,
  imageSchema,
  timestampSchema,
} from "./common";

const { username: U, shop: S } = MERCHANT_LIMITS;

// ---------------------------------------------------------------- fields

/** A sign-in email: trimmed, lower-cased, RFC-valid. */
export const merchantEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter an email address like name@example.com").max(254));

/** A merchant username, normalised to lower case. */
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(U.min, `Use ${U.min} to ${U.max} characters`)
  .max(U.max, `Use ${U.min} to ${U.max} characters`)
  .regex(/^[a-z0-9_.-]+$/, "Use lowercase letters, numbers, dots, dashes or underscores")
  .regex(/^[a-z0-9](?:.*[a-z0-9])?$/, "Start and end with a letter or number")
  .refine((value) => !isReservedName(value), "That name is reserved — try another");

/** A shop's web address under `/shops/`. */
export const shopSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(S.slugMin, `Use ${S.slugMin}–${S.slugMax} lowercase letters, numbers and dashes`)
  .max(S.slugMax, `Use ${S.slugMin}–${S.slugMax} lowercase letters, numbers and dashes`)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    `Use ${S.slugMin}–${S.slugMax} lowercase letters, numbers and dashes`,
  )
  .refine((value) => !isReservedName(value), "That address is reserved");

/** Turns a shop name into a suggested address: "Maison Rue & Co." → "maison-rue-co". */
export function suggestShopSlug(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, S.slugMax)
    .replace(/-+$/g, "");
}

/** A phone number, typed the Egyptian way (010…, 02…, +20…) and stored in E.164 form. */
export const e164PhoneSchema = z
  .string()
  .trim()
  .transform((value) => toE164(value))
  .pipe(z.string().regex(/^\+[1-9]\d{7,14}$/, "Enter a phone number like 010 1234 5678"));

/** A public website: a full https address. */
export const websiteSchema = z
  .string()
  .trim()
  .max(200)
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === "https:" && url.hostname.includes(".");
    } catch {
      return false;
    }
  }, "Enter a full address starting with https://");

const handle = (network: keyof typeof SOCIAL_HANDLE_PATTERNS) =>
  z
    .string()
    .trim()
    .transform((value) => value.replace(/^@/, ""))
    .pipe(z.string().regex(SOCIAL_HANDLE_PATTERNS[network], "Enter your handle without the @"));

/** HH:MM, 24-hour. */
const clockSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a time like 09:30");

// ---------------------------------------------------------------- merchants

export const MERCHANT_STATUSES = ["onboarding", "active", "suspended", "closed"] as const;
export const TRUST_LEVELS = ["standard", "trusted"] as const;

/** A merchant account (`merchants/{vendorId}`); `vendorId` is the custom claim. */
export const merchantSchema = z.object({
  id: idSchema,
  ownerUid: idSchema,
  email: merchantEmailSchema,
  username: usernameSchema,
  displayName: z.string().trim().min(1).max(80),
  status: z.enum(MERCHANT_STATUSES),
  emailVerified: z.boolean(),
  /** Trusted merchants publish without product review (admin-set only). */
  trustLevel: z.enum(TRUST_LEVELS),
  shopIds: z.array(idSchema).max(S.maxPerMerchant),
  usernameChangedAt: timestampSchema.optional(),
  /** Optional emails; shop status emails are always sent. */
  notifications: z
    .object({ newOrders: z.boolean(), productReviews: z.boolean() })
    .default({ newOrders: true, productReviews: true }),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export type Merchant = z.infer<typeof merchantSchema>;
export type MerchantStatus = Merchant["status"];
export type TrustLevel = Merchant["trustLevel"];

/** `usernames/{username}`: the uniqueness lock, claimed in a transaction. */
export const usernameLockSchema = z.object({
  id: usernameSchema,
  uid: idSchema,
  vendorId: idSchema,
  createdAt: timestampSchema,
});
export type UsernameLock = z.infer<typeof usernameLockSchema>;

/** `shopSlugs/{slug}`: the uniqueness lock for shop addresses. */
export const shopSlugLockSchema = z.object({
  id: shopSlugSchema,
  shopId: idSchema,
  vendorId: idSchema,
  createdAt: timestampSchema,
});
export type ShopSlugLock = z.infer<typeof shopSlugLockSchema>;

// ---------------------------------------------------------------- shops

export const SHOP_STATUSES = [
  "draft",
  "pending_review",
  "changes_requested",
  "approved",
  "suspended",
  "closed",
] as const;
export const shopStatusSchema = z.enum(SHOP_STATUSES);
export type ShopStatus = z.infer<typeof shopStatusSchema>;

export const ONBOARDING_STEPS = ["basics", "branding", "contact", "locations", "review"] as const;
export const onboardingStepSchema = z.enum(ONBOARDING_STEPS);
export type OnboardingStep = z.infer<typeof onboardingStepSchema>;

/** A processed image owned by a merchant, with its placeholder and dominant colour. */
export const merchantImageSchema = imageSchema.extend({
  mediaId: idSchema,
  blurDataURL: z.string().startsWith("data:image/").max(2000),
  dominantColor: hexColorSchema,
});
export type MerchantImage = z.infer<typeof merchantImageSchema>;

// Literal tuples keep exact types; merchant.test.ts checks they match the config lists.
export const SHOP_TYPE_VALUES = [
  "brand",
  "boutique",
  "designer",
  "reseller",
] as const satisfies readonly ShopType[];
export const ACCENT_VALUES = [
  "ink",
  "moss",
  "clay",
  "harbour",
  "plum",
  "saffron",
  "rose",
  "slate",
] as const satisfies readonly ShopAccent[];
export const PROCESSING_TIME_VALUES = ["1-2", "3-5"] as const satisfies readonly ProcessingTime[];

/** Processing time; shops saved with the retired "5-10" option read as "3-5". */
const processingTimeSchema = z.preprocess(
  (value) => (value === "5-10" ? "3-5" : value),
  z.enum(PROCESSING_TIME_VALUES),
);
export const LOCATION_TYPE_VALUES = [
  "retail",
  "ship_from",
] as const satisfies readonly LocationType[];

const shopTypeSchema = z.enum(SHOP_TYPE_VALUES);
const accentSchema = z.enum(ACCENT_VALUES);

/**
 * Every shop uses Texora's returns policy (PLATFORM_RETURN_POLICY). Shops saved
 * with their own policy before this rule read, and save, as Texora's.
 */
export const returnPolicySchema = z
  .object({ mode: z.enum(["platform", "custom"]) })
  .passthrough()
  .transform((): { mode: "platform" } => ({ mode: "platform" }));
export type ReturnPolicy = z.infer<typeof returnPolicySchema>;

export const shopContactSchema = z.object({
  email: merchantEmailSchema,
  phone: e164PhoneSchema.optional(),
  website: websiteSchema.optional(),
});

export const shopSocialSchema = z.object({
  instagram: handle("instagram").optional(),
  tiktok: handle("tiktok").optional(),
  facebook: handle("facebook").optional(),
});

export const shopShippingSchema = z.object({
  shipsFromLocationId: idSchema.optional(),
  processingTime: processingTimeSchema,
});

/** One review decision on a shop, shown to the merchant. */
export const reviewNoteSchema = z.object({
  at: timestampSchema,
  byUid: idSchema,
  decision: z.enum([
    "submitted",
    "approved",
    "changes_requested",
    "rejected",
    "suspended",
    "reinstated",
  ]),
  reasons: z.array(z.string().trim().min(1).max(500)).max(10),
});
export type ReviewNote = z.infer<typeof reviewNoteSchema>;

/** Counters maintained in the same batch as each product write (no counting queries). */
export const shopCountersSchema = z.object({
  live: z.number().int().nonnegative(),
  draft: z.number().int().nonnegative(),
  inReview: z.number().int().nonnegative(),
  changesRequested: z.number().int().nonnegative(),
  lowStock: z.number().int().nonnegative(),
});
export type ShopCounters = z.infer<typeof shopCountersSchema>;

export const EMPTY_SHOP_COUNTERS: ShopCounters = {
  live: 0,
  draft: 0,
  inReview: 0,
  changesRequested: 0,
  lowStock: 0,
};

/** Shop basics, as entered in onboarding step 1 and shop settings. */
export const shopBasicsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(S.nameMin, `Use ${S.nameMin} to ${S.nameMax} characters`)
    .max(S.nameMax, `Use ${S.nameMin} to ${S.nameMax} characters`),
  slug: shopSlugSchema,
  tagline: z.string().trim().max(S.taglineMax, `Keep it to ${S.taglineMax} characters`),
  description: z.string().trim().max(S.descriptionMax, `Keep it to ${S.descriptionMax} characters`),
  shopType: shopTypeSchema,
  departments: z.array(departmentSchema).min(1, "Choose at least one department"),
  categoryKeys: z.array(z.string().min(1).max(120)).min(1, "Choose at least one category").max(40),
});
export type ShopBasics = z.infer<typeof shopBasicsSchema>;

/** A merchant's shop (`shops/{shopId}`). */
export const shopSchema = shopBasicsSchema.extend({
  id: idSchema,
  vendorId: idSchema,
  logo: merchantImageSchema.optional(),
  banner: merchantImageSchema.optional(),
  accent: accentSchema,
  contact: shopContactSchema,
  social: shopSocialSchema,
  returnPolicy: returnPolicySchema,
  shipping: shopShippingSchema,
  status: shopStatusSchema,
  /** Why the shop is suspended or what must change, as last decided. */
  statusReason: z.string().max(1000).optional(),
  reviewNotes: z.array(reviewNoteSchema).max(100),
  onboardingStep: onboardingStepSchema,
  /** Steps saved at least once, so the stepper can mark them done. */
  completedSteps: z.array(onboardingStepSchema),
  counters: shopCountersSchema,
  submittedAt: timestampSchema.optional(),
  approvedAt: timestampSchema.optional(),
  closedAt: timestampSchema.optional(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export type Shop = z.infer<typeof shopSchema>;

// ---------------------------------------------------------------- locations

const locationTypeSchema = z.enum(LOCATION_TYPE_VALUES);

/** Weekly opening hours: entries per day (0 = Sunday), same shape as Texora stores (D-066). */
export const weeklyHoursSchema = z.array(
  z.object({ day: z.number().int().min(0).max(6), open: clockSchema, close: clockSchema }),
);
export type WeeklyHours = z.infer<typeof weeklyHoursSchema>;

/** Problems with a week of hours, in shopper-facing words; empty when valid. */
export function weeklyHoursProblems(hours: WeeklyHours): string[] {
  const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const problems: string[] = [];
  for (let day = 0; day < 7; day++) {
    const ranges = hours.filter((h) => h.day === day).sort((a, b) => a.open.localeCompare(b.open));
    const name = DAYS[day] ?? String(day);
    if (ranges.length > MERCHANT_LIMITS.location.rangesPerDay) {
      problems.push(`Use at most ${MERCHANT_LIMITS.location.rangesPerDay} time ranges on ${name}`);
    }
    for (const r of ranges) {
      if (r.close <= r.open) problems.push(`Closing time must be after opening time on ${name}`);
    }
    for (let i = 1; i < ranges.length; i++) {
      const prev = ranges[i - 1];
      const cur = ranges[i];
      if (prev && cur && cur.open < prev.close) problems.push(`Ranges on ${name} overlap`);
    }
  }
  return [...new Set(problems)];
}

/** A one-off change to opening hours: a holiday closure or special times. */
export const specialHoursSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-12-24"),
    closed: z.boolean(),
    open: clockSchema.optional(),
    close: clockSchema.optional(),
    note: z.string().trim().max(120).optional(),
  })
  .refine((s) => s.closed || (s.open && s.close && s.close > s.open), {
    message: "Closing time must be after opening time",
    path: ["close"],
  });
export type SpecialHours = z.infer<typeof specialHoursSchema>;

/** A street address in Egypt for a merchant location. */
export const locationAddressSchema = z.object({
  line1: z.string().trim().min(1, "Enter a street address").max(120),
  line2: z.string().trim().max(120).optional(),
  city: z.string().trim().min(1, "Enter a city").max(80),
  /** Governorate code (ISO 3166-2:EG). */
  region: z
    .string()
    .trim()
    .refine((code) => GOVERNORATE_CODES.includes(code), "Choose a governorate"),
  /** Five digits; optional, as most Egyptian addresses don't use one. */
  postalCode: z
    .string()
    .trim()
    .refine((code) => code === "" || POSTAL_CODE_PATTERN.test(code), "Use a 5-digit postal code")
    .optional(),
  country: z.literal(COUNTRY),
});
export type LocationAddress = z.infer<typeof locationAddressSchema>;

/** A shop location (`shops/{shopId}/locations/{locationId}`). No pickup (D-071). */
export const merchantLocationSchema = z.object({
  id: idSchema,
  shopId: idSchema,
  vendorId: idSchema,
  name: z.string().trim().min(1, "Enter a name for this location").max(80),
  types: z.array(locationTypeSchema).min(1, "Choose what this location is"),
  address: locationAddressSchema,
  /** Absent until a geocoder finds the address (D-068). */
  geo: geoSchema.optional(),
  timezone: z.string().min(1).max(64),
  hours: weeklyHoursSchema,
  specialHours: z.array(specialHoursSchema).max(MERCHANT_LIMITS.location.specialHoursMax),
  phone: e164PhoneSchema.optional(),
  isPrimary: z.boolean(),
  sortOrder: z.number().int().nonnegative(),
  status: z.enum(["active", "archived"]),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export type MerchantLocation = z.infer<typeof merchantLocationSchema>;

/** The `stockByLocation` key for a merchant location (namespaced, never collides). */
export function merchantStockKey(shopId: string, locationId: string): string {
  return `m_${shopId}_${locationId}`;
}

// ---------------------------------------------------------------- drafts & media

/**
 * Autosaved editor state (`productDrafts/{productId}`), so half-finished work
 * never touches `products`. `data` is validated section by section when the
 * draft is saved to the product.
 */
export const productDraftSchema = z.object({
  id: idSchema,
  vendorId: idSchema,
  shopId: idSchema,
  /** Increments on every save; stale autosaves are rejected. */
  version: z.number().int().nonnegative(),
  data: z.record(z.string(), z.unknown()),
  /** Mirrors the product's status (server-maintained), so the list needs one query. */
  status: productStatusSchema.default("draft"),
  summary: z
    .object({
      name: z.string(),
      categoryKey: z.string(),
      image: z.string().optional(),
      colors: z.number().int().nonnegative(),
      variants: z.number().int().nonnegative(),
      priceMin: z.number().int().nonnegative().nullable(),
      priceMax: z.number().int().nonnegative().nullable(),
      stock: z.number().int().nonnegative(),
      lowStock: z.boolean(),
    })
    .optional(),
  /** Reviewer notes when changes are requested. */
  reviewNotes: z.array(z.string().max(500)).max(20).default([]),
  /** Whether a version of this product is on the storefront (it stays there while edits are reviewed). */
  published: z.boolean().default(false),
  createdAt: timestampSchema.optional(),
  updatedBy: idSchema,
  updatedAt: timestampSchema,
});
export type ProductDraft = z.infer<typeof productDraftSchema>;

export const MEDIA_KINDS = [
  "logo",
  "banner",
  "productImage",
  "productVideo",
] as const satisfies readonly MediaKind[];

/** An uploaded file (`merchantMedia/{mediaId}`) and what processing found. */
export const merchantMediaSchema = z.object({
  id: idSchema,
  vendorId: idSchema,
  shopId: idSchema,
  ownerUid: idSchema,
  kind: z.enum(MEDIA_KINDS),
  /** Storage object path: the tmp path until processed, then the permanent one. */
  path: z.string().min(1).max(400),
  contentType: z.string().min(1).max(100),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  durationSeconds: z.number().positive().optional(),
  bytes: z.number().int().nonnegative(),
  blurDataURL: z.string().startsWith("data:image/").max(2000).optional(),
  dominantColor: hexColorSchema.optional(),
  alt: z.string().max(200),
  status: z.enum(["tmp", "attached", "orphaned"]),
  createdAt: timestampSchema,
  processedAt: timestampSchema.optional(),
  /** When it stopped being used; the cleanup job counts its grace period from here. */
  orphanedAt: timestampSchema.optional(),
});
export type MerchantMedia = z.infer<typeof merchantMediaSchema>;

// ---------------------------------------------------------------- account forms

/** Lets password checks run alongside other field errors, so a submit shows every problem at once. */
const alwaysForObjects = (payload: { value: unknown }) =>
  typeof payload.value === "object" && payload.value !== null;

const newPasswordSchema = z
  .string()
  .min(1, "Enter a password")
  .max(PASSWORD_MAX_LENGTH, `Use ${PASSWORD_MAX_LENGTH} characters or fewer`);

const acceptTermsSchema = z.literal(true, { error: "Accept the merchant terms to continue" });

/** `/merchant/register` for a new account. */
export const merchantRegisterSchema = z
  .object({
    email: merchantEmailSchema,
    username: usernameSchema,
    password: newPasswordSchema,
    confirmPassword: z.string(),
    acceptTerms: acceptTermsSchema,
  })
  .superRefine(
    (value, ctx) => {
      // Runs even when other fields are invalid (see `when`), so values may be partial.
      const password = typeof value.password === "string" ? value.password : "";
      if (!password) return;
      const inputs = [value.email, value.username].filter((v) => typeof v === "string");
      const problem = passwordProblem(password, inputs);
      if (problem) ctx.addIssue({ code: "custom", path: ["password"], message: problem });
      if (password !== value.confirmPassword) {
        ctx.addIssue({
          code: "custom",
          path: ["confirmPassword"],
          message: "The passwords don't match",
        });
      }
    },
    { when: alwaysForObjects },
  );
export type MerchantRegisterInput = z.infer<typeof merchantRegisterSchema>;

/** `/merchant/register` for a signed-in shopper adding a shop to their account. */
export const merchantUpgradeSchema = z.object({
  username: usernameSchema,
  acceptTerms: acceptTermsSchema,
});

/** `/merchant/sign-in`: email or username, plus password. */
export const merchantSignInSchema = z.object({
  identifier: z.string().trim().min(1, "Enter your email or username").max(254),
  password: z.string().min(1, "Enter your password").max(PASSWORD_MAX_LENGTH),
  next: z.string().max(2048).optional(),
});

/** `/merchant/forgot-password`. */
export const merchantForgotPasswordSchema = z.object({ email: merchantEmailSchema });

/** `/merchant/reset-password`: the email isn't known until the code is checked on the server. */
export const merchantResetPasswordSchema = z
  .object({
    oobCode: z.string().min(1).max(2000),
    password: newPasswordSchema,
    confirmPassword: z.string(),
  })
  .superRefine(
    (value, ctx) => {
      const password = typeof value.password === "string" ? value.password : "";
      if (!password) return;
      const problem = passwordProblem(password);
      if (problem) ctx.addIssue({ code: "custom", path: ["password"], message: problem });
      if (password !== value.confirmPassword) {
        ctx.addIssue({
          code: "custom",
          path: ["confirmPassword"],
          message: "The passwords don't match",
        });
      }
    },
    { when: alwaysForObjects },
  );

// ---------------------------------------------------------------- settings

/** Settings › Account. Email changes are re-verified; usernames change once per 30 days. */
export const merchantAccountSettingsSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "Enter a display name")
    .max(80, "Use 80 characters or fewer"),
  email: merchantEmailSchema,
  username: usernameSchema,
});

/** Settings › Security. The server also checks the current password. */
export const merchantChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password").max(PASSWORD_MAX_LENGTH),
    newPassword: newPasswordSchema,
    confirmPassword: z.string(),
  })
  .superRefine(
    (value, ctx) => {
      const password = typeof value.newPassword === "string" ? value.newPassword : "";
      if (!password) return;
      const problem = passwordProblem(password);
      if (problem) ctx.addIssue({ code: "custom", path: ["newPassword"], message: problem });
      if (password !== value.confirmPassword) {
        ctx.addIssue({
          code: "custom",
          path: ["confirmPassword"],
          message: "The passwords don't match",
        });
      }
    },
    { when: alwaysForObjects },
  );

/** Settings › Notifications: the optional emails. */
export const merchantNotificationSettingsSchema = z.object({
  newOrders: z.boolean(),
  productReviews: z.boolean(),
});

// ---------------------------------------------------------------- shop forms

const focalSchema = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) });

/** Onboarding step 2 / Shop › Branding. Media ids come from the upload pipeline. */
export const shopBrandingInputSchema = z.object({
  shopId: idSchema,
  logoMediaId: idSchema.optional(),
  bannerMediaId: idSchema.optional(),
  bannerFocal: focalSchema.optional(),
  accent: z.enum(ACCENT_VALUES),
});
export type ShopBrandingInput = z.infer<typeof shopBrandingInputSchema>;

/** Onboarding step 3 / Shop › Policies. Optional fields arrive as "" from forms. */
export const shopContactInputSchema = z.object({
  shopId: idSchema,
  contact: z.object({
    email: merchantEmailSchema,
    phone: e164PhoneSchema.optional().or(z.literal("").transform(() => undefined)),
    website: websiteSchema.optional().or(z.literal("").transform(() => undefined)),
  }),
  social: z.object({
    instagram: handle("instagram")
      .optional()
      .or(z.literal("").transform(() => undefined)),
    tiktok: handle("tiktok")
      .optional()
      .or(z.literal("").transform(() => undefined)),
    facebook: handle("facebook")
      .optional()
      .or(z.literal("").transform(() => undefined)),
  }),
  returnPolicy: returnPolicySchema,
  shipping: z.object({
    shipsFromLocationId: idSchema.optional().or(z.literal("").transform(() => undefined)),
    processingTime: processingTimeSchema,
  }),
});
export type ShopContactInput = z.infer<typeof shopContactInputSchema>;

/** Onboarding step 4 / Shop › Locations: one location, new or edited. */
export const locationInputSchema = z
  .object({
    shopId: idSchema,
    locationId: idSchema.optional(),
    name: z.string().trim().min(1, "Enter a name for this location").max(80),
    types: z.array(z.enum(LOCATION_TYPE_VALUES)).min(1, "Choose what this location is"),
    address: locationAddressSchema.omit({ country: true }),
    timezone: z.string().max(64).optional(),
    hours: weeklyHoursSchema,
    specialHours: z.array(specialHoursSchema).max(MERCHANT_LIMITS.location.specialHoursMax),
    phone: e164PhoneSchema.optional().or(z.literal("").transform(() => undefined)),
  })
  .superRefine((value, ctx) => {
    const [problem] = weeklyHoursProblems(value.hours);
    if (problem) ctx.addIssue({ code: "custom", path: ["hours"], message: problem });
    if (value.types.includes("retail") && value.hours.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["hours"],
        message: "Add opening hours so shoppers know when to visit",
      });
    }
  });
export type LocationInput = z.infer<typeof locationInputSchema>;

// ---------------------------------------------------------------- product editor

/** One photo in a colour's gallery. `altConfirmed` stays false until the merchant checks the suggestion. */
export const draftImageSchema = merchantImageSchema.extend({
  altConfirmed: z.boolean(),
  focal: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).optional(),
});
export type DraftImage = z.infer<typeof draftImageSchema>;

export const draftColorSchema = z.object({
  /** Stable id, so renaming a colour keeps its variants and photos. */
  code: z.string().regex(/^[a-z0-9-]{1,40}$/),
  name: z.string().trim().max(40),
  family: colorFamilySchema,
  swatch: hexColorSchema,
  images: z.array(draftImageSchema).max(MERCHANT_LIMITS.productImage.maxPerColor),
  video: z
    .object({ mediaId: idSchema, url: z.string().min(1), durationSeconds: z.number().positive() })
    .optional(),
});
export type DraftColor = z.infer<typeof draftColorSchema>;

const cents = z.number().int().nonnegative();

export const matrixRowSchema = z.object({
  key: z.string().max(200),
  color: z.string().max(40),
  fit: fitFamilySchema,
  size: z.string().max(20),
  sku: z.string().trim().max(64),
  price: cents.nullable(),
  compareAtPrice: cents.nullable(),
  stock: z.record(z.string(), z.number().int().nonnegative()),
  barcode: z.string().trim().max(32),
  weightGrams: z.number().int().nonnegative().nullable(),
  availableOnline: z.boolean(),
  backorder: z.boolean(),
  lowStockThreshold: z.number().int().nonnegative().max(9999),
});

/**
 * Everything the product editor holds. Autosave accepts incomplete work, so
 * fields are lenient here; submit and publish run the strict checks.
 */
export const productDraftDataSchema = z.object({
  name: z.string().max(MERCHANT_LIMITS.product.nameMax),
  description: z.string().max(MERCHANT_LIMITS.product.descriptionMax),
  highlights: z
    .array(z.string().max(MERCHANT_LIMITS.product.highlightMax))
    .max(MERCHANT_LIMITS.product.highlightsMax),
  categoryKey: z.string().max(120),
  styleId: z.string().trim().max(40),
  attributes: z.record(z.string(), z.union([z.string(), z.array(z.string())])),
  composition: z
    .array(z.object({ material: z.string().max(40), percent: z.number().int().min(0).max(100) }))
    .max(8),
  colors: z.array(draftColorSchema).max(30),
  fits: z.array(fitFamilySchema),
  sizes: z.array(z.string().max(20)).max(60),
  excluded: z.array(z.string().max(200)),
  matrix: z.array(matrixRowSchema).max(MERCHANT_LIMITS.product.maxVariants),
  parked: z.array(matrixRowSchema).max(MERCHANT_LIMITS.product.maxVariants),
  details: z.object({
    fitNotes: z.string().max(500),
    modelInfo: z.string().max(200),
    care: z.array(z.string().max(200)).max(8),
    sizeGuide: z.enum(["platform", "custom"]),
    customGuide: z.array(z.array(z.string().max(30)).max(10)).max(30),
  }),
  shipping: z.object({
    weightGrams: z.number().int().nonnegative().nullable(),
    lengthCm: z.number().nonnegative().nullable(),
    widthCm: z.number().nonnegative().nullable(),
    heightCm: z.number().nonnegative().nullable(),
    shipsFromLocationId: z.string().max(128),
    processingTime: z.preprocess(
      (value) => (value === "5-10" ? "3-5" : value),
      z.enum(["", ...PROCESSING_TIME_VALUES]),
    ),
  }),
  seo: z.object({ title: z.string().max(70), description: z.string().max(160) }),
  slug: z.string().max(120),
  searchKeywords: z.array(z.string().max(60)).max(MERCHANT_LIMITS.product.keywordsMax),
  /** ISO date-time for a scheduled publish, or "". */
  publishAt: z.string().max(40),
});
export type ProductDraftData = z.infer<typeof productDraftDataSchema>;

/** What the product list shows, maintained by the server on every save. */
export const draftSummarySchema = z.object({
  name: z.string(),
  categoryKey: z.string(),
  image: z.string().optional(),
  colors: z.number().int().nonnegative(),
  variants: z.number().int().nonnegative(),
  priceMin: cents.nullable(),
  priceMax: cents.nullable(),
  stock: z.number().int().nonnegative(),
  lowStock: z.boolean(),
});
export type DraftSummary = z.infer<typeof draftSummarySchema>;
