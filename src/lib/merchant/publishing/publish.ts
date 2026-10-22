import "server-only";
import { createElement } from "react";
import { brand } from "@/config/brand";
import { MERCHANT_TEAM_EMAIL } from "@/config/merchant";
import { ActionError } from "@/lib/actions/run-action";
import { invalidate } from "@/lib/admin/revalidate";
import { writeAuditLog, type AuditEntry } from "@/lib/audit/log";
import { parseSnapshot } from "@/lib/data/firestore";
import { sendEmail } from "@/lib/email/send";
import {
  ProductDecisionEmail,
  ProductReviewRequestEmail,
} from "@/lib/email/templates/MerchantProduct";
import { clientEnv } from "@/lib/env/client";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { logger } from "@/lib/observability/logger";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { productSchema, type Product, type ProductStatus } from "@/lib/validation/catalog";
import {
  productDraftDataSchema,
  merchantStockKey,
  productDraftSchema,
  type ProductDraft,
  type ShopCounters,
} from "@/lib/validation/merchant";
import { counterDelta } from "../product-service";
import { onlineStock } from "../variants/matrix";
import { listLocations, shipFromLocations } from "../repositories/locations";
import { getMerchant } from "../repositories/merchants";
import { getShop } from "../repositories/shops";
import type { MerchantActor } from "../shop-service";
import { assertProductTransition, TransitionError, type Actor } from "../status";
import { suggestProductSlug } from "../editor";
import { chooseSlug, toStorefrontDocs } from "./storefront-docs";
import { publishProblems, type PublishProblem } from "./validate";

const db = () => getFirebaseAdmin().db;
const draftRef = (id: string) => db().collection("productDrafts").doc(id);
const productRef = (id: string) => db().collection("products").doc(id);
const shopRef = (id: string) => db().collection("shops").doc(id);

function siteUrl(path: string): string {
  return new URL(path, clientEnv.NEXT_PUBLIC_SITE_URL).toString();
}

/** Thrown when a draft isn't ready; carries every problem for the editor. */
export class PublishBlockedError extends ActionError {
  constructor(public readonly problems: PublishProblem[]) {
    super("conflict", `Before this can go live: ${problems.map((p) => p.message).join("; ")}.`);
    this.name = "PublishBlockedError";
  }
}

async function loadDraft(productId: string): Promise<ProductDraft> {
  const draft = parseSnapshot(productDraftSchema, await draftRef(productId).get());
  if (!draft) throw new ActionError("not_found", "We couldn't find that product.");
  return draft;
}

async function loadOwnedDraft(actor: MerchantActor, productId: string): Promise<ProductDraft> {
  const draft = await loadDraft(productId);
  if (draft.vendorId !== actor.vendorId)
    throw new ActionError("not_found", "We couldn't find that product.");
  return draft;
}

/** Problems blocking submission for one draft (also shown in the editor and to reviewers). */
export async function draftPublishProblems(draft: ProductDraft): Promise<PublishProblem[]> {
  const [merchant, locations] = await Promise.all([
    getMerchant(draft.vendorId),
    listLocations(draft.shopId),
  ]);
  const data = productDraftDataSchema.parse(draft.data);
  const problems = publishProblems(data, {
    emailVerified: merchant?.emailVerified ?? false,
    shipFrom: shipFromLocations(locations).map((l) => l.id),
  });
  // SKUs are shared with the whole catalog, so check them now rather than at approval.
  const skus = [...new Set(data.matrix.map((r) => r.sku).filter(Boolean))];
  const docs = await Promise.all(skus.map((sku) => db().collection("variants").doc(sku).get()));
  const clash = docs.find((d) => d.exists && d.get("productId") !== draft.id);
  if (clash) {
    problems.push({
      field: "field-matrix",
      message: `SKU ${clash.id} is already used by another product — change it in Options`,
    });
  }
  return problems;
}

