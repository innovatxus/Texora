import { describe, expect, it } from "vitest";
import { getStoreSettings, getUserProfile, listAuditLogs } from "@/lib/data/admin-records";
import {
  getLiveCategoryByPath,
  getLiveCollectionBySlug,
  listLiveCategories,
  listStores,
} from "@/lib/data/catalog-structure";
import {
  getLiveProductBySlug,
  getProductById,
  getVariantsForProduct,
  listLiveProducts,
  type ProductSort,
} from "@/lib/data/products";
import { listApprovedReviews, listPendingReviews } from "@/lib/data/reviews";
import { generateSeed } from "../../scripts/seed/generate";

// The same deterministic data global-setup wrote (ids and statuses do not depend on the clock).
const seed = generateSeed();

describe("product repository", () => {
  it("lists only live products in the exact category, across every page", async () => {
    const expected = seed.products
      .filter((p) => p.status === "live" && p.categoryPath.join("/") === "men/jeans")
      .map((p) => p.id)
      .sort();

    const seen: string[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const page = await listLiveProducts({
        categoryPath: ["men", "jeans"],
        sort: "featured",
        limit: 4,
        cursor,
      });
      seen.push(...page.items.map((p) => p.id));
      cursor = page.nextCursor;
      pages += 1;
    } while (cursor && pages < 20);

    expect(seen.sort()).toEqual(expected);
    expect(new Set(seen).size).toBe(seen.length);
    expect(pages).toBeGreaterThan(1);
  });

  it("does not mix departments that share a category slug", async () => {
    const page = await listLiveProducts({
      categoryPath: ["women", "jeans"],
      sort: "newest",
      limit: 50,
    });
    expect(page.items.length).toBeGreaterThan(0);
    expect(page.items.every((p) => p.department === "women")).toBe(true);
  });

  it("lists a whole department from its root path", async () => {
    const page = await listLiveProducts({ categoryPath: ["women"], sort: "featured", limit: 200 });
    // Texora's catalog plus the seed merchants' live products.
    const expected = [...seed.products, ...seed.merchants.products].filter(
      (p) => p.status === "live" && p.department === "women",
    ).length;
    expect(page.items).toHaveLength(expected);
  });

  it.each<
    [
      ProductSort,
      (a: number, b: number) => boolean,
      (p: { priceRange: { min: number }; ratingAvg: number; salesRank: number }) => number,
    ]
  >([
    ["price_asc", (a, b) => a <= b, (p) => p.priceRange.min],
    ["price_desc", (a, b) => a >= b, (p) => p.priceRange.min],
    ["top_rated", (a, b) => a >= b, (p) => p.ratingAvg],
    ["best_sellers", (a, b) => a <= b, (p) => p.salesRank],
  ])("sorts by %s", async (sort, ordered, value) => {
    const page = await listLiveProducts({ categoryPath: ["women", "dresses"], sort, limit: 50 });
    const values = page.items.map(value);
    for (let i = 1; i < values.length; i++)
      expect(ordered(values[i - 1] ?? 0, values[i] ?? 0)).toBe(true);
  });

  it("finds a live product by slug but hides drafts", async () => {
    const live = seed.products.find((p) => p.status === "live");
    const draft = seed.products.find((p) => p.status === "draft");
    expect(live && draft).toBeTruthy();
    expect((await getLiveProductBySlug(live?.slug ?? ""))?.id).toBe(live?.id);
    expect(await getLiveProductBySlug(draft?.slug ?? "")).toBeNull();
    // Direct id reads are for staff tooling and do return drafts.
    expect((await getProductById(draft?.id ?? ""))?.status).toBe("draft");
  });

  it("parses timestamps back into Dates", async () => {
    const product = await getProductById(seed.products[0]?.id ?? "");
    expect(product?.createdAt).toBeInstanceOf(Date);
  });

  it("returns every variant of a product", async () => {
    const product = seed.products[0];
    const variants = await getVariantsForProduct(product?.id ?? "");
    expect(variants).toHaveLength(seed.variants.filter((v) => v.productId === product?.id).length);
    expect(variants[0]?.sku).toMatch(/^[A-Z0-9-]+$/);
  });
});

describe("catalog structure", () => {
  it("lists a department's categories in sort order", async () => {
    const categories = await listLiveCategories("men");
    expect(categories.map((c) => c.slug)).toEqual([
      "men",
      "shirts",
      "tees-polos",
      "sweaters",
      "pants",
      "jeans",
      "outerwear",
    ]);
  });

  it("resolves a category by its full path", async () => {
    expect((await getLiveCategoryByPath(["women", "jeans"]))?.department).toBe("women");
    expect(await getLiveCategoryByPath(["women", "tees-polos"])).toBeNull();
  });

  it("reads collections and stores", async () => {
    expect((await getLiveCollectionBySlug("the-linen-edit"))?.productIds.length).toBeGreaterThan(0);
    expect((await listStores()).map((s) => s.id).sort()).toEqual(["austin", "chicago", "soho"]);
  });
});

describe("reviews", () => {
  it("returns approved reviews only, newest first", async () => {
    const product = seed.products.find((p) => p.ratingCount >= 3);
    const page = await listApprovedReviews(product?.id ?? "", { sort: "newest", limit: 50 });
    expect(page.items).toHaveLength(product?.ratingCount ?? -1);
    expect(page.items.every((r) => r.status === "approved")).toBe(true);
    const times = page.items.map((r) => r.createdAt.getTime());
    expect([...times].sort((a, b) => b - a)).toEqual(times);
  });

  it("queues pending reviews for moderation", async () => {
    const page = await listPendingReviews({ limit: 100 });
    expect(page.items.length).toBe(seed.reviews.filter((r) => r.status === "pending").length);
  });
});

describe("admin records", () => {
  it("reads store settings and user profiles", async () => {
    expect((await getStoreSettings()).refundLimits.customer_service).toBe(25000);
    expect((await getUserProfile("seed-admin"))?.role).toBe("admin");
  });

  it("starts with an empty audit log", async () => {
    const page = await listAuditLogs({ action: "never.happened", limit: 10 });
    expect(page.items).toEqual([]);
  });
});
