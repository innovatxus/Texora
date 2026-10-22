import "server-only";
import { ActionError } from "@/lib/actions/run-action";
import { writeAuditLog } from "@/lib/audit/log";
import { parseSnapshot } from "@/lib/data/firestore";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import type { ProductStatus } from "@/lib/validation/catalog";
import {
  productDraftDataSchema,
  productDraftSchema,
  type DraftSummary,
  type ProductDraft,
  type ProductDraftData,
  type Shop,
  type ShopCounters,
} from "@/lib/validation/merchant";
import { listLocations, shipFromLocations } from "./repositories/locations";
import { getOwnedShop } from "./repositories/shops";
import type { MerchantActor } from "./shop-service";
import { isShopEditable } from "./status";
import { onlineStock, suggestSku } from "./variants/matrix";

const db = () => getFirebaseAdmin().db;
const drafts = () => db().collection("productDrafts");
const shopRef = (id: string) => db().collection("shops").doc(id);
const mediaRef = (id: string) => db().collection("merchantMedia").doc(id);

/** Which shop counter a product status counts towards (none for archived). */
export function counterFor(status: ProductStatus): keyof ShopCounters | null {
  switch (status) {
    case "live":
      return "live";
    case "draft":
    case "scheduled":
      return "draft";
    case "in_review":
      return "inReview";
    case "changes_requested":
      return "changesRequested";
    case "archived":
      return null;
  }
}

/** Counter changes for a status move (and a low-stock flag change), never below zero. */
export function counterDelta(
  counters: ShopCounters,
  from: { status: ProductStatus; lowStock: boolean } | null,
  to: { status: ProductStatus; lowStock: boolean } | null,
): ShopCounters {
  const next = { ...counters };
  const bump = (key: keyof ShopCounters | null, by: number) => {
    if (key) next[key] = Math.max(0, next[key] + by);
  };
  if (from) {
    bump(counterFor(from.status), -1);
    if (from.lowStock && from.status !== "archived") bump("lowStock", -1);
  }
  if (to) {
    bump(counterFor(to.status), 1);
    if (to.lowStock && to.status !== "archived") bump("lowStock", 1);
  }
  return next;
}

/** A blank product for the editor, with the shop's shipping defaults. */
export function emptyDraftData(shop: Pick<Shop, "shipping">): ProductDraftData {
  return {
    name: "",
    description: "",
    highlights: [],
    categoryKey: "",
    styleId: "",
    attributes: {},
    composition: [],
    colors: [],
    fits: ["regular"],
    sizes: [],
    excluded: [],
    matrix: [],
    parked: [],
    details: { fitNotes: "", modelInfo: "", care: [], sizeGuide: "platform", customGuide: [] },
    shipping: {
      weightGrams: null,
      lengthCm: null,
      widthCm: null,
      heightCm: null,
      shipsFromLocationId: shop.shipping.shipsFromLocationId ?? "",
      processingTime: "",
    },
    seo: { title: "", description: "" },
    slug: "",
    searchKeywords: [],
    publishAt: "",
  };
}

/** The list summary for a draft: name, first image, price range, total online stock, low stock. */
export function summarize(data: ProductDraftData, shipFrom: readonly string[]): DraftSummary {
  const prices = data.matrix.map((r) => r.price).filter((p): p is number => p !== null && p > 0);
  const stocks = data.matrix.map((r) => onlineStock(r.stock, shipFrom));
  const image = data.colors.find((c) => c.images[0])?.images[0]?.url;
  return {
    name: data.name.trim() || "Untitled product",
    categoryKey: data.categoryKey,
    ...(image ? { image } : {}),
    colors: data.colors.length,
    variants: data.matrix.length,
    priceMin: prices.length ? Math.min(...prices) : null,
    priceMax: prices.length ? Math.max(...prices) : null,
    stock: stocks.reduce((a, b) => a + b, 0),
    lowStock: data.matrix.some(
      (r, i) => !r.backorder && (stocks[i] ?? 0) > 0 && (stocks[i] ?? 0) <= r.lowStockThreshold,
    ),
  };
}

/** Media ids a draft uses (photos and videos), so they're kept and released correctly. */
export function referencedMedia(data: Pick<ProductDraftData, "colors">): string[] {
  return [
    ...new Set(
      data.colors.flatMap((c) => [
        ...c.images.map((i) => i.mediaId),
        ...(c.video ? [c.video.mediaId] : []),
      ]),
    ),
  ];
}

