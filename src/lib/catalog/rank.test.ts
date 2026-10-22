import { compareSalesRank } from "./rank";

describe("compareSalesRank", () => {
  it("orders best sellers first and unranked products last", () => {
    const ranks = [0, 3, 1, 0, 2].map((salesRank) => ({ salesRank }));
    expect(ranks.sort(compareSalesRank).map((r) => r.salesRank)).toEqual([1, 2, 3, 0, 0]);
  });
});