/** Refuses a transition the state machine doesn't allow, in merchant-facing words. */
function checkTransition(from: ProductStatus, to: ProductStatus, by: Actor): void {
  try {
    assertProductTransition(from, to, by);
  } catch (error) {
    if (error instanceof TransitionError) {
      throw new ActionError(
        "conflict",
        "This product can't make that change right now. Reload and try again.",
      );
    }
    throw error;
  }
}

/** Moves a draft's merchant status, keeping shop counters in the same transaction. */
async function moveStatus(
  draft: ProductDraft,
  to: ProductStatus,
  by: Actor,
  now: Date,
  extra: Record<string, unknown> = {},
): Promise<void> {
  checkTransition(draft.status, to, by);
  const lowStock = draft.summary?.lowStock ?? false;
  await db().runTransaction(async (tx) => {
    const shop = await tx.get(shopRef(draft.shopId));
    tx.update(draftRef(draft.id), { status: to, updatedAt: now, ...extra });
    tx.update(shopRef(draft.shopId), {
      counters: counterDelta(
        shop.get("counters") as ShopCounters,
        { status: draft.status, lowStock },
        { status: to, lowStock },
      ),
    });
  });
}

/**
 * Writes (or rewrites) the storefront product and variants for a draft:
 * unique address, SKUs free across the whole catalog, shop fields
 * denormalised, stock per location plus the online total. Variants dropped
 * from the matrix are taken off sale (never deleted: orders reference SKUs).
 * Storefront caches for the product, its category and the shop are refreshed.
 */
export async function writeStorefront(
  productId: string,
  merchantStatus: ProductStatus,
  now = new Date(),
): Promise<Product> {
  const draft = await loadDraft(productId);
  const shop = await getShop(draft.shopId);
  if (!shop) throw new ActionError("not_found", "We couldn't find that shop.");
  const data = productDraftDataSchema.parse(draft.data);
  const shipFrom = shipFromLocations(await listLocations(shop.id)).map((l) => l.id);
  const existing = parseSnapshot(productSchema, await productRef(productId).get());

  // Addresses already used by other products: check the exact candidates.
  const wanted = (data.slug || existing?.slug || suggestProductSlug(data.name) || "product").slice(
    0,
    100,
  );
  const candidates = [wanted, ...Array.from({ length: 9 }, (_, i) => `${wanted}-${i + 2}`)];
  const clashes = await db().collection("products").where("slug", "in", candidates).get();
  const taken = new Set(
    clashes.docs.filter((d) => d.id !== productId).map((d) => d.get("slug") as string),
  );
  const slug =
    existing?.slug && (!data.slug || data.slug === existing.slug)
      ? existing.slug
      : chooseSlug({ slug: wanted, name: data.name }, (s) => taken.has(s));

  const { product, variants } = toStorefrontDocs({
    productId,
    data,
    shop,
    merchantStatus,
    slug,
    shipFrom,
    now,
    createdAt: existing?.createdAt,
    ratings: existing
      ? {
          ratingAvg: existing.ratingAvg,
          ratingCount: existing.ratingCount,
          salesRank: existing.salesRank,
          ...(existing.fitScore !== undefined ? { fitScore: existing.fitScore } : {}),
        }
      : undefined,
  });

  // SKUs are document ids in `variants`, shared with Texora's own catalog.
  const skuDocs = await Promise.all(
    variants.map((v) => db().collection("variants").doc(v.sku).get()),
  );
  const clash = skuDocs.find((d) => d.exists && d.get("productId") !== productId);
  if (clash) {
    throw new PublishBlockedError([
      { field: "field-matrix", message: `SKU ${clash.id} is already used by another product` },
    ]);
  }

  const current = await db().collection("variants").where("productId", "==", productId).get();
  const keep = new Set(variants.map((v) => v.sku));
  const batch = db().batch();
  const { id: _id, ...productDoc } = product;
  batch.set(productRef(productId), productDoc);
  for (const variant of variants) {
    const { sku, ...doc } = variant;
    batch.set(db().collection("variants").doc(sku), doc);
  }
  for (const stale of current.docs.filter((d) => !keep.has(d.id))) {
    batch.update(stale.ref, {
      availableOnline: false,
      stockByLocation: { online: 0 },
      updatedAt: now,
    });
  }
  batch.update(draftRef(productId), {
    ...(slug !== data.slug ? { "data.slug": slug } : {}),
    // A storefront version exists while the product is live.
    published: merchantStatus === "live",
  });
  await batch.commit();

  invalidate(
    "products",
    "inventory",
    `product:${slug}`,
    ...(existing && existing.slug !== slug ? [`product:${existing.slug}`] : []),
    "shops",
    `shop:${shop.slug}`,
  );
  return product;
}

