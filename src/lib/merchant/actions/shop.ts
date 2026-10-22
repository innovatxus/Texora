"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { ActionError, runAction } from "@/lib/actions/run-action";
import type { Session } from "@/lib/auth/session";
import { clientIp, consumeRateLimit, RATE_LIMITED_MESSAGE } from "@/lib/security/rate-limit";
import {
  locationInputSchema,
  shopBasicsSchema,
  shopBrandingInputSchema,
  shopContactInputSchema,
  shopSlugSchema,
} from "@/lib/validation/merchant";
import { ACTIVE_SHOP_COOKIE } from "../context";
import { getOwnedShop, isShopSlugAvailable } from "../repositories/shops";
import {
  archiveLocation,
  closeShop,
  moveLocation,
  reopenShop,
  saveLocation,
  saveShopBasics,
  saveShopBranding,
  saveShopContact,
  setPrimaryLocation,
  submitShop,
  type MerchantActor,
} from "../shop-service";

/** The acting merchant, from the session only. */
function actorOf(session: Session | null): MerchantActor {
  if (!session?.vendorId) throw new ActionError("forbidden", "You don't have a merchant account");
  return { session, vendorId: session.vendorId };
}

const shopIdSchema = z.object({ shopId: z.string().min(1).max(128) });

/** Live check for the shop address field (debounced client-side, rate-limited here). */
export async function checkShopSlugAvailability(input: unknown) {
  return runAction(input, {
    schema: z.object({ slug: z.string().max(80), shopId: z.string().max(128).optional() }),
    access: { permission: "merchant.shop.write" },
    handler: async ({ slug, shopId }) => {
      if (!(await consumeRateLimit("availability", await clientIp())).allowed) {
        throw new ActionError("limit_exceeded", RATE_LIMITED_MESSAGE);
      }
      const parsed = shopSlugSchema.safeParse(slug);
      if (!parsed.success) {
        return {
          slug: slug.trim().toLowerCase(),
          available: false,
          message: parsed.error.issues[0]?.message ?? "Choose another address",
        };
      }
      const available = await isShopSlugAvailable(parsed.data, shopId);
      return {
        slug: parsed.data,
        available,
        message: available ? "Available" : "That address is taken",
      };
    },
  });
}

/** Onboarding step 1 / Shop › Profile. Creates the shop the first time. */
export async function saveShopBasicsAction(input: unknown) {
  return runAction(input, {
    schema: shopBasicsSchema.extend({ shopId: z.string().min(1).max(128).optional() }),
    access: { permission: "merchant.shop.write" },
    handler: async ({ shopId, ...basics }, { session }) => {
      const shop = await saveShopBasics(actorOf(session), basics, shopId);
      return { shopId: shop.id, slug: shop.slug };
    },
  });
}

/** Onboarding step 2 / Shop › Branding. */
export async function saveShopBrandingAction(input: unknown) {
  return runAction(input, {
    schema: shopBrandingInputSchema,
    access: { permission: "merchant.shop.write" },
    handler: async (data, { session }) => {
      await saveShopBranding(actorOf(session), data);
      return { saved: true };
    },
  });
}

/** Onboarding step 3 / Shop › Policies. */
export async function saveShopContactAction(input: unknown) {
  return runAction(input, {
    schema: shopContactInputSchema,
    access: { permission: "merchant.shop.write" },
    handler: async (data, { session }) => {
      await saveShopContact(actorOf(session), data);
      return { saved: true };
    },
  });
}

/** Adds or edits a location. */
export async function saveLocationAction(input: unknown) {
  return runAction(input, {
    schema: locationInputSchema,
    access: { permission: "merchant.locations.write" },
    handler: async (data, { session }) => {
      const location = await saveLocation(actorOf(session), data);
      return { locationId: location.id };
    },
  });
}

/** Archives, promotes or reorders a location. */
export async function updateLocationAction(input: unknown) {
  return runAction(input, {
    schema: shopIdSchema.extend({
      locationId: z.string().min(1).max(128),
      operation: z.enum(["archive", "primary", "up", "down"]),
    }),
    access: { permission: "merchant.locations.write" },
    handler: async ({ shopId, locationId, operation }, { session }) => {
      const actor = actorOf(session);
      if (operation === "archive") await archiveLocation(actor, shopId, locationId);
      else if (operation === "primary") await setPrimaryLocation(actor, shopId, locationId);
      else await moveLocation(actor, shopId, locationId, operation);
      return { done: true };
    },
  });
}

/** Onboarding step 5: submit for review. */
export async function submitShopAction(input: unknown) {
  return runAction(input, {
    schema: shopIdSchema,
    access: { permission: "merchant.shop.write" },
    handler: async ({ shopId }, { session }) => {
      await submitShop(actorOf(session), shopId);
      return { redirectTo: "/merchant" };
    },
  });
}

/** Shop settings: close (reversible for 30 days) or reopen. */
export async function setShopOpenAction(input: unknown) {
  return runAction(input, {
    schema: shopIdSchema.extend({ open: z.boolean() }),
    access: { permission: "merchant.shop.write" },
    handler: async ({ shopId, open }, { session }) => {
      const actor = actorOf(session);
      if (open) await reopenShop(actor, shopId);
      else await closeShop(actor, shopId);
      return { open };
    },
  });
}

/** Shop switcher: remembers which of the merchant's shops to manage. */
export async function selectShopAction(input: unknown) {
  return runAction(input, {
    schema: shopIdSchema,
    access: { permission: "merchant.shop.write" },
    handler: async ({ shopId }, { session }) => {
      const actor = actorOf(session);
      await getOwnedShop(actor.vendorId, shopId);
      (await cookies()).set(ACTIVE_SHOP_COOKIE, shopId, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/merchant",
        maxAge: 60 * 60 * 24 * 365,
      });
      return { shopId };
    },
  });
}
