import { buildIndex, normalise, search, tokenise, type SearchDocument } from "./match";

const doc = (
  id: string,
  name: string,
  department: string,
  category: string,
  rank: number,
): SearchDocument => ({
  id,
  slug: id,
  name,
  department,
  category,
  categoryLabel: `${department === "women" ? "Women's" : "Men's"} ${category}`,
  keywords: [],
  image: "",
  imageAlt: "",
  price: 1000,
  maxPrice: 1000,
  salesRank: rank,
});

const index = buildIndex([
  doc("a", "Linen Camp-Collar Shirt", "men", "shirts", 5),
  doc("b", "Oxford Button-Down Shirt", "men", "shirts", 1),
  doc("c", "Linen Midi Shirt Dress", "women", "dresses", 3),
  doc("d", "Cashmere Crew Sweater", "women", "sweaters", 2),
  doc("e", "Slim Stretch Chino", "men", "pants", 4),
  doc("f", "Wool Topcoat", "men", "outerwear", 6),
]);

const ids = (q: string) => search(index, q, 10).products.map((p) => p.id);

describe("tokenise", () => {
  it("normalises case, accents and punctuation", () => {
    expect(normalise("  Café-Crème  ")).toBe("cafe-creme");
    expect(tokenise("T-Shirts & Jumpers")).toEqual(["tee", "shirt", "sweater"]);
    expect(tokenise("Dresses")).toEqual(["dress"]);
  });
});

describe("search", () => {
  it("requires every word to match", () => {
    expect(ids("linen shirt").sort()).toEqual(["a", "c"]);
  });

  it("breaks score ties by sales rank", () => {
    expect(ids("shirt")).toEqual(["b", "c", "a"]);
  });

  it("matches plurals", () => {
    expect(ids("shirts")).toEqual(["b", "c", "a"]);
    expect(ids("sweaters")).toEqual(["d"]);
  });

  it("matches prefixes on the last word while typing", () => {
    expect(ids("cashm")).toEqual(["d"]);
    expect(ids("linen sh").sort()).toEqual(["a", "c"]);
  });

  it("tolerates one typo in longer words", () => {
    expect(ids("cashmire")).toEqual(["d"]);
    expect(ids("oxfrd")).toEqual(["b"]);
  });

  it("applies synonyms", () => {
    expect(ids("jumper")).toEqual(["d"]);
    expect(ids("trousers")).toEqual(["e"]);
    expect(ids("jacket")).toEqual(["f"]);
  });

  it("groups matching categories by count", () => {
    expect(search(index, "shirt").categories).toEqual([
      { label: "Men's shirts", href: "/men/shirts", count: 2 },
      { label: "Women's dresses", href: "/women/dresses", count: 1 },
    ]);
  });

  it("returns nothing for empty or unmatched queries", () => {
    expect(search(index, "   ").total).toBe(0);
    expect(search(index, "zzzz").total).toBe(0);
  });
});
