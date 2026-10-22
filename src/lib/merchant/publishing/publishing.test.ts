import {
  EMPTY_FILTERS,
  computeFacets,
  applyFilters,
  parseListingQuery,
  toSearchParams,
} from "@/lib/catalog/listing";
import type { ListingProduct } from "@/lib/catalog/listing-types";
import { productSchema, variantSchema } from "@/lib/validation/catalog";
import type { ProductDraftData, Shop } from "@/lib/validation/merchant";
import { buildMatrix } from "../variants/matrix";
import { chooseSlug, storefrontStatus, toStorefrontDocs } from "./storefront-docs";
import { publishProblems } from "./validate";

const now = new Date("2026-10-21T12:00:00Z");

function draft(over: Partial<ProductDraftData> = {}): ProductDraftData {
  const matrix = buildMatrix(
    { colors: ["navy"], fits: ["regular", "petite"], sizes: ["S", "M"], excluded: new Set() },
    [],
    [],
    {
      skuPrefix: "HARB-01",
      price: 14800,
      compareAtPrice: null,
      weightGrams: 400,
      lowStockThreshold: 3,
    },
  ).rows.map((r, i) => ({ ...r, stock: { wh: i + 1, store: 5 } }));
  return {
    name: "Linen Midi Dress",
    description: "Washed linen, cut for warm days and long dinners.",
    highlights: ["Pockets", ""],
    categoryKey: "women/dresses",
    styleId: "HARB-01",
    attributes: { length: "midi", sleeve: "short" },
    composition: [
      { material: "linen", percent: 55 },
      { material: "cotton", percent: 45 },
    ],
    colors: [
      {
        code: "navy",
        name: "Navy",
        family: "blue",
        swatch: "#1F2A44",
        images: [
          {
            mediaId: "m1",
            url: "/media/m/v1/s1/m1.webp",
            alt: "Linen Midi Dress in Navy, front",
            altConfirmed: true,
            width: 1200,
            height: 1600,
            blurDataURL: "data:image/webp;base64,AA",
            dominantColor: "#1f2a44",
          },
        ],
      },
    ],
    fits: ["regular", "petite"],
    sizes: ["S", "M"],
    excluded: [],
    matrix,
    parked: [],
    details: {
      fitNotes: "True to size",
      modelInfo: "",
      care: ["Machine wash cold"],
      sizeGuide: "platform",
      customGuide: [],
    },
    shipping: {
      weightGrams: 400,
      lengthCm: null,
      widthCm: null,
      heightCm: null,
      shipsFromLocationId: "wh",
      processingTime: "",
    },
    seo: { title: "", description: "" },
    slug: "",
    searchKeywords: ["linen"],
    publishAt: "",
    ...over,
  };
}

const shop = {
  id: "s1",
  slug: "harbour-goods",
  name: "Harbour Goods",
  vendorId: "v1",
  status: "approved",
  logo: {
    mediaId: "l1",
    url: "/media/m/v1/s1/l1.webp",
    alt: "logo",
    width: 512,
    height: 512,
    blurDataURL: "data:image/webp;base64,AA",
    dominantColor: "#000000",
  },
} as Pick<Shop, "id" | "slug" | "name" | "logo" | "vendorId" | "status">;

describe("toStorefrontDocs", () => {
  const { product, variants } = toStorefrontDocs({
    productId: "p1",
    data: draft(),
    shop,
    merchantStatus: "live",
    slug: "linen-midi-dress",
    shipFrom: ["wh"],
    now,
  });

  it("produces documents that match the storefront schemas", () => {
    expect(productSchema.safeParse(product).success).toBe(true);
    for (const v of variants) expect(variantSchema.safeParse(v).success).toBe(true);
  });

  it("denormalises the shop and keeps the vendor", () => {
    expect(product).toMatchObject({
      status: "live",
      vendorId: "v1",
      shopId: "s1",
      shop: {
        id: "s1",
        slug: "harbour-goods",
        name: "Harbour Goods",
        logo: { url: "/media/m/v1/s1/l1.webp" },
      },
      categoryPath: ["women", "dresses"],
      categoryKeys: ["women", "women/dresses"],
      priceRange: { min: 14800, max: 14800 },
    });
  });

  it("turns composition into material filters and a fabric line", () => {
    expect(product.attributes.material).toEqual(["linen", "cotton"]);
    expect(product.details.fabricCare).toEqual(["55% linen, 45% cotton", "Machine wash cold"]);
    expect(product.description).toContain("• Pockets");
  });

  it("writes stock per merchant location and the online total from ship-from locations only", () => {
    expect(variants).toHaveLength(4);
    expect(variants[0]?.stockByLocation).toEqual({ m_s1_wh: 1, m_s1_store: 5, online: 1 });
    expect(variants.every((v) => v.vendorId === "v1" && v.shopId === "s1")).toBe(true);
  });

  it("generates SEO fields when the merchant leaves them empty", () => {
    expect(product.seo.title).toBe("Linen Midi Dress | Harbour Goods");
    expect(product.seo.description?.startsWith("Washed linen")).toBe(true);
  });
});

