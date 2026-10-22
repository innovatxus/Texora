/**
 * What stops a product from being submitted or published (prompt §3.7), in
 * merchant-facing words with the editor field to fix. Pure: the editor, the
 * submit action and the admin review share exactly this list.
 */
import {
  attributeProblems,
  compositionProblem,
  productConfigFor,
} from "@/config/product-attributes";
import type { ProductDraftData } from "@/lib/validation/merchant";
import { colorMediaProblems } from "../editor";
import { matrixProblems } from "../variants/matrix";

export interface PublishProblem {
  /** Editor field id to focus (see the editor sections), or null for account-level problems. */
  field: string | null;
  message: string;
}

export interface PublishContext {
  emailVerified: boolean;
  /** Active ship-from location ids (their stock is what sells online). */
  shipFrom: readonly string[];
}

/** Every problem with a draft for submission, in editor order. */
export function publishProblems(data: ProductDraftData, context: PublishContext): PublishProblem[] {
  const problems: PublishProblem[] = [];
  if (!context.emailVerified) problems.push({ field: null, message: "Verify your email first" });
  if (!data.name.trim()) problems.push({ field: "field-name", message: "Add a product name" });
  if (data.description.trim().length < 20) {
    problems.push({
      field: "field-description",
      message: "Add a description of at least 20 characters",
    });
  }
  const config = productConfigFor(data.categoryKey);
  if (!config) {
    problems.push({
      field: "field-category",
      message: "Choose a specific category, like Women › Dresses",
    });
  } else {
    for (const p of attributeProblems(data.categoryKey, data.attributes)) {
      problems.push({ field: `field-attr-${p.key}`, message: p.message });
    }
    if (data.fits.some((f) => !config.fitFamilies.includes(f))) {
      problems.push({ field: "field-fits", message: "Choose fits this category allows" });
    }
  }
  const composition = compositionProblem(data.composition);
  if (composition) problems.push({ field: "field-composition", message: composition });
  if (!data.styleId.trim()) problems.push({ field: "field-style", message: "Add a style ID" });
  if (data.colors.length === 0) {
    problems.push({ field: "field-colors", message: "Add at least one colour" });
  }
  for (const color of data.colors) {
    if (!color.name.trim()) problems.push({ field: "field-colors", message: "Name every colour" });
    if (!/^#[0-9a-f]{6}$/i.test(color.swatch)) {
      problems.push({
        field: "field-colors",
        message: `Use a colour like #1F2A44 for ${color.name}`,
      });
    }
    for (const message of colorMediaProblems(color)) {
      problems.push({ field: `field-media-${color.code}`, message });
    }
  }
  if (data.sizes.some((s) => s.length > 16)) {
    problems.push({ field: "field-sizes", message: "Keep sizes to 16 characters" });
  }
  for (const p of matrixProblems(data.matrix, context.shipFrom)) {
    problems.push({ field: "field-matrix", message: p.message });
  }
  if (data.matrix.some((r) => !r.weightGrams && !data.shipping.weightGrams)) {
    problems.push({
      field: "field-weight",
      message: "Add a weight for every variant, or a default weight in Shipping",
    });
  }
  if (data.slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.slug)) {
    problems.push({
      field: "field-slug",
      message: "Use lowercase letters, numbers and single hyphens",
    });
  }
  if (data.publishAt && Number.isNaN(Date.parse(data.publishAt))) {
    problems.push({ field: "field-publish-at", message: "Choose a valid date and time" });
  }
  // Same message from several colours/rows once is enough.
  const seen = new Set<string>();
  return problems.filter((p) => !seen.has(p.message) && seen.add(p.message));
}