function parseData(raw: unknown): ProductDraftData {
  const parsed = productDraftDataSchema.safeParse(raw);
  if (!parsed.success)
    throw new ActionError("conflict", "This draft couldn't be read. Reload and try again.");
  return parsed.data;
}

async function editableShop(actor: MerchantActor, shopId: string): Promise<Shop> {
  const shop = await getOwnedShop(actor.vendorId, shopId);
  if (!isShopEditable(shop.status)) {
    throw new ActionError(
      "conflict",
      "Your shop is paused or closed, so products can't be changed.",
    );
  }
  return shop;
}

/** A draft the merchant owns; not found and not owned look the same. */
export async function getOwnedDraftRecord(
  actor: MerchantActor,
  productId: string,
): Promise<ProductDraft & { parsed: ProductDraftData }> {
  const draft = parseSnapshot(productDraftSchema, await drafts().doc(productId).get());
  if (!draft || draft.vendorId !== actor.vendorId) {
    throw new ActionError("not_found", "We couldn't find that product.");
  }
  return { ...draft, parsed: parseData(draft.data) };
}

/** Starts a new product in the merchant's shop. */
export async function createDraft(
  actor: MerchantActor,
  shopId: string,
  now = new Date(),
): Promise<string> {
  const shop = await editableShop(actor, shopId);
  const ref = drafts().doc();
  const data = emptyDraftData(shop);
  const summary = summarize(data, []);
  await db().runTransaction(async (tx) => {
    const fresh = await tx.get(shopRef(shop.id));
    const counters = (fresh.get("counters") as ShopCounters | undefined) ?? shop.counters;
    tx.create(ref, {
      vendorId: actor.vendorId,
      shopId: shop.id,
      version: 0,
      data,
      status: "draft",
      summary,
      reviewNotes: [],
      createdAt: now,
      updatedBy: actor.session.uid,
      updatedAt: now,
    });
    tx.update(shopRef(shop.id), {
      counters: counterDelta(counters, null, { status: "draft", lowStock: false }),
      updatedAt: now,
    });
  });
  await writeAuditLog({
    actor: actor.session,
    action: "products.create_draft",
    target: { type: "product", id: ref.id },
    after: { shopId: shop.id },
  });
  return ref.id;
}

/**
 * Autosave: stores the editor state if `version` is current (a stale tab
 * can't overwrite newer work), refreshes the list summary and counters, and
 * keeps referenced media attached while releasing media no longer used.
 */
export async function saveDraft(
  actor: MerchantActor,
  productId: string,
  version: number,
  rawData: unknown,
  now = new Date(),
): Promise<{ version: number; summary: DraftSummary }> {
  const data = parseData(rawData);
  const current = await getOwnedDraftRecord(actor, productId);
  const shop = await editableShop(actor, current.shopId);
  if (current.status === "archived") {
    throw new ActionError("conflict", "This product is archived. Restore it to make changes.");
  }

  // Media must belong to this shop's own folder (never another merchant's files).
  const prefix = `/media/m/${actor.vendorId}/${shop.id}/`;
  const urls = data.colors.flatMap((c) => [
    ...c.images.map((i) => i.url),
    ...(c.video ? [c.video.url] : []),
  ]);
  if (urls.some((u) => !u.startsWith(prefix))) {
    throw new ActionError("conflict", "One of the photos isn't from your shop. Upload it again.");
  }

  const shipFrom = shipFromLocations(await listLocations(shop.id)).map((l) => l.id);
  const summary = summarize(data, shipFrom);
  const before = new Set(referencedMedia(current.parsed));
  const after = new Set(referencedMedia(data));
  const attach = [...after].filter((id) => !before.has(id));
  const release = [...before].filter((id) => !after.has(id));

  const nextVersion = await db().runTransaction(async (tx) => {
    const fresh = await tx.get(drafts().doc(productId));
    const freshShop = await tx.get(shopRef(shop.id));
    const media = await Promise.all(attach.map((id) => tx.get(mediaRef(id))));
    if (fresh.get("version") !== version) {
      throw new ActionError(
        "conflict",
        "This product was changed in another tab. Reload to see the latest version.",
      );
    }
    if (
      media.some(
        (m) => !m.exists || m.get("vendorId") !== actor.vendorId || m.get("shopId") !== shop.id,
      )
    ) {
      throw new ActionError(
        "conflict",
        "One of the photos isn't available any more. Upload it again.",
      );
    }
    const status = fresh.get("status") as ProductStatus;
    const oldLow = Boolean(fresh.get("summary.lowStock"));
    tx.update(drafts().doc(productId), {
      data,
      summary,
      version: version + 1,
      updatedBy: actor.session.uid,
      updatedAt: now,
    });
    if (oldLow !== summary.lowStock) {
      tx.update(shopRef(shop.id), {
        counters: counterDelta(
          freshShop.get("counters") as ShopCounters,
          { status, lowStock: oldLow },
          { status, lowStock: summary.lowStock },
        ),
      });
    }
    for (const id of attach) tx.update(mediaRef(id), { status: "attached" });
    for (const id of release) tx.update(mediaRef(id), { status: "orphaned", orphanedAt: now });
    return version + 1;
  });
  return { version: nextVersion, summary };
}

