import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { createElement } from "react";
import { brand } from "@/config/brand";
import { MERCHANT_LIMITS, MERCHANT_TEAM_EMAIL } from "@/config/merchant";
import { ActionError } from "@/lib/actions/run-action";
import { invalidate } from "@/lib/admin/revalidate";
import { writeAuditLog } from "@/lib/audit/log";
import type { Session } from "@/lib/auth/session";
import { listLiveCategories } from "@/lib/data/catalog-structure";
import { getStoreSettings } from "@/lib/data/admin-records";
import { sendEmail } from "@/lib/email/send";
import { ShopReviewRequestEmail, ShopSubmittedEmail } from "@/lib/email/templates/MerchantShop";
import { clientEnv } from "@/lib/env/client";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { logger } from "@/lib/observability/logger";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import {
  EMPTY_SHOP_COUNTERS,
  type LocationInput,
  type Merchant,
  type MerchantImage,
  type MerchantLocation,
  type OnboardingStep,
  type Shop,
  type ShopBasics,
  type ShopBrandingInput,
  type ShopContactInput,
} from "@/lib/validation/merchant";
import { COUNTRY, TIME_ZONE } from "@/config/locale";
import { geocodeByGovernorate } from "./geo";
import { attachMedia, orphanMedia, requireOwnedMedia } from "./media/media-service";
import { nextStep, shipFromCount, shopBlockers } from "./onboarding";
import { syncShopProducts } from "./publishing/publish";
import { getLocation, listLocations } from "./repositories/locations";
import { getMerchant } from "./repositories/merchants";
import { claimShopSlug, getOwnedShop, getShop, ShopSlugTakenError } from "./repositories/shops";
import { assertShopTransition, isShopEditable, TransitionError } from "./status";

/** The merchant acting, as derived from the session (never from client input). */
export interface MerchantActor {
  session: Session;
  vendorId: string;
}

const db = () => getFirebaseAdmin().db;
const shopRef = (id: string) => db().collection("shops").doc(id);
const locationRef = (shopId: string, id: string) => shopRef(shopId).collection("locations").doc(id);

function siteUrl(path: string): string {
  return new URL(path, clientEnv.NEXT_PUBLIC_SITE_URL).toString();
}

/** Storefront tags to refresh when a live shop changes. */
function refreshStorefront(shop: Pick<Shop, "slug" | "status">, previousSlug?: string): void {
  if (shop.status !== "approved") return;
  invalidate("shops", `shop:${shop.slug}`, ...(previousSlug ? [`shop:${previousSlug}`] : []));
}

async function editableShop(actor: MerchantActor, shopId: string): Promise<Shop> {
  const shop = await getOwnedShop(actor.vendorId, shopId);
  if (!isShopEditable(shop.status)) {
    throw new ActionError(
      "conflict",
      shop.status === "suspended"
        ? "Your shop is paused. Contact merchant support to make changes."
        : "Your shop is closed. Reopen it to make changes.",
    );
  }
  return shop;
}

function completed(shop: Pick<Shop, "completedSteps">, step: OnboardingStep): OnboardingStep[] {
  return [...new Set([...shop.completedSteps, step])];
}

/** Categories must be live leaves in the chosen departments. */
async function validateCategories(input: Pick<ShopBasics, "departments" | "categoryKeys">) {
  const lists = await Promise.all(input.departments.map((d) => listLiveCategories(d)));
  const leaves = new Set(
    lists
      .flat()
      .filter((c) => c.parentId !== null)
      .map((c) => c.path.join("/")),
  );
  const unknown = input.categoryKeys.filter((key) => !leaves.has(key));
  if (unknown.length > 0) {
    throw new ActionError(
      "conflict",
      "Choose categories from the departments you selected",
      "categoryKeys",
    );
  }
}

// ---------------------------------------------------------------- step 1: basics

