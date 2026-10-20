"use server";

import { z } from "zod";
import { ActionError, runAction } from "@/lib/actions/run-action";
import { ROLES } from "@/lib/auth/rbac";
import { cmsModuleSchema } from "@/lib/cms/modules";
import { AUDIENCES, PROMOTION_TYPES } from "@/lib/validation";
import {
  generatePromoCodes,
  moderateReview,
  savePromotion,
  setPromoCodeActive,
} from "./merch-service";
import {
  addCustomerNote,
  adjustLoyalty,
  changeRole,
  inviteStaff,
  revokeSessions,
} from "./people-service";
import { savePage, updateSettings, updateStore } from "./site-service";

const id = z.string().min(1).max(128);
const dollars = z.coerce
  .number("Enter an amount")
  .min(0, "Enter zero or more")
  .max(100_000)
  .transform((v) => Math.round(v * 100));
const optionalDate = z
  .string()
  .optional()
  .transform((v, ctx) => {
    if (!v) return undefined;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({ code: "custom", message: "Enter a valid date" });
      return z.NEVER;
    }
    return d;
  });

const session = (s: Parameters<Parameters<typeof runAction>[1]["handler"]>[1]["session"]) => {
  if (!s) throw new ActionError("unauthenticated", "Sign in again");
  return s;
};

// ------------------------------------------------------------ promotions

/** Creates or updates a promotion from the promotion form. */
export async function savePromotionAction(input: unknown) {
  return runAction(input, {
    schema: z
      .object({
        id: id.optional(),
        name: z.string().trim().min(2, "Enter a name").max(80),
        type: z.enum(PROMOTION_TYPES),
        value: z.coerce.number().min(0).max(100_000),
        minSubtotal: z.union([z.literal(""), dollars]).optional(),
        categoryKeys: z.string().max(500).optional(),
        excludeSale: z.boolean().optional(),
        automatic: z.boolean().optional(),
        stackable: z.boolean().optional(),
        active: z.boolean().optional(),
        priority: z.coerce.number().int().min(0).max(1000),
        audience: z.enum(AUDIENCES),
        startsAt: optionalDate,
        endsAt: optionalDate,
        tiers: z.string().max(500).optional(),
      })
      .refine((p) => p.type !== "percent" || p.value <= 100, {
        message: "A percentage can't be over 100",
        path: ["value"],
      })
      .refine((p) => !p.startsAt || !p.endsAt || p.endsAt > p.startsAt, {
        message: "The end must be after the start",
        path: ["endsAt"],
      }),
    access: { permission: "promotions.write" },
    handler: async (p, ctx) => {
      // Tiers: "100:10, 200:20" = spend $100 get value 10, spend $200 get 20.
      const tiers =
        p.type === "tiered" && p.tiers
          ? p.tiers.split(",").map((t) => {
              const [spend, value] = t.split(":").map((n) => Number(n.trim()));
              if (!spend || value === undefined || Number.isNaN(value)) {
                throw new ActionError("conflict", "Write tiers like 100:10, 200:20");
              }
              return { minSubtotal: Math.round(spend * 100), value };
            })
          : undefined;
      const value = p.type === "fixed" ? Math.round(p.value * 100) : p.value;
      const promotionId = await savePromotion(session(ctx.session), {
        ...(p.id ? { id: p.id } : {}),
        name: p.name,
        type: p.type,
        value,
        ...(tiers ? { tiers } : {}),
        conditions: {
          ...(typeof p.minSubtotal === "number" && p.minSubtotal > 0
            ? { minSubtotal: p.minSubtotal }
            : {}),
          ...(p.categoryKeys
            ? {
                categoryKeys: p.categoryKeys
                  .split(",")
                  .map((k) => k.trim())
                  .filter(Boolean),
              }
            : {}),
          ...(p.excludeSale ? { excludeSale: true } : {}),
        },
        automatic: p.automatic ?? false,
        stackable: p.stackable ?? false,
        priority: p.priority,
        audience: p.audience,
        schedule: {
          ...(p.startsAt ? { startsAt: p.startsAt } : {}),
          ...(p.endsAt ? { endsAt: p.endsAt } : {}),
        },
        active: p.active ?? false,
      });
      return { id: promotionId };
    },
  });
}

