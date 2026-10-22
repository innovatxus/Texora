/**
 * The variant matrix: every colour × fit × size a product is made in, with
 * per-variant SKU, price, stock per location and the rest. Pure functions,
 * so changing options on an existing product is predictable and fully
 * tested: rows that still exist keep everything entered, new rows get
 * defaults, and removed rows are parked so re-adding them restores their data.
 */
import type { FitFamily } from "@/lib/validation/common";

/** One sellable combination. Prices are integer cents; null means "not entered yet". */
export interface MatrixRow {
  key: string;
  color: string;
  fit: FitFamily;
  size: string;
  sku: string;
  price: number | null;
  compareAtPrice: number | null;
  /** Units per merchant location id. */
  stock: Record<string, number>;
  barcode: string;
  weightGrams: number | null;
  availableOnline: boolean;
  backorder: boolean;
  lowStockThreshold: number;
}

export interface MatrixOptions {
  /** Colour codes, in display order. */
  colors: readonly string[];
  fits: readonly FitFamily[];
  sizes: readonly string[];
  /** Combinations the merchant doesn't make (keys from `variantKey`). */
  excluded: ReadonlySet<string>;
}

export interface MatrixDefaults {
  skuPrefix: string;
  price: number | null;
  compareAtPrice: number | null;
  weightGrams: number | null;
  lowStockThreshold: number;
}

export interface MatrixResult {
  rows: MatrixRow[];
  /** Rows taken out by the change, kept so re-adding the option restores them. */
  parked: MatrixRow[];
  added: number;
  kept: number;
  removed: number;
}

const FIT_CODES: Readonly<Record<FitFamily, string>> = {
  regular: "R",
  petite: "P",
  tall: "T",
  plus: "W",
};

/** Stable key for a combination. */
export function variantKey(color: string, fit: FitFamily, size: string): string {
  return `${color}|${fit}|${size}`;
}

