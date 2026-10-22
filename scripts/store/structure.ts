// The real store's structure: category tree, default settings and the
// collections the menu links to. Used by the live-project setup
// (scripts/bootstrap.ts) and by the test fixtures, so both describe the same store.
import {
  categorySchema,
  collectionSchema,
  storeSettingsSchema,
  type Category,
  type Collection,
  type Product,
  type StoreSettings,
} from "../../src/lib/validation";
import { CATEGORIES } from "./catalog-definitions";

const cents = (dollars: number) => Math.round(dollars * 100);

/** The category tree: two departments and their leaf categories. Shared with the live-project setup. */
export function buildCategories(): Category[] {
  const categories: Category[] = [];
  const departments = ["women", "men"] as const;
  departments.forEach((department, i) => {
    categories.push(
      categorySchema.parse({
        id: department,
        slug: department,
        name: department === "women" ? "Women" : "Men",
        department,
        parentId: null,
        path: [department],
        sortOrder: i,
        sizeType: "alpha",
        facets: ["material"],
        merchRules: { pinned: [], boosted: [], buried: [], defaultSort: "featured" },
        status: "live",
        seo: { title: department === "women" ? "Women's clothing" : "Men's clothing" },
      }),
    );
  });

  CATEGORIES.forEach((def, i) => {
    categories.push(
      categorySchema.parse({
        id: `${def.department}-${def.slug}`,
        slug: def.slug,
        name: def.name,
        department: def.department,
        parentId: def.department,
        path: [def.department, def.slug],
        sortOrder: i,
        sizeType: def.sizeType,
        facets: [...Object.keys(def.attributes), "material"],
        merchRules: { pinned: [], boosted: [], buried: [], defaultSort: "featured" },
        status: "live",
        seo: {
          title: `${def.department === "women" ? "Women's" : "Men's"} ${def.name.toLowerCase()}`,
        },
      }),
    );
  });
  return categories;
}

/** Default store settings. Shared with the live-project setup. */
export function buildStoreSettings(now: Date): StoreSettings {
  const settings = storeSettingsSchema.parse({
    currency: "USD",
    freeShippingThreshold: cents(150),
    shippingRates: { standard: cents(8), express: cents(20) },
    refundLimits: { customer_service: cents(250) },
    reservationMinutes: 15,
    loyalty: {
      pointsPerCurrencyUnit: 10,
      tierThresholds: { enthusiast: cents(500), icon: cents(1500) },
      birthdayRewardPoints: 500,
    },
    features: {
      vendorMarketplace: true,
      quickView: false,
      cashOnDelivery: true,
      expressPay: false,
    },
    updatedAt: now,
  });
  return settings;
}

/**
 * The storefront's collections (linked from the menu and promotions). The
 * seed fills them from the catalog; the live-store setup creates them empty.
 */
export function buildCollections(live: readonly Product[]): Collection[] {
  return [
    {
      id: "the-linen-edit",
      slug: "the-linen-edit",
      name: "The Linen Edit",
      description: "Breathable, easy pieces in washed linen for warm days and long evenings.",
      productIds: live.filter((p) => p.attributes.material === "linen").map((p) => p.id),
    },
    {
      id: "new-arrivals",
      slug: "new-arrivals",
      name: "New Arrivals",
      description: "The latest additions to the collection.",
      productIds: [...live]
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 24)
        .map((p) => p.id),
    },
    {
      id: "knitwear",
      slug: "knitwear",
      name: "Considered Knitwear",
      description: "Merino, cashmere and lambswool sweaters made to be worn for years.",
      productIds: live.filter((p) => p.categoryPath[1] === "sweaters").map((p) => p.id),
    },
  ].map((c) => collectionSchema.parse({ ...c, status: "live", seo: { title: c.name } }));
}