/** Generates a batch of codes for a promotion. */
export async function generateCodesAction(input: unknown) {
  return runAction(input, {
    schema: z.object({
      promotionId: id,
      prefix: z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[A-Z0-9]{2,12}$/, "Use 2–12 letters or numbers"),
      count: z.coerce.number().int().min(1, "At least one").max(500, "Up to 500 at a time"),
      usageLimit: z.union([z.literal(""), z.coerce.number().int().positive()]).optional(),
      perCustomerLimit: z.union([z.literal(""), z.coerce.number().int().positive()]).optional(),
    }),
    access: { permission: "promotions.write" },
    handler: async ({ promotionId, prefix, count, usageLimit, perCustomerLimit }, ctx) => {
      const codes = await generatePromoCodes(session(ctx.session), promotionId, {
        prefix,
        count,
        ...(typeof usageLimit === "number" ? { usageLimit } : {}),
        ...(typeof perCustomerLimit === "number" ? { perCustomerLimit } : {}),
      });
      return { count: codes.length, sample: codes.slice(0, 5) };
    },
  });
}

/** Turns a promo code on or off. */
export async function setPromoCodeActiveAction(input: unknown) {
  return runAction(input, {
    schema: z.object({ code: z.string().min(3).max(40), active: z.boolean() }),
    access: { permission: "promotions.write" },
    handler: async ({ code, active }, ctx) => {
      await setPromoCodeActive(session(ctx.session), code, active);
      return { active };
    },
  });
}

// --------------------------------------------------------------- reviews

/** Approves or rejects a review. */
export async function moderateReviewAction(input: unknown) {
  return runAction(input, {
    schema: z.object({ reviewId: id, decision: z.enum(["approved", "rejected"]) }),
    access: { permission: "reviews.moderate" },
    handler: async ({ reviewId, decision }, ctx) => {
      await moderateReview(session(ctx.session), reviewId, decision);
      return { decision };
    },
  });
}

// ------------------------------------------------------------- customers

/** Internal note on a customer. */
export async function addCustomerNoteAction(input: unknown) {
  return runAction(input, {
    schema: z.object({ uid: id, text: z.string().trim().min(1, "Write a note").max(2000) }),
    access: { permission: "customers.write" },
    handler: async ({ uid, text }, ctx) => {
      await addCustomerNote(session(ctx.session), uid, text);
      return { saved: true };
    },
  });
}

/** Adds or removes rewards points with a reason (audited). */
export async function adjustLoyaltyAction(input: unknown) {
  return runAction(input, {
    schema: z.object({
      uid: id,
      points: z.coerce
        .number("Enter a whole number, e.g. 500 or -200")
        .int("Enter a whole number")
        .min(-100_000)
        .max(100_000)
        .refine((n) => n !== 0, "Enter a change other than zero"),
      reason: z.string().trim().min(3, "Add a short reason").max(300),
    }),
    access: { permission: "loyalty.adjust" },
    handler: async ({ uid, points, reason }, ctx) => ({
      balance: await adjustLoyalty(session(ctx.session), uid, points, reason),
    }),
  });
}

// ------------------------------------------------------------ users

/** Invites a staff member with a role. */
export async function inviteStaffAction(input: unknown) {
  return runAction(input, {
    schema: z.object({
      email: z.email("Enter a valid email").max(254).toLowerCase(),
      firstName: z.string().trim().min(1, "Enter a first name").max(60),
      lastName: z.string().trim().min(1, "Enter a last name").max(60),
      role: z.enum(ROLES, "Choose a role"),
    }),
    access: { permission: "users.invite" },
    handler: async (invite, ctx) => inviteStaff(session(ctx.session), invite),
  });
}

