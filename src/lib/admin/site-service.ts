import "server-only";
import { randomUUID } from "node:crypto";
import { ActionError } from "@/lib/actions/run-action";
import { writeAuditLog } from "@/lib/audit/log";
import type { Session } from "@/lib/auth/session";
import {
  cmsModuleSchema,
  cmsPageSchema,
  type CmsModule,
  type CmsModuleType,
  type CmsPage,
} from "@/lib/cms/modules";
import { getStoreSettings, STORE_SETTINGS_ID } from "@/lib/data/admin-records";
import { parseSnapshot } from "@/lib/data/firestore";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { storeSchema, storeSettingsSchema, type Store, type StoreSettings } from "@/lib/validation";
import { invalidate } from "./revalidate";

const db = () => getFirebaseAdmin().db;

type SettingsEdit = Omit<StoreSettings, "currency" | "updatedAt">;

/** Saves store-wide settings after validating the whole record. */
export async function updateSettings(actor: Session, edit: SettingsEdit): Promise<void> {
  const before = await getStoreSettings();
  if (edit.loyalty.tierThresholds.icon <= edit.loyalty.tierThresholds.enthusiast) {
    throw new ActionError("conflict", "The Icon threshold must be above the Enthusiast threshold");
  }
  const next = storeSettingsSchema.parse({ ...before, ...edit, updatedAt: new Date() });
  await db().collection("settings").doc(STORE_SETTINGS_ID).set(next);
  invalidate("settings");
  const { updatedAt: _b, ...beforeFields } = before;
  const { updatedAt: _a, ...afterFields } = next;
  await writeAuditLog({
    actor,
    action: "settings.update",
    target: { type: "settings", id: STORE_SETTINGS_ID },
    before: beforeFields as unknown as Record<string, unknown>,
    after: afterFields as unknown as Record<string, unknown>,
  });
}

/** Updates a physical store's phone, status and services. */
export async function updateStore(
  actor: Session,
  storeId: string,
  edit: Pick<Store, "phone" | "status" | "services">,
): Promise<void> {
  const ref = db().collection("stores").doc(storeId);
  const before = parseSnapshot(storeSchema, await ref.get());
  if (!before) throw new ActionError("not_found", "Store not found");
  await ref.update(edit);
  await writeAuditLog({
    actor,
    action: "settings.update_store",
    target: { type: "store", id: storeId },
    before: { phone: before.phone, status: before.status, services: before.services },
    after: edit,
  });
  invalidate("stores");
}

// --------------------------------------------------------------- content

/** Every CMS page, drafts included. */
export async function listPages(): Promise<CmsPage[]> {
  const snap = await db().collection("pages").get();
  return snap.docs
    .map((d) => parseSnapshot(cmsPageSchema, d))
    .filter((p): p is CmsPage => p !== null)
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

/** One CMS page by slug, drafts included. */
export async function getPage(slug: string): Promise<CmsPage | null> {
  return parseSnapshot(cmsPageSchema, await db().collection("pages").doc(slug).get());
}

/**
 * Saves a whole page (details and ordered modules) after validating every
 * module against its schema, so a bad edit can never break the storefront.
 */
export async function savePage(
  actor: Session,
  slug: string,
  page: Pick<CmsPage, "title" | "status" | "seo" | "modules">,
): Promise<void> {
  const ref = db().collection("pages").doc(slug);
  const before = parseSnapshot(cmsPageSchema, await ref.get());
  if (!before) throw new ActionError("not_found", "Page not found");
  const parsed = cmsPageSchema.safeParse({ ...before, ...page, updatedAt: new Date() });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new ActionError(
      "conflict",
      `That page isn't valid: ${issue?.path.join(".") ?? "page"} ${issue?.message ?? ""}`.trim(),
    );
  }
  const { id: _id, ...doc } = parsed.data;
  await ref.set(doc);
  await writeAuditLog({
    actor,
    action: "content.update_page",
    target: { type: "page", id: slug },
    before: {
      title: before.title,
      status: before.status,
      modules: before.modules.map((m) => m.type),
    },
    after: { title: page.title, status: page.status, modules: page.modules.map((m) => m.type) },
  });
  invalidate("pages", `page:${slug}`);
}

const STARTERS: Partial<Record<CmsModuleType, unknown>> = {
  campaignDiptych: {
    eyebrow: "The new campaign",
    headline: "Campaign headline",
    body: "One line on the story and what to shop.",
    ctas: [
      { label: "Shop women", href: "/women?sort=newest" },
      { label: "Shop men", href: "/men?sort=newest" },
    ],
    primary: {
      url: "/media/stock/panelEvening-panel.jpg",
      alt: "A woman in a draped olive satin gown in a sunlit villa",
    },
    secondary: {
      url: "/media/stock/panelEveningAlt-panel.jpg",
      alt: "A woman in a black one-shoulder draped gown",
    },
    layout: "pair",
  },
  categoryTiles: {
    heading: "Shop by category",
    variant: "bleed",
    tiles: [
      {
        label: "Knitwear",
        href: "/collections/knitwear",
        image: { url: "/media/stock/menSweaters-tile.jpg", alt: "A charcoal crew-neck sweater" },
        links: [
          { label: "Shop women", href: "/women/sweaters" },
          { label: "Shop men", href: "/men/sweaters" },
        ],
      },
      {
        label: "Denim",
        href: "/women/jeans",
        image: { url: "/media/stock/crossDenim-tile.jpg", alt: "Wide-leg and straight jeans" },
        links: [
          { label: "Shop women", href: "/women/jeans" },
          { label: "Shop men", href: "/men/jeans" },
        ],
      },
    ],
  },
  promoStrip: { message: "Free standard delivery on orders over EGP 2,500", tone: "muted" },
  storyBlock: { headline: "A new story", body: "Tell shoppers what's new this season." },
  productCarousel: {
    heading: "New arrivals",
    source: { type: "rule", sort: "newest", limit: 12 },
  },
  splitFeature: {
    headline: "Feature headline",
    body: "Short supporting copy.",
    cta: { label: "Shop now", href: "/collections/new-arrivals" },
    image: {
      url: "/media/stock/womenDresses-tile.jpg",
      alt: "A woman in a champagne pleated midi dress with an olive handbag",
    },
    imageSide: "left",
  },
};

/** A valid starting point for a module type, ready to edit (validated against its schema). */
export function moduleTemplate(type: CmsModuleType): CmsModule {
  const data = STARTERS[type];
  if (!data) throw new ActionError("conflict", "That module type can't be added from a template");
  return cmsModuleSchema.parse({
    id: `m-${randomUUID().slice(0, 8)}`,
    schedule: {},
    audience: ["everyone"],
    type,
    data,
  });
}

/** Module types that can be added from the editor with a starter template. */
export const ADDABLE_MODULES: readonly CmsModuleType[] = [
  "campaignDiptych",
  "categoryTiles",
  "promoStrip",
  "storyBlock",
  "productCarousel",
  "splitFeature",
];