/** Live now, or scheduled when a future publish time is set. */
function liveOrScheduled(publishAt: string, now: Date): ProductStatus {
  return publishAt && Date.parse(publishAt) > now.getTime() ? "scheduled" : "live";
}

async function audit(entry: AuditEntry): Promise<void> {
  await writeAuditLog(entry);
}

/**
 * Submits a product: every check must pass. Trusted merchants publish
 * straight away (or on their schedule); everyone else goes to review and the
 * merchant team is emailed.
 */
export async function submitProduct(
  actor: MerchantActor,
  productId: string,
  now = new Date(),
): Promise<{ status: ProductStatus }> {
  const draft = await loadOwnedDraft(actor, productId);
  const [shop, merchant] = await Promise.all([getShop(draft.shopId), getMerchant(actor.vendorId)]);
  if (!shop || !merchant) throw new ActionError("not_found", "We couldn't find your shop.");
  if (shop.status === "suspended" || shop.status === "closed") {
    throw new ActionError(
      "conflict",
      "Your shop is paused or closed, so products can't be submitted.",
    );
  }
  if (!(await consumeRateLimit("publish", actor.vendorId)).allowed) {
    throw new ActionError("limit_exceeded", "Too many attempts. Try again later.");
  }
  const problems = await draftPublishProblems(draft);
  if (problems.length > 0) throw new PublishBlockedError(problems);

  const data = productDraftDataSchema.parse(draft.data);
  if (merchant.trustLevel === "trusted") {
    const to = liveOrScheduled(data.publishAt, now);
    if (draft.status !== to) checkTransition(draft.status, to, "merchant");
    // Storefront first: a clash (SKU, address) must leave the status untouched.
    await writeStorefront(productId, to, now);
    if (draft.status !== to) await moveStatus(draft, to, "merchant", now, { reviewNotes: [] });
    await audit({
      actor: actor.session,
      action: "products.publish",
      target: { type: "product", id: productId },
      before: { status: draft.status },
      after: { status: to },
    });
    return { status: to };
  }

  await moveStatus(draft, "in_review", "merchant", now, { reviewNotes: [] });
  await audit({
    actor: actor.session,
    action: "products.submit",
    target: { type: "product", id: productId },
    before: { status: draft.status },
    after: { status: "in_review" },
  });
  try {
    await sendEmail({
      to: MERCHANT_TEAM_EMAIL,
      subject: `${data.name} is waiting for review`,
      template: createElement(ProductReviewRequestEmail, {
        brandName: brand.name,
        productName: data.name,
        shopName: shop.name,
        link: siteUrl(`/admin/merchants/products/${productId}`),
      }),
      kind: "merchant_product_review_request",
      ref: productId,
    });
  } catch (error) {
    logger.error("merchant.product_review_email_failed", { productId, error });
  }
  return { status: "in_review" };
}

