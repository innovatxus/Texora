/**
 * Product editor helpers shared by the editor UI and its tests: colour ids,
 * suggested alt text, generated SEO fields, style ids and the matrix options
 * a draft describes. Pure.
 */
import { MERCHANT_LIMITS } from "@/config/merchant";
import { suggestShopSlug, type DraftColor, type ProductDraftData } from "@/lib/validation/merchant";
import type { MatrixDefaults, MatrixOptions } from "./variants/matrix";

/** A stable colour code from its name, unique among existing codes ("navy", "navy-2"). */
export function colorCode(name: string, existing: readonly string[]): string {
  const base = suggestShopSlug(name).slice(0, 30) || "colour";
  if (!existing.includes(base)) return base;
  let n = 2;
  while (existing.includes(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

const VIEWS = ["front", "back", "detail", "on model", "side", "flat lay"];

/** "Linen Midi Dress in Navy, front view" — prefilled, but the merchant must confirm it. */
export function suggestAlt(productName: string, colorName: string, index: number): string {
  const product = productName.trim() || "Product";
  const view = VIEWS[index] ?? `view ${index + 1}`;
  return `${product} in ${colorName.trim() || "this colour"}, ${view}`.slice(0, 200);
}

/** SEO title: "Linen Midi Dress | Maison Rue", trimmed to 60 characters at a word. */
export function suggestSeoTitle(productName: string, shopName: string): string {
  return trimAtWord(`${productName.trim()} | ${shopName}`, 60);
}

/** SEO description: the first sentences of the description, up to 155 characters. */
export function suggestSeoDescription(description: string): string {
  return trimAtWord(description.replace(/\s+/g, " ").trim(), 155);
}

function trimAtWord(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 20)).trimEnd()}…`;
}

/** Product address from its name. */
export function suggestProductSlug(productName: string): string {
  return suggestShopSlug(productName).slice(0, MERCHANT_LIMITS.product.nameMax);
}

/** "MAISON-DRESSES-07": shop, category and a sequence, unique per shop. */
export function suggestStyleId(shopSlug: string, categoryKey: string, sequence: number): string {
  const shop = shopSlug.split("-").slice(0, 2).join("").slice(0, 8).toUpperCase();
  const category = (categoryKey.split("/").at(-1) ?? "item")
    .replace(/[^a-z]/g, "")
    .slice(0, 7)
    .toUpperCase();
  return `${shop}-${category}-${String(sequence).padStart(2, "0")}`;
}

/** The matrix options a draft describes. */
export function matrixOptions(
  data: Pick<ProductDraftData, "colors" | "fits" | "sizes" | "excluded">,
): MatrixOptions {
  return {
    colors: data.colors.map((c) => c.code),
    fits: data.fits,
    sizes: data.sizes,
    excluded: new Set(data.excluded),
  };
}

/** Defaults for new variant rows: the first price entered, or nothing yet. */
export function matrixDefaults(
  data: Pick<ProductDraftData, "styleId" | "matrix" | "shipping">,
): MatrixDefaults {
  const priced = data.matrix.find((r) => r.price !== null);
  return {
    skuPrefix: data.styleId || "SKU",
    price: priced?.price ?? null,
    compareAtPrice: priced?.compareAtPrice ?? null,
    weightGrams: data.shipping.weightGrams,
    lowStockThreshold: 3,
  };
}

/** Problems with a colour's photos: none, missing or unconfirmed alt text. */
export function colorMediaProblems(color: DraftColor): string[] {
  const problems: string[] = [];
  if (color.images.length === 0)
    problems.push(`Add at least one image to ${color.name || "this colour"}`);
  const unconfirmed = color.images.filter((i) => !i.altConfirmed || !i.alt.trim()).length;
  if (unconfirmed > 0) {
    problems.push(
      `Add alt text to ${unconfirmed} image${unconfirmed === 1 ? "" : "s"} of ${color.name || "this colour"}`,
    );
  }
  return problems;
}
