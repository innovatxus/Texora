import { MAX_LINE_QUANTITY, selectBagCount, useBagStore } from "./bag";

beforeEach(() =>
  useBagStore.setState({
    lines: [],
    savedForLater: [],
    promoCodes: [],
    giftCardCode: null,
    rewardsValue: 0,
  }),
);

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

describe("bag store: editing and saving", () => {
  it("swaps a line to another size and merges with an existing line", () => {
    const { add, replaceSku } = useBagStore.getState();
    add({ sku: "M", productId: "p1", quantity: 2 });
    add({ sku: "L", productId: "p1" });
    replaceSku("M", { sku: "L", productId: "p1" });
    expect(useBagStore.getState().lines.map((l) => [l.sku, l.quantity])).toEqual([["L", 3]]);
  });

  it("moves lines between the bag and saved for later", () => {
    const { add, saveForLater, moveToBag } = useBagStore.getState();
    add({ sku: "A", productId: "p1", quantity: 2 });
    saveForLater("A");
    expect(useBagStore.getState().lines).toEqual([]);
    expect(useBagStore.getState().savedForLater[0]?.sku).toBe("A");
    moveToBag("A");
    expect(useBagStore.getState().lines[0]?.quantity).toBe(2);
    expect(useBagStore.getState().savedForLater).toEqual([]);
  });

  it("normalises and de-duplicates promo codes", () => {
    const { addPromoCode } = useBagStore.getState();
    addPromoCode(" welcome15 ");
    addPromoCode("WELCOME15");
    expect(useBagStore.getState().promoCodes).toEqual(["WELCOME15"]);
  });
});