/** Copies a product: everything except the address and SKUs (re-suggested), as a new draft. */
export async function duplicateDraft(
  actor: MerchantActor,
  productId: string,
  now = new Date(),
): Promise<string> {
  const source = await getOwnedDraftRecord(actor, productId);
  const shop = await editableShop(actor, source.shopId);
  const data = source.parsed;
  const prefix = data.styleId ? `${data.styleId}-COPY` : "COPY";
  const copy: ProductDraftData = {
    ...data,
    name: data.name ? `${data.name} (copy)`.slice(0, 120) : "",
    styleId: data.styleId ? `${data.styleId}-copy`.slice(0, 40) : "",
    slug: "",
    matrix: data.matrix.map((r) => ({
      ...r,
      sku: suggestSku(prefix, r.color, r.fit, r.size),
      barcode: "",
    })),
    parked: [],
  };
  const ref = drafts().doc();
  const shipFrom = shipFromLocations(await listLocations(shop.id)).map((l) => l.id);
  const summary = summarize(copy, shipFrom);
  await db().runTransaction(async (tx) => {
    const freshShop = await tx.get(shopRef(shop.id));
    tx.create(ref, {
      vendorId: actor.vendorId,
      shopId: shop.id,
      version: 0,
      data: copy,
      status: "draft",
      summary,
      reviewNotes: [],
      createdAt: now,
      updatedBy: actor.session.uid,
      updatedAt: now,
    });
    tx.update(shopRef(shop.id), {
      counters: counterDelta(freshShop.get("counters") as ShopCounters, null, {
        status: "draft",
        lowStock: summary.lowStock,
      }),
    });
    for (const id of referencedMedia(copy)) tx.update(mediaRef(id), { status: "attached" });
  });
  await writeAuditLog({
    actor: actor.session,
    action: "products.duplicate",
    target: { type: "product", id: ref.id },
    after: { from: productId },
  });
  return ref.id;
}

/**
 * Archives (soft-deletes) or restores products. A published product's
 * storefront document follows (hidden when archived) via `onStatusChange`.
 */
export async function setArchived(
  actor: MerchantActor,
  productIds: readonly string[],
  archived: boolean,
  onStatusChange: (productId: string, status: ProductStatus) => Promise<void> = async () => {},
  now = new Date(),
): Promise<number> {
  let changed = 0;
  for (const productId of productIds) {
    const draft = await getOwnedDraftRecord(actor, productId);
    const shop = await editableShop(actor, draft.shopId);
    if ((draft.status === "archived") === archived) continue;
    const to: ProductStatus = archived ? "archived" : "draft";
    const lowStock = draft.summary?.lowStock ?? false;
    await db().runTransaction(async (tx) => {
      const freshShop = await tx.get(shopRef(shop.id));
      tx.update(drafts().doc(productId), { status: to, updatedAt: now });
      tx.update(shopRef(shop.id), {
        counters: counterDelta(
          freshShop.get("counters") as ShopCounters,
          { status: draft.status, lowStock },
          { status: to, lowStock },
        ),
      });
    });
    await onStatusChange(productId, to);
    await writeAuditLog({
      actor: actor.session,
      action: archived ? "products.archive" : "products.restore",
      target: { type: "product", id: productId },
      before: { status: draft.status },
      after: { status: to },
    });
    changed++;
  }
  return changed;
}

