import {
  colorCode,
  colorMediaProblems,
  matrixDefaults,
  suggestAlt,
  suggestSeoDescription,
  suggestSeoTitle,
  suggestStyleId,
} from "./editor";

describe("product editor helpers", () => {
  it("makes unique colour codes", () => {
    expect(colorCode("Navy Blue", [])).toBe("navy-blue");
    expect(colorCode("Navy", ["navy"])).toBe("navy-2");
    expect(colorCode("Navy", ["navy", "navy-2"])).toBe("navy-3");
    expect(colorCode("!!!", [])).toBe("colour");
  });

  it("suggests alt text per view", () => {
    expect(suggestAlt("Linen Dress", "Navy", 0)).toBe("Linen Dress in Navy, front");
    expect(suggestAlt("", "", 9)).toBe("Product in this colour, view 10");
  });

  it("generates SEO fields within limits", () => {
    expect(suggestSeoTitle("Linen Midi Dress", "Maison Rue")).toBe("Linen Midi Dress | Maison Rue");
    const long = suggestSeoTitle(
      "An Exceptionally Long Product Name That Keeps Going",
      "Maison Rue Atelier",
    );
    expect(long.length).toBeLessThanOrEqual(60);
    expect(long.endsWith("…")).toBe(true);
    const description = suggestSeoDescription(`${"Soft linen. ".repeat(30)}`);
    expect(description.length).toBeLessThanOrEqual(155);
  });

  it("suggests style ids", () => {
    expect(suggestStyleId("maison-rue", "s1aB4f2", "women/dresses", 7)).toBe(
      "MAISON4F2-DRESSES-07",
    );
  });

  it("defaults new rows to the first price entered", () => {
    const row = { price: 9800, compareAtPrice: 12000 } as never;
    expect(
      matrixDefaults({ styleId: "MR-1", matrix: [row], shipping: { weightGrams: 300 } as never }),
    ).toMatchObject({
      skuPrefix: "MR-1",
      price: 9800,
      compareAtPrice: 12000,
      weightGrams: 300,
    });
  });

  it("flags colours without photos or confirmed alt text", () => {
    const image = { altConfirmed: false, alt: "x" } as never;
    expect(colorMediaProblems({ name: "Navy", images: [] } as never)).toEqual([
      "Add at least one image to Navy",
    ]);
    expect(colorMediaProblems({ name: "Navy", images: [image, image] } as never)).toEqual([
      "Add alt text to 2 images of Navy",
    ]);
  });
});