/** Upper-case letters, digits and single dashes only. */
export function skuPart(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** The suggested SKU for a combination: PREFIX-COLOUR-FIT-SIZE. */
export function suggestSku(prefix: string, color: string, fit: FitFamily, size: string): string {
  return [skuPart(prefix), skuPart(color), FIT_CODES[fit], skuPart(size)].filter(Boolean).join("-");
}

/** All combinations of the options, in colour → fit → size order, minus exclusions. */
export function combinations(
  options: MatrixOptions,
): Array<{ color: string; fit: FitFamily; size: string }> {
  const out: Array<{ color: string; fit: FitFamily; size: string }> = [];
  for (const color of options.colors) {
    for (const fit of options.fits) {
      for (const size of options.sizes) {
        if (!options.excluded.has(variantKey(color, fit, size))) out.push({ color, fit, size });
      }
    }
  }
  return out;
}

/** Makes SKUs unique within the matrix by suffixing repeats (-2, -3, …). */
export function dedupeSkus(rows: readonly MatrixRow[]): MatrixRow[] {
  const seen = new Map<string, number>();
  return rows.map((row) => {
    const base = row.sku || "SKU";
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? row : { ...row, sku: `${base}-${count + 1}` };
  });
}

/**
 * Rebuilds the matrix after options change. Existing rows (and parked rows
 * that come back) keep every value; new combinations get the defaults and a
 * suggested SKU. Order follows the options, so reordering colours reorders rows.
 */
export function buildMatrix(
  options: MatrixOptions,
  previous: readonly MatrixRow[],
  parked: readonly MatrixRow[],
  defaults: MatrixDefaults,
): MatrixResult {
  const known = new Map([...parked, ...previous].map((r) => [r.key, r]));
  const previousKeys = new Set(previous.map((r) => r.key));
  let added = 0;
  let kept = 0;

  const rows = combinations(options).map(({ color, fit, size }) => {
    const key = variantKey(color, fit, size);
    const existing = known.get(key);
    if (existing) {
      if (previousKeys.has(key)) kept++;
      else added++;
      return existing;
    }
    added++;
    return {
      key,
      color,
      fit,
      size,
      sku: suggestSku(defaults.skuPrefix, color, fit, size),
      price: defaults.price,
      compareAtPrice: defaults.compareAtPrice,
      stock: {},
      barcode: "",
      weightGrams: defaults.weightGrams,
      availableOnline: true,
      backorder: false,
      lowStockThreshold: defaults.lowStockThreshold,
    } satisfies MatrixRow;
  });

  const currentKeys = new Set(rows.map((r) => r.key));
  const removedRows = previous.filter((r) => !currentKeys.has(r.key));
  const stillParked = parked.filter((r) => !currentKeys.has(r.key) && !previousKeys.has(r.key));
  return {
    rows: dedupeSkus(rows),
    parked: [...stillParked, ...removedRows],
    added,
    kept,
    removed: removedRows.length,
  };
}

/** A bulk edit applied to selected rows. */
export interface BulkPatch {
  price?: number | null;
  compareAtPrice?: number | null;
  /** Sets stock at one location. */
  stock?: { locationId: string; quantity: number };
  weightGrams?: number | null;
  availableOnline?: boolean;
  backorder?: boolean;
  lowStockThreshold?: number;
}

/** Applies a bulk edit to the selected rows only. */
export function applyBulk(
  rows: readonly MatrixRow[],
  selected: ReadonlySet<string>,
  patch: BulkPatch,
): MatrixRow[] {
  return rows.map((row) => {
    if (!selected.has(row.key)) return row;
    const { stock, ...rest } = patch;
    return {
      ...row,
      ...rest,
      ...(stock ? { stock: { ...row.stock, [stock.locationId]: stock.quantity } } : {}),
    };
  });
}

/** Rows matching the toolbar filters (all when a filter is empty). */
export function filterRows(
  rows: readonly MatrixRow[],
  filter: { color?: string | undefined; fit?: FitFamily | undefined; size?: string | undefined },
): MatrixRow[] {
  return rows.filter(
    (r) =>
      (!filter.color || r.color === filter.color) &&
      (!filter.fit || r.fit === filter.fit) &&
      (!filter.size || r.size === filter.size),
  );
}

/**
 * Units sellable online: the sum over the merchant's active ship-from
 * locations (D-065). Retail-only locations don't ship.
 */
export function onlineStock(
  stock: Readonly<Record<string, number>>,
  shipFrom: readonly string[],
): number {
  return shipFrom.reduce((sum, id) => sum + Math.max(0, stock[id] ?? 0), 0);
}

export interface MatrixProblem {
  key: string | null;
  message: string;
}

/**
 * What's wrong with a matrix for publishing: no variants, missing prices,
 * compare-at not above price, duplicate SKUs or barcodes, nothing sellable.
 */
export function matrixProblems(
  rows: readonly MatrixRow[],
  shipFrom: readonly string[],
): MatrixProblem[] {
  if (rows.length === 0) return [{ key: null, message: "Add at least one colour, fit and size" }];
  const problems: MatrixProblem[] = [];
  const missingPrice = rows.filter((r) => r.price === null || r.price <= 0);
  if (missingPrice.length > 0) {
    problems.push({
      key: missingPrice[0]?.key ?? null,
      message: `Price every variant you make (${missingPrice.length} missing)`,
    });
  }
  const badCompare = rows.find(
    (r) => r.compareAtPrice !== null && r.price !== null && r.compareAtPrice <= r.price,
  );
  if (badCompare) {
    problems.push({ key: badCompare.key, message: "Compare-at must be higher than the price" });
  }
  const skus = new Map<string, number>();
  for (const r of rows) skus.set(r.sku, (skus.get(r.sku) ?? 0) + 1);
  const duplicate = rows.find((r) => !r.sku || (skus.get(r.sku) ?? 0) > 1);
  if (duplicate) {
    problems.push({
      key: duplicate.key,
      message: duplicate.sku
        ? `SKU ${duplicate.sku} is used more than once`
        : "Every variant needs a SKU",
    });
  }
  const barcodes = rows.map((r) => r.barcode).filter(Boolean);
  if (new Set(barcodes).size !== barcodes.length) {
    problems.push({ key: null, message: "Each barcode can only be used once" });
  }
  const sellable = rows.some(
    (r) => r.availableOnline && (r.backorder || onlineStock(r.stock, shipFrom) > 0),
  );
  if (!sellable) {
    problems.push({ key: null, message: "Add stock or allow backorder on at least one variant" });
  }
  return problems;
}