/** Reviewer decision on a product in review: approve (goes live or scheduled) or request changes. */
export async function reviewProduct(
  reviewer: AuditEntry["actor"],
  productId: string,
  decision: "approve" | "changes",
  reasons: readonly string[],
  now = new Date(),
): Promise<{ status: ProductStatus }> {
  const draft = await loadDraft(productId);
  if (draft.status !== "in_review")
    throw new ActionError("conflict", "This product isn't waiting for review.");
  const data = productDraftDataSchema.parse(draft.data);
  const merchant = await getMerchant(draft.vendorId);

  let to: ProductStatus;
  if (decision === "approve") {
    const problems = await draftPublishProblems(draft);
    if (problems.length > 0) throw new PublishBlockedError(problems);
    to = liveOrScheduled(data.publishAt, now);
    checkTransition(draft.status, to, "admin");
    await writeStorefront(productId, to, now);
    await moveStatus(draft, to, "admin", now, { reviewNotes: [] });
  } else {
    if (reasons.length === 0)
      throw new ActionError("conflict", "Tell the merchant what to change.", "reasons");
    to = "changes_requested";
    await moveStatus(draft, to, "admin", now, { reviewNotes: reasons });
  }
  await audit({
    actor: reviewer,
    action: decision === "approve" ? "products.approve" : "products.request_changes",
    target: { type: "product", id: productId },
    before: { status: "in_review" },
    after: { status: to, ...(reasons.length ? { reasons } : {}) },
  });
  // Merchants can turn review-decision emails off in settings.
  if (merchant && merchant.notifications.productReviews) {
    try {
      await sendEmail({
        to: merchant.email,
        subject:
          decision === "approve" ? `${data.name} is live` : `Changes needed for ${data.name}`,
        template: createElement(ProductDecisionEmail, {
          brandName: brand.name,
          productName: data.name,
          decision: decision === "approve" ? "approved" : "changes_requested",
          reasons,
          link: siteUrl(
            decision === "approve" ? "/merchant/products" : `/merchant/products/${productId}`,
          ),
        }),
        kind: "merchant_product_decision",
        ref: productId,
      });
    } catch (error) {
      logger.error("merchant.product_decision_email_failed", { productId, error });
    }
  }
  return { status: to };
}

/** Takes a live or scheduled product off sale; it stays as a draft. */
export async function unpublishProduct(
  actor: MerchantActor,
  productId: string,
  now = new Date(),
): Promise<void> {
  const draft = await loadOwnedDraft(actor, productId);
  const onSale =
    draft.status === "live" || draft.status === "scheduled" || draft.status === "in_review";
  if (!onSale && !(draft.published && draft.status === "changes_requested")) {
    throw new ActionError("conflict", "This product isn't published.");
  }
  await moveStatus(draft, "draft", "merchant", now);
  if ((await productRef(productId).get()).exists) await writeStorefront(productId, "draft", now);
  await audit({
    actor: actor.session,
    action: "products.unpublish",
    target: { type: "product", id: productId },
    before: { status: draft.status },
    after: { status: "draft" },
  });
}

/** Keeps the storefront product in step when the merchant archives or restores it. */
export async function syncArchived(
  productId: string,
  status: ProductStatus,
  now = new Date(),
): Promise<void> {
  const snapshot = await productRef(productId).get();
  if (!snapshot.exists) return;
  await productRef(productId).update({
    status: status === "archived" ? "archived" : "draft",
    updatedAt: now,
  });
  await draftRef(productId).update({ published: false });
  invalidate("products", "inventory", `product:${snapshot.get("slug")}`);
}

/**
 * Brings a shop's storefront products in step with the shop: its name,
 * address and logo, and visibility (only approved shops show products).
 * Runs after approval, suspension, reinstatement, closing or a profile
 * change. It never republishes content, so edits still in review stay
 * unpublished.
 */