/**
 * Creates the merchant's shop from step 1, or updates its basics. The shop
 * address is reserved in the same transaction (the lock guarantees
 * uniqueness) and the previous address is released.
 */
export async function saveShopBasics(
  actor: MerchantActor,
  input: ShopBasics,
  shopId?: string,
  now: Date = new Date(),
): Promise<Shop> {
  await validateCategories(input);
  const merchant = await getMerchant(actor.vendorId);
  if (!merchant) throw new ActionError("not_found", "We couldn't find your merchant account.");

  const existing = shopId ? await editableShop(actor, shopId) : null;
  if (!existing && merchant.shopIds.length >= MERCHANT_LIMITS.shop.maxPerMerchant) {
    throw new ActionError(
      "limit_exceeded",
      `You can have up to ${MERCHANT_LIMITS.shop.maxPerMerchant} shops.`,
    );
  }

  const ref = existing ? shopRef(existing.id) : db().collection("shops").doc();
  try {
    await db().runTransaction(async (tx) => {
      await claimShopSlug(
        tx,
        input.slug,
        { shopId: ref.id, vendorId: actor.vendorId },
        now,
        existing?.slug,
      );
      if (existing) {
        tx.update(ref, {
          ...input,
          completedSteps: completed(existing, "basics"),
          updatedAt: now,
        });
        return;
      }
      const shop: Omit<Shop, "id"> = {
        ...input,
        vendorId: actor.vendorId,
        accent: "ink",
        contact: { email: merchant.email },
        social: {},
        returnPolicy: { mode: "platform" },
        shipping: { processingTime: "1-2" },
        status: "draft",
        reviewNotes: [],
        onboardingStep: "branding",
        completedSteps: ["basics"],
        counters: EMPTY_SHOP_COUNTERS,
        createdAt: now,
        updatedAt: now,
      };
      tx.create(ref, shop);
      tx.update(db().collection("merchants").doc(actor.vendorId), {
        shopIds: [...merchant.shopIds, ref.id],
        updatedAt: now,
      });
    });
  } catch (error) {
    if (error instanceof ShopSlugTakenError) {
      throw new ActionError("conflict", "That address is taken", "slug");
    }
    throw error;
  }

  await writeAuditLog({
    actor: actor.session,
    action: existing ? "shops.update_basics" : "shops.create",
    target: { type: "shop", id: ref.id },
    before: existing ? { name: existing.name, slug: existing.slug } : null,
    after: { name: input.name, slug: input.slug },
  });
  const saved = (await getShop(ref.id)) as Shop;
  refreshStorefront(saved, existing?.slug !== input.slug ? existing?.slug : undefined);
  // Products carry the shop's name and address (D-062 denormalisation).
  if (existing && saved.status === "approved") await syncShopProducts(saved.id);
  return saved;
}

// ---------------------------------------------------------------- step 2: branding

function toImage(media: Awaited<ReturnType<typeof requireOwnedMedia>>[number], alt: string) {
  if (!media.width || !media.height || !media.blurDataURL || !media.dominantColor) {
    throw new ActionError("conflict", "That file isn't an image. Upload a PNG, JPG or WebP.");
  }
  const file = media.path.split("/").at(-1) ?? "";
  const image: MerchantImage = {
    mediaId: media.id,
    url: `/media/m/${media.vendorId}/${media.shopId}/${file}`,
    alt,
    width: media.width,
    height: media.height,
    blurDataURL: media.blurDataURL,
    dominantColor: media.dominantColor,
  };
  return image;
}

