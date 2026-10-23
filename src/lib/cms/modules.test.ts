import { campaignDiptychSchema, categoryTilesSchema, cmsModuleSchema } from "./modules";

const image = { url: "/media/stock/panelEvening-panel.jpg", alt: "A woman in an olive gown" };
const tile = (label: string, href: string) => ({ label, href, image });

describe("campaign diptych", () => {
  const valid = {
    headline: "Dress Code: Evening",
    ctas: [
      { label: "Women's new arrivals", href: "/women?sort=newest" },
      { label: "Men's new arrivals", href: "/men?sort=newest" },
      { label: "Explore the edit", href: "/collections/new-arrivals" },
    ],
    primary: image,
    secondary: image,
    layout: "pair",
  };

  it("accepts up to three internal calls to action", () => {
    expect(campaignDiptychSchema.safeParse(valid).success).toBe(true);
    const four = { ...valid, ctas: [...valid.ctas, { label: "More", href: "/sale" }] };
    expect(campaignDiptychSchema.safeParse(four).success).toBe(false);
    const external = { ...valid, ctas: [{ label: "Out", href: "https://example.com" }] };
    expect(campaignDiptychSchema.safeParse(external).success).toBe(false);
  });

  it("offers the framed layout with a short accent", () => {
    expect(
      campaignDiptychSchema.safeParse({ ...valid, layout: "framed", accent: "Wrap it up" }).success,
    ).toBe(true);
    expect(campaignDiptychSchema.safeParse({ ...valid, accent: "x".repeat(41) }).success).toBe(
      false,
    );
  });

  it("is a page module", () => {
    const page = {
      id: "home-campaign",
      type: "campaignDiptych",
      schedule: {},
      audience: ["everyone"],
      data: valid,
    };
    expect(cmsModuleSchema.safeParse(page).success).toBe(true);
  });
});

describe("category tiles", () => {
  it("keeps existing pages valid: no variant means compact", () => {
    const parsed = categoryTilesSchema.parse({
      tiles: [tile("Dresses", "/women/dresses"), tile("Coats", "/men/outerwear")],
    });
    expect(parsed.variant).toBe("compact");
  });

  it("lets bleed tiles link to each department", () => {
    const parsed = categoryTilesSchema.parse({
      variant: "bleed",
      tiles: [
        {
          ...tile("Denim", "/women/jeans"),
          links: [
            { label: "Shop women", href: "/women/jeans" },
            { label: "Shop men", href: "/men/jeans" },
          ],
        },
        tile("Knitwear", "/collections/knitwear"),
      ],
    });
    expect(parsed.tiles[0]?.links).toHaveLength(2);
  });
});
