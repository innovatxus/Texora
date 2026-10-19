import { MAX_LINE_QUANTITY, selectBagCount, useBagStore } from "./bag";

beforeEach(() => useBagStore.getState().clear());

describe("bag store", () => {
  it("adds lines and merges repeat SKUs", () => {
    const { add } = useBagStore.getState();
    add({ sku: "A", productId: "p1" });
    add({ sku: "A", productId: "p1", quantity: 2 });
    add({ sku: "B", productId: "p2" });
    expect(useBagStore.getState().lines.map((l) => [l.sku, l.quantity])).toEqual([
      ["A", 3],
      ["B", 1],
    ]);
    expect(selectBagCount(useBagStore.getState())).toBe(4);
  });

  it("caps quantity per line", () => {
    useBagStore.getState().add({ sku: "A", productId: "p1", quantity: 50 });
    expect(useBagStore.getState().lines[0]?.quantity).toBe(MAX_LINE_QUANTITY);
  });

  it("removes a line when quantity drops to zero", () => {
    const { add, setQuantity } = useBagStore.getState();
    add({ sku: "A", productId: "p1" });
    setQuantity("A", 0);
    expect(useBagStore.getState().lines).toEqual([]);
  });
});
