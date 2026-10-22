/**
 * Pure helpers for product drafts: list summaries, shop counters and a blank
 * draft. Shared by the product service and the seed script.
 */
import type { ProductStatus } from "@/lib/validation/catalog";
import type { DraftSummary, ProductDraftData, Shop, ShopCounters } from "@/lib/validation/merchant";
import { onlineStock } from "./variants/matrix";

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
