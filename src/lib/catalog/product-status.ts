import type { ProductStatus } from "@/lib/validation/catalog";

/** Staff- and merchant-facing names for each product status. */
export const PRODUCT_STATUS_LABELS: Readonly<Record<ProductStatus, string>> = {
  draft: "Draft",
  scheduled: "Scheduled",
  live: "Live",
  archived: "Archived",
  in_review: "In review",
  changes_requested: "Changes requested",
};

/** Pill colour for each product status. */
export const PRODUCT_STATUS_TONES: Readonly<
  Record<ProductStatus, "neutral" | "success" | "warning" | "danger">
> = {
  draft: "neutral",
  scheduled: "warning",
  live: "success",
  archived: "danger",
  in_review: "warning",
  changes_requested: "danger",
};