/** Changes a user's role (policy-checked). */
export async function changeRoleAction(input: unknown) {
  return runAction(input, {
    schema: z.object({ uid: id, role: z.enum(ROLES) }),
    access: { permission: "users.assign_role" },
    handler: async ({ uid, role }, ctx) => {
      await changeRole(session(ctx.session), uid, role);
      return { role };
    },
  });
}

/** Signs a user out on every device. */
export async function revokeSessionsAction(input: unknown) {
  return runAction(input, {
    schema: z.object({ uid: id }),
    access: { permission: "users.revoke_sessions" },
    handler: async ({ uid }, ctx) => {
      await revokeSessions(session(ctx.session), uid);
      return { revoked: true };
    },
  });
}

// ------------------------------------------------------------ settings

/** Saves shipping, refund, reservation, loyalty and feature settings. */
export async function updateSettingsAction(input: unknown) {
  return runAction(input, {
    schema: z.object({
      freeShippingThreshold: dollars,
      standardRate: dollars,
      expressRate: dollars,
      refundLimit: dollars,
      reservationMinutes: z.coerce.number().int().min(1).max(120),
      pointsPerDollar: z.coerce.number().int().min(1).max(100),
      enthusiastThreshold: dollars,
      iconThreshold: dollars,
      birthdayPoints: z.coerce.number().int().min(0).max(100_000),
      cashOnDelivery: z.boolean().optional(),
      expressPay: z.boolean().optional(),
      quickView: z.boolean().optional(),
      vendorMarketplace: z.boolean().optional(),
    }),
    access: { permission: "settings.write" },
    handler: async (s, ctx) => {
      await updateSettings(session(ctx.session), {
        freeShippingThreshold: s.freeShippingThreshold,
        shippingRates: { standard: s.standardRate, express: s.expressRate },
        refundLimits: { customer_service: s.refundLimit },
        reservationMinutes: s.reservationMinutes,
        loyalty: {
          pointsPerCurrencyUnit: s.pointsPerDollar,
          tierThresholds: { enthusiast: s.enthusiastThreshold, icon: s.iconThreshold },
          birthdayRewardPoints: s.birthdayPoints,
        },
        features: {
          cashOnDelivery: s.cashOnDelivery ?? false,
          expressPay: s.expressPay ?? false,
          quickView: s.quickView ?? false,
          vendorMarketplace: s.vendorMarketplace ?? false,
        },
      });
      return { saved: true };
    },
  });
}

/** Updates a store's phone, status and services. */
export async function updateStoreAction(input: unknown) {
  return runAction(input, {
    schema: z.object({
      storeId: id,
      phone: z.string().trim().min(7, "Enter a phone number").max(30),
      status: z.enum(["open", "temporarily_closed", "closed"]),
      returns: z.boolean().optional(),
      alterations: z.boolean().optional(),
      styling: z.boolean().optional(),
    }),
    access: { permission: "settings.write" },
    handler: async ({ storeId, phone, status, ...services }, ctx) => {
      await updateStore(session(ctx.session), storeId, {
        phone,
        status,
        services: (["returns", "alterations", "styling"] as const).filter((s) => services[s]),
      });
      return { saved: true };
    },
  });
}

// ------------------------------------------------------------- content

/** Saves a CMS page: details plus its validated, ordered modules. */
export async function savePageAction(input: unknown) {
  return runAction(input, {
    schema: z.object({
      slug: z.string().min(1).max(120),
      title: z.string().trim().min(1).max(120),
      status: z.enum(["draft", "scheduled", "live", "archived"]),
      seo: z.object({
        title: z.string().max(70).optional(),
        description: z.string().max(160).optional(),
      }),
      modules: z.array(cmsModuleSchema).max(30),
    }),
    access: { permission: "content.write" },
    handler: async ({ slug, ...page }, ctx) => {
      await savePage(session(ctx.session), slug, page);
      return { saved: true };
    },
  });
}