describe("visibility", () => {
  it("is live only when the product is live and the shop approved", () => {
    expect(storefrontStatus("live", "approved")).toBe("live");
    expect(storefrontStatus("live", "pending_review")).toBe("draft");
    expect(storefrontStatus("live", "suspended")).toBe("draft");
    expect(storefrontStatus("scheduled", "approved")).toBe("scheduled");
    expect(storefrontStatus("archived", "approved")).toBe("archived");
    expect(storefrontStatus("in_review", "approved")).toBe("draft");
  });
});

describe("chooseSlug", () => {
  it("uses the merchant's address, else the name, made unique", () => {
    expect(chooseSlug({ slug: "", name: "Linen Midi Dress" }, () => false)).toBe(
      "linen-midi-dress",
    );
    const taken = new Set(["linen-midi-dress", "linen-midi-dress-2"]);
    expect(chooseSlug({ slug: "", name: "Linen Midi Dress" }, (s) => taken.has(s))).toBe(
      "linen-midi-dress-3",
    );
    expect(chooseSlug({ slug: "my-dress", name: "x" }, () => false)).toBe("my-dress");
  });
});

describe("publishProblems", () => {
  const ctx = { emailVerified: true, shipFrom: ["wh"] };
  const navy = () => {
    const color = draft().colors[0];
    if (!color) throw new Error("fixture has no colour");
    return color;
  };

  it("passes a complete product", () => {
    expect(publishProblems(draft(), ctx)).toEqual([]);
  });

  it("lists every blocker with the field to fix", () => {
    const broken = draft({
      name: "",
      attributes: { length: "midi" },
      composition: [{ material: "linen", percent: 90 }],
      colors: [{ ...navy(), images: [] }],
    });
    const problems = publishProblems(broken, { emailVerified: false, shipFrom: ["wh"] });
    expect(problems.map((p) => p.message)).toEqual([
      "Verify your email first",
      "Add a product name",
      "Fill in the required attribute: Sleeve",
      "Total 90% — composition must add up to 100%",
      "Add at least one image to Navy",
    ]);
    expect(problems[2]?.field).toBe("field-attr-sleeve");
    expect(problems[4]?.field).toBe("field-media-navy");
  });

  it("requires something sellable and alt text", () => {
    const noStock = draft({ matrix: draft().matrix.map((r) => ({ ...r, stock: {} })) });
    expect(publishProblems(noStock, ctx).map((p) => p.message)).toContain(
      "Add stock or allow backorder on at least one variant",
    );
    const unconfirmed = draft({
      colors: [
        {
          ...navy(),
          images: navy().images.map((i) => ({ ...i, altConfirmed: false })),
        },
      ],
    });
    expect(publishProblems(unconfirmed, ctx).map((p) => p.message)).toContain(
      "Add alt text to 1 image of Navy",
    );
  });
});

describe("shop facet", () => {
  const item = (id: string, shop?: { id: string; slug: string; name: string }): ListingProduct =>
    ({
      id,
      categoryPath: ["women", "dresses"],
      sizesInStock: [],
      fitFamilies: ["regular"],
      colors: [],
      price: 1000,
      attributes: {},
      storesInStock: [],
      inStockOnline: true,
      createdAt: 0,
      ...(shop ? { shop } : {}),
    }) as unknown as ListingProduct;
  const products = [
    item("a", { id: "s1", slug: "harbour", name: "Harbour Goods" }),
    item("b", { id: "s2", slug: "maison", name: "Maison Rue" }),
    item("c"),
  ];

  it("appears when results mix shops and filters by shop", () => {
    const facets = computeFacets(products, EMPTY_FILTERS, { attributeKeys: [], stores: [] }, 0);
    const shopFacet = facets.find((f) => f.key === "shop");
    expect(shopFacet?.options.map((o) => [o.label, o.count])).toEqual([
      ["Harbour Goods", 1],
      ["Maison Rue", 1],
    ]);
    const filtered = applyFilters(products, { ...EMPTY_FILTERS, shop: ["maison"] }, 0);
    expect(filtered.map((p) => p.id)).toEqual(["b"]);
  });

  it("round-trips through the URL", () => {
    const query = parseListingQuery({ shop: "maison" });
    expect(query.filters.shop).toEqual(["maison"]);
    expect(toSearchParams({ filters: query.filters }).get("shop")).toBe("maison");
  });

  it("stays hidden with a single shop", () => {
    const facets = computeFacets(
      products.slice(0, 1),
      EMPTY_FILTERS,
      { attributeKeys: [], stores: [] },
      0,
    );
    expect(facets.some((f) => f.key === "shop")).toBe(false);
  });
});