export async function syncShopProducts(shopId: string, now = new Date()): Promise<number> {
  const shop = await getShop(shopId);
  if (!shop) return 0;
  const products = await db().collection("products").where("shopId", "==", shopId).get();
  if (products.empty) return 0;
  const drafts = await Promise.all(products.docs.map((d) => draftRef(d.id).get()));
  const batch = db().batch();
  const slugs: string[] = [];
  products.docs.forEach((doc, i) => {
    const draft = drafts[i];
    const published = Boolean(draft?.get("published"));
    const merchantStatus = draft?.get("status") as ProductStatus | undefined;
    const status: ProductStatus =
      published && shop.status === "approved"
        ? "live"
        : merchantStatus === "archived"
          ? "archived"
          : merchantStatus === "scheduled"
            ? "scheduled"
            : "draft";
    batch.update(doc.ref, {
      status,
      shop: {
        id: shop.id,
        slug: shop.slug,
        name: shop.name,
        ...(shop.logo
          ? {
              logo: {
                url: shop.logo.url,
                alt: shop.logo.alt,
                width: shop.logo.width,
                height: shop.logo.height,
              },
            }
          : {}),
      },
      updatedAt: now,
    });
    slugs.push(doc.get("slug") as string);
  });
  await batch.commit();
  invalidate(
    "products",
    "inventory",
    "shops",
    `shop:${shop.slug}`,
    ...slugs.map((s) => `product:${s}`),
  );
  return products.size;
}

/**
 * Pushes a published product's stock to its storefront variants straight
 * away (stock edits don't need review), including the online total.
 */
export async function syncPublishedStock(productId: string, now = new Date()): Promise<void> {
  const draft = await loadDraft(productId);
  if (!draft.published) return;
  const data = productDraftDataSchema.parse(draft.data);
  const shipFrom = shipFromLocations(await listLocations(draft.shopId)).map((l) => l.id);
  const variants = await db().collection("variants").where("productId", "==", productId).get();
  const bySku = new Map(data.matrix.map((r) => [r.sku, r]));
  const batch = db().batch();
  for (const doc of variants.docs) {
    const row = bySku.get(doc.id);
    if (!row) continue;
    const stockByLocation: Record<string, number> = {};
    for (const [locationId, units] of Object.entries(row.stock)) {
      stockByLocation[merchantStockKey(draft.shopId, locationId)] = units;
    }
    stockByLocation.online = onlineStock(row.stock, shipFrom);
    batch.update(doc.ref, { stockByLocation, backorder: row.backorder, updatedAt: now });
  }
  await batch.commit();
  invalidate("inventory", "products");
}

/** Scheduled job: products whose publish time has come go live. */
export async function publishDueProducts(now = new Date()): Promise<number> {
  const due = await db().collection("productDrafts").where("status", "==", "scheduled").get();
  let published = 0;
  for (const doc of due.docs) {
    const draft = parseSnapshot(productDraftSchema, doc);
    if (!draft) continue;
    const data = productDraftDataSchema.parse(draft.data);
    if (data.publishAt && Date.parse(data.publishAt) > now.getTime()) continue;
    try {
      await writeStorefront(draft.id, "live", now);
    } catch (error) {
      logger.error("merchant.scheduled_publish_failed", { productId: draft.id, error });
      continue;
    }
    await moveStatus(draft, "live", "system", now);
    published++;
  }
  return published;
}

/** Products waiting for review, longest waiting first, with their shop's name. */
export async function listProductsInReview(): Promise<
  Array<{ draft: ProductDraft; shopName: string; shopSlug: string }>
> {
  const snapshot = await db().collection("productDrafts").where("status", "==", "in_review").get();
  const drafts = snapshot.docs
    .map((d) => parseSnapshot(productDraftSchema, d))
    .filter((d): d is ProductDraft => d !== null)
    .sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime());
  const shops = new Map<string, { name: string; slug: string }>();
  for (const d of drafts) {
    if (shops.has(d.shopId)) continue;
    const shop = await getShop(d.shopId);
    shops.set(d.shopId, { name: shop?.name ?? "Unknown shop", slug: shop?.slug ?? "" });
  }
  return drafts.map((draft) => ({
    draft,
    shopName: shops.get(draft.shopId)?.name ?? "",
    shopSlug: shops.get(draft.shopId)?.slug ?? "",
  }));
}

/** A draft by id for reviewers (no ownership check: reviewers see every shop's products). */
export async function getDraftForReview(productId: string): Promise<ProductDraft | null> {
  return parseSnapshot(productDraftSchema, await draftRef(productId).get());
}
