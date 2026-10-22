import type { CategoryProductConfig } from "@/config/product-attributes";
import type { ProductStatus } from "@/lib/validation/catalog";
import type { ProductDraftData } from "@/lib/validation/merchant";

/** Updates the draft from a section: a partial patch or a function of the current data. */
export type DraftUpdate = (
  change: Partial<ProductDraftData> | ((current: ProductDraftData) => Partial<ProductDraftData>),
) => void;

export interface EditorLocation {
  id: string;
  name: string;
  shipFrom: boolean;
}

/** Everything the editor needs from the server besides the draft itself. */
export interface EditorContext {
  productId: string;
  version: number;
  status: ProductStatus;
  shop: { id: string; name: string; slug: string };
  locations: readonly EditorLocation[];
  categories: readonly CategoryProductConfig[];
  /** How many products the shop has, for style id suggestions. */
  productCount: number;
  reviewNotes: readonly string[];
  /** Signed, time-limited preview link. */
  previewHref: string;
}

export interface SectionProps {
  data: ProductDraftData;
  update: DraftUpdate;
  context: EditorContext;
  /** Field-level problems from the last check, keyed by field id. */
  errors: Readonly<Record<string, string>>;
}