/** Saves logo, banner (with focal point) and accent; replaced media is released for cleanup. */
export async function saveShopBranding(
  actor: MerchantActor,
  input: ShopBrandingInput,
  now: Date = new Date(),
): Promise<Shop> {
  const shop = await editableShop(actor, input.shopId);
  const ids = [input.logoMediaId, input.bannerMediaId].filter((id): id is string => Boolean(id));
  const media = await requireOwnedMedia(actor.vendorId, ids);
  const byId = new Map(media.map((m) => [m.id, m]));
  const logoMedia = input.logoMediaId ? byId.get(input.logoMediaId) : undefined;
  const bannerMedia = input.bannerMediaId ? byId.get(input.bannerMediaId) : undefined;
  if (logoMedia && (logoMedia.kind !== "logo" || logoMedia.shopId !== shop.id)) {
    throw new ActionError("conflict", "Upload your logo again.");
  }
  if (bannerMedia && (bannerMedia.kind !== "banner" || bannerMedia.shopId !== shop.id)) {
    throw new ActionError("conflict", "Upload your banner again.");
  }

  const logo = logoMedia ? toImage(logoMedia, `${shop.name} logo`) : shop.logo;
  const bannerBase = bannerMedia ? toImage(bannerMedia, `${shop.name} banner`) : shop.banner;
  const banner = bannerBase
    ? { ...bannerBase, ...(input.bannerFocal ? { focal: input.bannerFocal } : {}) }
    : undefined;

  const replaced = [
    logoMedia && shop.logo && shop.logo.mediaId !== logoMedia.id ? shop.logo.mediaId : null,
    bannerMedia && shop.banner && shop.banner.mediaId !== bannerMedia.id
      ? shop.banner.mediaId
      : null,
  ].filter((id): id is string => id !== null);

  await db().runTransaction(async (tx) => {
    tx.update(shopRef(shop.id), {
      ...(logo ? { logo } : {}),
      ...(banner ? { banner } : {}),
      accent: input.accent,
      completedSteps: completed(shop, "branding"),
      onboardingStep: shop.status === "draft" ? nextStep("branding") : shop.onboardingStep,
      updatedAt: now,
    });
    attachMedia(tx, ids);
    orphanMedia(tx, replaced, now);
  });
  await writeAuditLog({
    actor: actor.session,
    action: "shops.update_branding",
    target: { type: "shop", id: shop.id },
    before: { logo: shop.logo?.mediaId ?? null, banner: shop.banner?.mediaId ?? null },
    after: { logo: logo?.mediaId ?? null, banner: banner?.mediaId ?? null, accent: input.accent },
  });
  const saved = (await getShop(shop.id)) as Shop;
  refreshStorefront(saved);
  if (logoMedia && saved.status === "approved") await syncShopProducts(saved.id);
  return saved;
}

// ---------------------------------------------------------------- step 3: contact & policies

/** Saves contact details, social handles, return policy and shipping settings. */
export async function saveShopContact(
  actor: MerchantActor,
  input: ShopContactInput,
  now: Date = new Date(),
): Promise<Shop> {
  const shop = await editableShop(actor, input.shopId);
  if (input.shipping.shipsFromLocationId) {
    const location = await getLocation(shop.id, input.shipping.shipsFromLocationId);
    if (!location || location.status !== "active" || !location.types.includes("ship_from")) {
      throw new ActionError(
        "conflict",
        "Choose one of your ship-from locations",
        "shipping.shipsFromLocationId",
      );
    }
  }
  const strip = <T extends Record<string, unknown>>(value: T) =>
    Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;
  await shopRef(shop.id).update({
    contact: strip(input.contact),
    social: strip(input.social),
    returnPolicy: input.returnPolicy,
    shipping: strip(input.shipping),
    completedSteps: completed(shop, "contact"),
    onboardingStep: shop.status === "draft" ? nextStep("contact") : shop.onboardingStep,
    updatedAt: now,
  });
  await writeAuditLog({
    actor: actor.session,
    action: "shops.update_policies",
    target: { type: "shop", id: shop.id },
    before: { returnPolicy: shop.returnPolicy, shipping: shop.shipping },
    after: { returnPolicy: input.returnPolicy, shipping: strip(input.shipping) },
  });
  const saved = (await getShop(shop.id)) as Shop;
  refreshStorefront(saved);
  return saved;
}

// ---------------------------------------------------------------- step 4: locations

