/** A bag line as stored on the device and in the account. */
export interface MergeableLine {
  sku: string;
  productId: string;
  quantity: number;
  addedAt: number;
}

/**
 * Merges two bags line by line: each SKU appears once, with the larger
 * quantity and the earlier added date, so merging twice never doubles
 * anything. Pure, so it is unit tested.
 */
export function mergeBagLines<T extends MergeableLine>(a: readonly T[], b: readonly T[]): T[] {
  const bySku = new Map<string, T>();
  for (const line of [...a, ...b]) {
    const existing = bySku.get(line.sku);
    bySku.set(
      line.sku,
      existing
        ? {
            ...existing,
            quantity: Math.max(existing.quantity, line.quantity),
            addedAt: Math.min(existing.addedAt, line.addedAt),
          }
        : line,
    );
  }
  return [...bySku.values()].sort((x, y) => y.addedAt - x.addedAt).slice(0, 50);
}
