import { ROLES } from "../../src/lib/auth/rbac";
import { FIT_FAMILIES } from "../../src/lib/validation";
import { RESERVED_FILTER_KEYS } from "../../src/lib/catalog/listing";
import { generateSeed } from "./generate";

const NOW = new Date("2026-10-19T12:00:00Z");
const data = generateSeed({ now: NOW });

describe("seed data", () => {
  it("meets the brief's minimums", () => {
    expect(data.products.length).toBeGreaterThanOrEqual(120);
    expect(new Set(data.products.map((p) => p.department))).toEqual(new Set(["women", "men"]));
    const leafCategories = data.categories.filter((c) => c.parentId !== null);
    expect(leafCategories).toHaveLength(12);
    // Texora's own catalog is cut in regular, petite and tall; plus arrives with merchants.
    expect(new Set(data.variants.map((v) => v.fitFamily))).toEqual(
      new Set(FIT_FAMILIES.filter((f) => f !== "plus")),
    );
    expect(data.stores).toHaveLength(3);
    expect(data.reviews.length).toBeGreaterThan(300);
    expect(data.promotions.length).toBeGreaterThanOrEqual(3);
  });

  it("creates a sign-in account for every role except guest", () => {
    const seededRoles = new Set(data.profiles.map((u) => u.role));
    for (const role of ROLES.filter((r) => r !== "guest")) expect(seededRoles).toContain(role);
  });

  it("is deterministic for a given seed and clock", () => {
    const again = generateSeed({ now: NOW });
    expect(again.products.map((p) => [p.id, p.salesRank, p.ratingAvg])).toEqual(
      data.products.map((p) => [p.id, p.salesRank, p.ratingAvg]),
    );
    expect(again.variants.length).toBe(data.variants.length);
  });

  it("keeps ids, slugs and SKUs unique", () => {
    const unique = (xs: string[]) => new Set(xs).size === xs.length;
    expect(unique(data.products.map((p) => p.id))).toBe(true);
    expect(unique(data.products.map((p) => p.slug))).toBe(true);
    expect(unique(data.variants.map((v) => v.sku))).toBe(true);
  });

  it("keeps variants consistent with their product", () => {
    const byId = new Map(data.products.map((p) => [p.id, p]));
    for (const v of data.variants) {
      const product = byId.get(v.productId);
      expect(product).toBeDefined();
      expect(product?.colors.map((c) => c.code)).toContain(v.color);
      expect(product?.fitFamilies).toContain(v.fitFamily);
      expect(v.availableOnline).toBe((v.stockByLocation.online ?? 0) > 0);
    }
  });

  it("derives rating aggregates from approved reviews only", () => {
    for (const p of data.products) {
      const approved = data.reviews.filter((r) => r.productId === p.id && r.status === "approved");
      expect(p.ratingCount).toBe(approved.length);
    }
  });

  it("marks sale products with compare-at prices and the sale badge", () => {
    const sale = data.products.filter((p) => p.badges.includes("sale"));
    expect(sale.length).toBeGreaterThan(10);
    for (const p of sale) expect(p.priceRange.compareAtMin).toBeGreaterThan(p.priceRange.min);
  });

  it("stores only the hash of gift card codes", () => {
    for (const card of data.giftCards) expect(card.id).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(data.giftCards)).not.toContain(data.demoGiftCardCode);
  });

  it("never uses a reserved filter key as a product attribute", () => {
    for (const p of data.products) {
      for (const key of Object.keys(p.attributes))
        expect(RESERVED_FILTER_KEYS.has(key)).toBe(false);
    }
  });
});

describe("seed merchants", () => {
  const { merchants } = data;
  const shops = merchants.docs
    .filter((d) => /^shops\/[^/]+$/.test(d.path))
    .map((d) => d.data as { slug: string; shopType: string; status: string; banner?: unknown });
  const docsUnder = (prefix: string) => merchants.docs.filter((d) => d.path.startsWith(prefix));

  it("has three approved shops, one per shop type, plus one pending and one with changes", () => {
    const approved = shops.filter((s) => s.status === "approved");
    expect(approved.map((s) => s.shopType).sort()).toEqual(["boutique", "brand", "designer"]);
    expect(shops.filter((s) => s.status === "pending_review")).toHaveLength(1);
    expect(shops.filter((s) => s.status === "changes_requested")).toHaveLength(1);
  });

  it("gives approved shops branding, two locations and 10+ live products with full variants", () => {
    for (const key of ["harbor-pine", "maison-rue", "studio-ines"]) {
      const shopId = `shop-${key}`;
      const shop = merchants.docs.find((d) => d.path === `shops/${shopId}`)?.data;
      expect(shop).toMatchObject({ logo: expect.anything(), banner: expect.anything() });
      expect(docsUnder(`shops/${shopId}/locations/`)).toHaveLength(2);
      const live = merchants.products.filter((p) => p.shopId === shopId);
      expect(live.length).toBeGreaterThanOrEqual(10);
      for (const p of live) {
        expect(p.status).toBe("live");
        const skus = merchants.variants.filter((v) => v.productId === p.id);
        // Every colour × fit × size is made: 3 colours × 2 fits × 6 sizes.
        expect(skus).toHaveLength(36);
      }
    }
  });

  it("never reuses a catalog product slug or SKU", () => {
    const slugs = new Set(data.products.map((p) => p.slug));
    for (const p of merchants.products) expect(slugs.has(p.slug)).toBe(false);
    const skus = new Set(data.variants.map((v) => v.sku));
    const merchantSkus = merchants.variants.map((v) => v.sku);
    expect(new Set(merchantSkus).size).toBe(merchantSkus.length);
    for (const sku of merchantSkus) expect(skus.has(sku)).toBe(false);
  });

  it("records a media document for every image a draft or shop uses", () => {
    const media = new Set(docsUnder("merchantMedia/").map((d) => d.path.split("/")[1]));
    const drafts = docsUnder("productDrafts/").map(
      (d) => d.data as { data: { colors: Array<{ images: Array<{ mediaId: string }> }> } },
    );
    for (const draft of drafts)
      for (const c of draft.data.colors)
        for (const i of c.images) expect(media.has(i.mediaId)).toBe(true);
  });

  it("brings the plus fit to the storefront through a merchant", () => {
    expect(merchants.variants.some((v) => v.fitFamily === "plus")).toBe(true);
  });
});
