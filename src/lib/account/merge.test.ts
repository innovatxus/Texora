import { mergeBagLines } from "./merge";

const line = (sku: string, quantity: number, addedAt: number) => ({
  sku,
  productId: `p-${sku}`,
  quantity,
  addedAt,
});

describe("mergeBagLines", () => {
  it("keeps one line per SKU with the larger quantity and earlier date", () => {
    const merged = mergeBagLines([line("A", 1, 30), line("B", 2, 20)], [line("A", 3, 10)]);
    expect(merged).toEqual([line("B", 2, 20), line("A", 3, 10)]);
  });

  it("is idempotent: merging the result again changes nothing", () => {
    const once = mergeBagLines([line("A", 2, 5)], [line("C", 1, 9)]);
    expect(mergeBagLines(once, once)).toEqual(once);
  });

  it("caps the bag at 50 lines, newest first", () => {
    const many = Array.from({ length: 60 }, (_, i) => line(`S${i}`, 1, i));
    const merged = mergeBagLines(many, []);
    expect(merged).toHaveLength(50);
    expect(merged[0]?.sku).toBe("S59");
  });
});