/** Inline stock edit from the product list: one variant at one location. */
export async function updateDraftStock(
  actor: MerchantActor,
  productId: string,
  key: string,
  locationId: string,
  quantity: number,
  now = new Date(),
): Promise<{ version: number; summary: DraftSummary }> {
  const draft = await getOwnedDraftRecord(actor, productId);
  const locations = await listLocations(draft.shopId);
  if (!locations.some((l) => l.id === locationId)) {
    throw new ActionError("not_found", "We couldn't find that location.");
  }
  const data = draft.parsed;
  if (!data.matrix.some((r) => r.key === key))
    throw new ActionError("not_found", "We couldn't find that variant.");
  const next: ProductDraftData = {
    ...data,
    matrix: data.matrix.map((r) =>
      r.key === key ? { ...r, stock: { ...r.stock, [locationId]: quantity } } : r,
    ),
  };
  return saveDraft(actor, productId, draft.version, next, now);
}

export interface DraftListFilter {
  shopId: string;
  status?: ProductStatus | "low_stock" | undefined;
  q?: string | undefined;
  category?: string | undefined;
  stock?: "in" | "low" | "out" | undefined;
  sort?: "updated" | "name" | "price" | undefined;
  /** Zero-based offset; the list is small enough to page in memory (D-079). */
  offset?: number;
  limit?: number;
}

export interface DraftListItem {
  id: string;
  status: ProductStatus;
  summary: DraftSummary;
  updatedAt: Date;
  styleId: string;
  /** Variant rows for inline stock edits. */
  rows: Array<{ key: string; label: string; stock: Record<string, number> }>;
}

/** The shop's products for the list: filtered, sorted and paged. Archived only when asked for. */
export async function listShopDrafts(
  actor: MerchantActor,
  filter: DraftListFilter,
): Promise<{ items: DraftListItem[]; total: number; nextOffset: number | null }> {
  await getOwnedShop(actor.vendorId, filter.shopId);
  const snapshot = await drafts().where("shopId", "==", filter.shopId).get();
  const all = snapshot.docs
    .map((d) => parseSnapshot(productDraftSchema, d))
    .filter((d): d is ProductDraft => d !== null && d.vendorId === actor.vendorId);

  const q = filter.q?.trim().toLowerCase();
  const filtered = all.filter((d) => {
    const data = productDraftDataSchema.safeParse(d.data);
    const summary = d.summary;
    if (!summary || !data.success) return false;
    if (filter.status === "low_stock") {
      if (!summary.lowStock || d.status === "archived") return false;
    } else if (filter.status) {
      if (d.status !== filter.status) return false;
    } else if (d.status === "archived") {
      return false;
    }
    if (filter.category && !summary.categoryKey.startsWith(filter.category)) return false;
    if (filter.stock === "out" && summary.stock > 0) return false;
    if (filter.stock === "in" && summary.stock === 0) return false;
    if (filter.stock === "low" && !summary.lowStock) return false;
    if (q) {
      const hay = [summary.name, data.data.styleId, ...data.data.matrix.map((r) => r.sku)]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const sorted = filtered.sort((a, b) => {
    if (filter.sort === "name") return (a.summary?.name ?? "").localeCompare(b.summary?.name ?? "");
    if (filter.sort === "price")
      return (a.summary?.priceMin ?? Infinity) - (b.summary?.priceMin ?? Infinity);
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });

  const offset = filter.offset ?? 0;
  const limit = filter.limit ?? 25;
  const page = sorted.slice(offset, offset + limit);
  return {
    total: sorted.length,
    nextOffset: offset + limit < sorted.length ? offset + limit : null,
    items: page.map((d) => {
      const data = parseData(d.data);
      return {
        id: d.id,
        status: d.status,
        summary: d.summary as DraftSummary,
        updatedAt: d.updatedAt,
        styleId: data.styleId,
        rows: data.matrix.slice(0, 60).map((r) => ({
          key: r.key,
          label: `${data.colors.find((c) => c.code === r.color)?.name || r.color} · ${r.fit} · ${r.size}`,
          stock: r.stock,
        })),
      };
    }),
  };
}