/** Adds or edits a location, filling an approximate position from the governorate. */
export async function saveLocation(
  actor: MerchantActor,
  input: LocationInput,
  now: Date = new Date(),
): Promise<MerchantLocation> {
  const shop = await editableShop(actor, input.shopId);
  const geocoded = geocodeByGovernorate(input.address.region);
  const all = await listLocations(shop.id, { includeArchived: true });
  const existing = input.locationId ? all.find((l) => l.id === input.locationId) : undefined;
  if (input.locationId && !existing)
    throw new ActionError("not_found", "We couldn't find that location.");
  const active = all.filter((l) => l.status === "active");
  if (!existing && active.length >= MERCHANT_LIMITS.location.maxPerShop) {
    throw new ActionError(
      "limit_exceeded",
      `You can add up to ${MERCHANT_LIMITS.location.maxPerShop} locations.`,
    );
  }
  if (
    existing?.types.includes("ship_from") &&
    !input.types.includes("ship_from") &&
    shipFromCount(active) === 1
  ) {
    throw new ActionError("conflict", "Keep at least one ship-from location", "types");
  }

  const ref = existing
    ? locationRef(shop.id, existing.id)
    : shopRef(shop.id).collection("locations").doc();
  const record: Omit<MerchantLocation, "id"> = {
    shopId: shop.id,
    vendorId: actor.vendorId,
    name: input.name,
    types: input.types,
    address: {
      ...input.address,
      ...(input.address.postalCode ? {} : { postalCode: undefined }),
      country: COUNTRY,
    },
    ...(geocoded?.geo ? { geo: geocoded.geo } : {}),
    timezone: input.timezone || geocoded?.timezone || TIME_ZONE,
    hours: [...input.hours].sort((a, b) => a.day - b.day || a.open.localeCompare(b.open)),
    specialHours: [...input.specialHours].sort((a, b) => a.date.localeCompare(b.date)),
    ...(input.phone ? { phone: input.phone } : {}),
    isPrimary: existing?.isPrimary ?? active.length === 0,
    sortOrder: existing?.sortOrder ?? (all.at(-1)?.sortOrder ?? -1) + 1,
    status: "active",
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  await db().runTransaction(async (tx) => {
    tx.set(ref, record);
    const shopUpdate: Record<string, unknown> = { updatedAt: now };
    if (shipFromCount([...active.filter((l) => l.id !== ref.id), { ...record, id: ref.id }]) > 0) {
      shopUpdate.completedSteps = completed(shop, "locations");
      if (shop.status === "draft") shopUpdate.onboardingStep = nextStep("locations");
    }
    // The first ship-from location becomes the default ships-from.
    if (!shop.shipping.shipsFromLocationId && record.types.includes("ship_from")) {
      shopUpdate["shipping.shipsFromLocationId"] = ref.id;
    }
    tx.update(shopRef(shop.id), shopUpdate);
  });
  await writeAuditLog({
    actor: actor.session,
    action: existing ? "shops.update_location" : "shops.add_location",
    target: { type: "shop", id: shop.id },
    after: { locationId: ref.id, name: record.name, types: record.types },
  });
  refreshStorefront(shop);
  return { ...record, id: ref.id };
}

/**
 * Archives a location (never a hard delete: stock may reference it). The last
 * ship-from location can't be archived; a primary one hands primary on.
 */
export async function archiveLocation(
  actor: MerchantActor,
  shopId: string,
  locationId: string,
  now: Date = new Date(),
): Promise<void> {
  const shop = await editableShop(actor, shopId);
  const active = await listLocations(shop.id);
  const target = active.find((l) => l.id === locationId);
  if (!target) throw new ActionError("not_found", "We couldn't find that location.");
  if (target.types.includes("ship_from") && shipFromCount(active) === 1) {
    throw new ActionError("conflict", "Add another ship-from location before archiving this one.");
  }
  const remaining = active.filter((l) => l.id !== locationId);
  await db().runTransaction(async (tx) => {
    tx.update(locationRef(shop.id, locationId), {
      status: "archived",
      isPrimary: false,
      updatedAt: now,
    });
    if (target.isPrimary && remaining[0]) {
      tx.update(locationRef(shop.id, remaining[0].id), { isPrimary: true, updatedAt: now });
    }
    if (shop.shipping.shipsFromLocationId === locationId) {
      const fallback = remaining.find((l) => l.types.includes("ship_from"));
      tx.update(shopRef(shop.id), {
        "shipping.shipsFromLocationId": fallback?.id ?? FieldValue.delete(),
        updatedAt: now,
      });
    }
  });
  await writeAuditLog({
    actor: actor.session,
    action: "shops.archive_location",
    target: { type: "shop", id: shop.id },
    before: { locationId, status: "active" },
    after: { locationId, status: "archived" },
  });
  refreshStorefront(shop);
}

/** Makes one location the primary (shown first on the shop page). */
export async function setPrimaryLocation(
  actor: MerchantActor,
  shopId: string,
  locationId: string,
  now: Date = new Date(),
): Promise<void> {
  const shop = await editableShop(actor, shopId);
  const active = await listLocations(shop.id);
  if (!active.some((l) => l.id === locationId)) {
    throw new ActionError("not_found", "We couldn't find that location.");
  }
  await db().runTransaction(async (tx) => {
    for (const location of active) {
      tx.update(locationRef(shop.id, location.id), {
        isPrimary: location.id === locationId,
        updatedAt: now,
      });
    }
  });
  refreshStorefront(shop);
}

/** Moves a location one place up or down in the shop's list. */
export async function moveLocation(
  actor: MerchantActor,
  shopId: string,
  locationId: string,
  direction: "up" | "down",
  now: Date = new Date(),
): Promise<void> {
  const shop = await editableShop(actor, shopId);
  const active = await listLocations(shop.id);
  const index = active.findIndex((l) => l.id === locationId);
  const swapWith = active[direction === "up" ? index - 1 : index + 1];
  const current = active[index];
  if (!current || !swapWith) return;
  await db().runTransaction(async (tx) => {
    tx.update(locationRef(shop.id, current.id), { sortOrder: swapWith.sortOrder, updatedAt: now });
    tx.update(locationRef(shop.id, swapWith.id), { sortOrder: current.sortOrder, updatedAt: now });
  });
  refreshStorefront(shop);
}

// ---------------------------------------------------------------- step 5: submit

/**
 * Submits a shop for review once nothing blocks it (verified email, branding,
 * policies, a ship-from location) and the marketplace is open. Emails the
 * merchant and the merchant team.
 */
export async function submitShop(
  actor: MerchantActor,
  shopId: string,
  now: Date = new Date(),
): Promise<Shop> {
  const [shop, merchant, settings] = await Promise.all([
    editableShop(actor, shopId),
    getMerchant(actor.vendorId),
    getStoreSettings(),
  ]);
  if (!merchant) throw new ActionError("not_found", "We couldn't find your merchant account.");
  if (!settings.features.vendorMarketplace) {
    throw new ActionError("forbidden", "Shop submissions are paused. Check back soon.");
  }
  if (!(await consumeRateLimit("publish", actor.vendorId)).allowed) {
    throw new ActionError("limit_exceeded", "Too many attempts. Try again later.");
  }
  const locations = await listLocations(shop.id);
  const blockers = shopBlockers(merchant, shop, locations);
  if (blockers.length > 0) {
    throw new ActionError(
      "conflict",
      `Before you submit: ${blockers.map((b) => b.message.toLowerCase()).join(", ")}.`,
    );
  }
  try {
    assertShopTransition(shop.status, "pending_review", "merchant");
  } catch (error) {
    if (error instanceof TransitionError) {
      throw new ActionError("conflict", "Your shop is already in review or live.");
    }
    throw error;
  }

  await db().runTransaction(async (tx) => {
    tx.update(shopRef(shop.id), {
      status: "pending_review",
      submittedAt: now,
      onboardingStep: "review",
      completedSteps: completed(shop, "review"),
      reviewNotes: [
        ...shop.reviewNotes,
        { at: now, byUid: actor.session.uid, decision: "submitted", reasons: [] },
      ],
      updatedAt: now,
    });
    if (merchant.status === "onboarding") {
      tx.update(db().collection("merchants").doc(actor.vendorId), {
        status: "active",
        updatedAt: now,
      });
    }
  });
  await writeAuditLog({
    actor: actor.session,
    action: "shops.submit",
    target: { type: "shop", id: shop.id },
    before: { status: shop.status },
    after: { status: "pending_review" },
  });
  await notifySubmission(shop, merchant);
  return (await getShop(shop.id)) as Shop;
}

async function notifySubmission(shop: Shop, merchant: Merchant): Promise<void> {
  try {
    await Promise.all([
      sendEmail({
        to: merchant.email,
        subject: "We've received your shop",
        template: createElement(ShopSubmittedEmail, {
          brandName: brand.name,
          shopName: shop.name,
          link: siteUrl("/merchant"),
        }),
        kind: "merchant_shop_submitted",
        ref: shop.id,
      }),
      sendEmail({
        to: MERCHANT_TEAM_EMAIL,
        subject: `${shop.name} is waiting for review`,
        template: createElement(ShopReviewRequestEmail, {
          brandName: brand.name,
          shopName: shop.name,
          merchantEmail: merchant.email,
          link: siteUrl(`/admin/merchants/${shop.id}`),
        }),
        kind: "merchant_shop_review_request",
        ref: shop.id,
      }),
    ]);
  } catch (error) {
    logger.error("merchant.submission_email_failed", { shopId: shop.id, error });
  }
}

// ---------------------------------------------------------------- close & reopen

/** Closes the shop: products are hidden straight away; reopen within 30 days. */
export async function closeShop(
  actor: MerchantActor,
  shopId: string,
  now: Date = new Date(),
): Promise<void> {
  const shop = await getOwnedShop(actor.vendorId, shopId);
  if (shop.status === "closed") return;
  try {
    assertShopTransition(shop.status, "closed", "merchant");
  } catch {
    throw new ActionError("conflict", "A paused shop can't be closed. Contact merchant support.");
  }
  await shopRef(shop.id).update({ status: "closed", closedAt: now, updatedAt: now });
  await writeAuditLog({
    actor: actor.session,
    action: "shops.close",
    target: { type: "shop", id: shop.id },
    before: { status: shop.status },
    after: { status: "closed" },
  });
  invalidate("shops", `shop:${shop.slug}`, "products");
  await syncShopProducts(shop.id);
}

/** Reopens a closed shop within the window: approved shops go straight back live. */
export async function reopenShop(
  actor: MerchantActor,
  shopId: string,
  now: Date = new Date(),
): Promise<void> {
  const shop = await getOwnedShop(actor.vendorId, shopId);
  if (shop.status !== "closed" || !shop.closedAt) {
    throw new ActionError("conflict", "Your shop isn't closed.");
  }
  const deadline = shop.closedAt.getTime() + MERCHANT_LIMITS.shop.reopenWithinDays * 86_400_000;
  if (now.getTime() > deadline) {
    throw new ActionError(
      "conflict",
      "It's been more than 30 days. Contact merchant support to reopen.",
    );
  }
  const to = shop.approvedAt ? "approved" : "draft";
  await shopRef(shop.id).update({ status: to, updatedAt: now });
  await writeAuditLog({
    actor: actor.session,
    action: "shops.reopen",
    target: { type: "shop", id: shop.id },
    before: { status: "closed" },
    after: { status: to },
  });
  invalidate("shops", `shop:${shop.slug}`, "products");
  await syncShopProducts(shop.id);
}
