/**
 * Sales rank ordering: 1 is the best seller. 0 means "not ranked yet" (a new
 * product, such as a merchant's first listing), which sorts after every ranked
 * product rather than ahead of them.
 */
export function compareSalesRank(a: { salesRank: number }, b: { salesRank: number }): number {
  const rank = (r: number) => (r > 0 ? r : Number.POSITIVE_INFINITY);
  const ra = rank(a.salesRank);
  const rb = rank(b.salesRank);
  return ra === rb ? 0 : ra < rb ? -1 : 1;
}
