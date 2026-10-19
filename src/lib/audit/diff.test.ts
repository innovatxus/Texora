import { changedPaths } from "./diff";

describe("changedPaths", () => {
  it("reports created and deleted documents as every top-level key", () => {
    expect(changedPaths(null, { a: 1, b: { c: 2 } })).toEqual(["a", "b"]);
    expect(changedPaths({ a: 1 }, null)).toEqual(["a"]);
  });

  it("walks nested objects", () => {
    expect(
      changedPaths(
        { price: 8900, stock: { online: 4, soho: 1 } },
        { price: 8900, stock: { online: 3, soho: 1 } },
      ),
    ).toEqual(["stock.online"]);
  });

  it("compares arrays and dates as values", () => {
    const d = new Date("2026-01-01");
    expect(changedPaths({ tags: ["a"], at: d }, { tags: ["a"], at: new Date(d) })).toEqual([]);
    expect(changedPaths({ tags: ["a"] }, { tags: ["a", "b"] })).toEqual(["tags"]);
  });

  it("catches added and removed keys", () => {
    expect(changedPaths({ a: 1 }, { b: 1 })).toEqual(["a", "b"]);
  });

  it("returns nothing for identical documents", () => {
    expect(changedPaths({ a: { b: [1, { c: 2 }] } }, { a: { b: [1, { c: 2 }] } })).toEqual([]);
  });
});
