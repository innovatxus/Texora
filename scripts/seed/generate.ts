// Deterministic seed generator. Pure: no I/O, so it is unit tested.
// Every document is validated against its Zod schema before it is returned.
import { createHash } from "node:crypto";
import type { CmsPage } from "../../src/lib/cms/modules";
import { ROLES, type Role } from "../../src/lib/auth/rbac";
import {
  BADGE_PRIORITY,
  categoryKeysFor,
  categorySchema,
  collectionSchema,
  giftCardSchema,
  ONLINE_LOCATION,
  orderSchema,
  productSchema,
  promoCodeSchema,
  promotionSchema,
  returnSchema,
  reviewSchema,
  storeSchema,
  storeSettingsSchema,
  userSchema,
  variantSchema,
  type Category,
  type Collection,
  type FitFamily,
  type GiftCard,
  type Order,
  type OrderLine,
  type Product,
  type ProductBadge,
  type PromoCode,
  type Promotion,
  type Return,
  type Review,
  type Store,
  type StoreSettings,
  type User,
  type Variant,
} from "../../src/lib/validation";
import {
  CATEGORIES,
  COLORS,
  FIRST_NAMES,
  LAST_INITIALS,
  MEN_INSEAMS,
  MEN_WAISTS,
  REVIEW_SNIPPETS,
  STORES,
  type CategoryDefinition,
} from "./catalog-definitions";
import { taxRateFor } from "../../src/lib/pricing/tax";
import { buildPages } from "./pages";

// ------------------------------------------------------------------ rng

export type Rng = () => number;

/** mulberry32: small, fast, deterministic. */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const int = (rng: Rng, min: number, max: number) => Math.floor(rng() * (max - min + 1)) + min;
const chance = (rng: Rng, p: number) => rng() < p;
function pick<T>(rng: Rng, items: readonly T[]): T {
  const item = items[Math.floor(rng() * items.length)];
  if (item === undefined) throw new Error("pick() on an empty list");
  return item;
}
function sample<T>(rng: Rng, items: readonly T[], count: number): T[] {
  const pool = [...items];
  const out: T[] = [];
  while (out.length < count && pool.length > 0) {
    out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0] as T);
  }
  return out;
}

const DAY = 24 * 60 * 60 * 1000;
const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
const cents = (dollars: number) => Math.round(dollars * 100);
/** Prices end in .00 for a considered, non-discount look. */
const roundPrice = (dollars: number) => Math.max(18, Math.round(dollars / 2) * 2);

// --------------------------------------------------------------- output

export interface SeedAuthUser {
  uid: string;
  email: string;
  password: string;
  displayName: string;
  claims: Record<string, unknown>;
}

export interface SeedData {
  categories: Category[];
  products: Product[];
  variants: Variant[];
  stores: Store[];
  reviews: Review[];
  authUsers: SeedAuthUser[];
  profiles: User[];
  promotions: Promotion[];
  promoCodes: PromoCode[];
  giftCards: GiftCard[];
  orders: Order[];
  returns: Return[];
  /** Last order number used by the seed; new orders continue from here. */
  orderCounter: number;
  collections: Collection[];
  pages: CmsPage[];
  settings: StoreSettings;
  /** Plain gift card code for local testing (only its hash is stored). */
  demoGiftCardCode: string;
  /** Email on the sample guest orders, for order lookup. */
  demoOrderEmail: string;
}

/** Password for every seeded account (local emulators only). */
export const SEED_PASSWORD = "Texora-demo-1";
/** Marketplace vendor that the seeded vendor user belongs to. */
export const VENDOR_ID = "atelier-north";

function sizesFor(def: CategoryDefinition, fit: FitFamily): string[] {
  if (def.sizeRun !== "men-waist-inseam") return [...def.sizeRun];
  const inseams = MEN_INSEAMS[fit === "tall" ? "tall" : "regular"];
  return MEN_WAISTS.flatMap((w) => inseams.map((l) => `${w}x${l}`));
}

function imagesFor(garment: string, colorCode: string, alt: string) {
  return (["model", "flat", "detail"] as const).map((view) => ({
    url: `/media/placeholders/${garment}-${colorCode}-${view}.svg`,
    alt: `${alt}, ${view === "model" ? "front view" : view === "flat" ? "flat lay" : "fabric detail"}`,
    width: 1200,
    height: 1600,
  }));
}

function describe(def: CategoryDefinition, name: string, attrs: Record<string, string>): string {
  const material = attrs.material ?? def.materials[0] ?? "cotton";
  const details = Object.entries(attrs)
    .filter(([key]) => key !== "material")
    .map(([key, value]) => `${value} ${key}`)
    .join(", ");
  return (
    `The ${name.toLowerCase()} is cut from ${material} chosen for how it wears over time. ` +
    `It has a considered silhouette${details ? ` with a ${details}` : ""}, ` +
    `finished with clean seams and tonal details so it pairs easily with the rest of your wardrobe.`
  );
}

/** Builds the complete, schema-validated seed data set. Deterministic for a given seed number and date. */
export function generateSeed(options: { seed?: number; now?: Date } = {}): SeedData {
  const rng = createRng(options.seed ?? 20261019);
  const now = options.now ?? new Date();
  const ago = (days: number) => new Date(now.getTime() - days * DAY);
  const storeIds = STORES.map((s) => s.id);

  // ----------------------------------------------------------- stores
  const stores: Store[] = STORES.map((s) =>
    storeSchema.parse({
      id: s.id,
      slug: s.id,
      name: s.name,
      address: s.address,
      geo: s.geo,
      phone: s.phone,
      timezone: s.timezone,
      hours: [0, 1, 2, 3, 4, 5, 6].map((day) => ({
        day,
        open: day === 0 ? "11:00" : "10:00",
        close: day === 0 ? "18:00" : day === 5 || day === 6 ? "21:00" : "20:00",
      })),
      services:
        s.id === "soho" ? ["returns", "alterations", "styling"] : ["returns", "alterations"],
      status: "open",
    }),
  );

  // ------------------------------------------------------- categories
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

  // -------------------------------------------------- products/variants
  const products: Product[] = [];
  const variants: Variant[] = [];
  let styleNumber = 100;

  for (const def of CATEGORIES) {
    for (const [name, attrs] of def.products) {
      styleNumber += 1;
      const id = `${def.department.charAt(0)}${styleNumber}`;
      const slug = `${slugify(name)}-${def.department}`;
      const createdAt = ago(int(rng, 2, 200));
      const isNew = now.getTime() - createdAt.getTime() < 30 * DAY;
      const onSale = chance(rng, 0.22);
      const finalSale = onSale && chance(rng, 0.3);
      const onlineExclusive = !onSale && chance(rng, 0.1);
      const backInStock = chance(rng, 0.05);
      const isVendorProduct =
        def.department === "women" && def.slug === "sweaters" && chance(rng, 0.25);

      const basePrice = roundPrice(def.basePrice * (0.8 + rng() * 0.5));
      const salePrice = onSale ? roundPrice(basePrice * pick(rng, [0.6, 0.7, 0.75, 0.8])) : null;

      const colorCount = int(rng, 2, 5);
      const colors = sample(
        rng,
        def.slug === "jeans"
          ? COLORS.filter((c) => ["blue", "black", "white", "grey"].includes(c.family))
          : COLORS,
        colorCount,
      );
      const fitFamilies = def.fitFamilies.filter((f, idx) => idx === 0 || chance(rng, 0.7));

      let anyLow = false;
      for (const color of colors) {
        for (const fit of fitFamilies) {
          for (const size of sizesFor(def, fit)) {
            const sku = `${id}-${color.code}-${fit.charAt(0)}-${size}`.toUpperCase();
            const stockByLocation: Record<string, number> = {
              [ONLINE_LOCATION]: chance(rng, 0.08) ? 0 : int(rng, 1, 40),
            };
            for (const storeId of storeIds) {
              stockByLocation[storeId] = onlineExclusive || chance(rng, 0.35) ? 0 : int(rng, 0, 6);
            }
            const online = stockByLocation[ONLINE_LOCATION] ?? 0;
            if (online > 0 && online <= 3) anyLow = true;
            variants.push(
              variantSchema.parse({
                sku,
                productId: id,
                color: color.code,
                fitFamily: fit,
                size,
                price: cents(salePrice ?? basePrice),
                ...(salePrice ? { compareAtPrice: cents(basePrice) } : {}),
                barcode: String(4006381333931 + variants.length).padStart(13, "0"),
                weightGrams: int(rng, 180, 1400),
                stockByLocation,
                availableOnline: online > 0,
                backorder: false,
                lowStockThreshold: 3,
                ...(isVendorProduct ? { vendorId: VENDOR_ID } : {}),
                updatedAt: now,
              }),
            );
          }
        }
      }

      const flags: Record<ProductBadge, boolean> = {
        sale: onSale,
        final_sale: finalSale,
        low_stock: anyLow && chance(rng, 0.35),
        back_in_stock: backInStock,
        online_exclusive: onlineExclusive,
        new: isNew,
      };
      const badges = BADGE_PRIORITY.filter((b) => flags[b]);
      const material = attrs.material ?? "";

      products.push(
        productSchema.parse({
          id,
          styleId: `TX${styleNumber}`,
          slug,
          name,
          description: describe(def, name, attrs),
          department: def.department,
          categoryPath: [def.department, def.slug],
          categoryKeys: categoryKeysFor([def.department, def.slug]),
          attributes: { ...attrs, material },
          fitFamilies,
          sizeType: def.sizeType,
          colors: colors.map((c) => ({
            code: c.code,
            name: c.name,
            family: c.family,
            swatch: c.hex,
            images: imagesFor(def.garment, c.code, `${name} in ${c.name}`),
          })),
          priceRange: {
            min: cents(salePrice ?? basePrice),
            max: cents(salePrice ?? basePrice),
            ...(salePrice
              ? { compareAtMin: cents(basePrice), compareAtMax: cents(basePrice) }
              : {}),
          },
          badges,
          ratingAvg: 0,
          ratingCount: 0,
          details: {
            fitNotes:
              def.department === "women"
                ? "Model is 5'10\" and wears a size S in Regular."
                : "Model is 6'1\" and wears a size M in Regular.",
            modelInfo: `Shown in ${colors[0]?.name ?? "the first colour"}.`,
            fabricCare: [`100% ${material}`, ...def.care],
          },
          completeTheLook: [],
          salesRank: 0,
          status: "live",
          seo: { title: `${name} | ${def.department === "women" ? "Women" : "Men"}` },
          searchKeywords: [
            ...new Set([...name.toLowerCase().split(/[\s-]+/), def.slug, material, def.department]),
          ],
          ...(isVendorProduct ? { vendorId: VENDOR_ID } : {}),
          createdAt,
          updatedAt: now,
        }),
      );
    }
  }

  // Best sellers: a stable shuffle of ranks.
  sample(rng, products, products.length).forEach((p, i) => {
    p.salesRank = i + 1;
  });

  // A few drafts so draft visibility can be exercised.
  for (const p of sample(rng, products, 4)) p.status = "draft";

  // Complete the look: pair each product with items from other categories in its department.
  for (const p of products) {
    const partners = products.filter(
      (o) =>
        o.department === p.department &&
        o.categoryPath[1] !== p.categoryPath[1] &&
        o.status === "live",
    );
    p.completeTheLook = sample(rng, partners, 3).map((o) => o.id);
  }

  // ------------------------------------------------------------ users
  const authUsers: SeedAuthUser[] = [];
  const profiles: User[] = [];

  const addUser = (
    uid: string,
    email: string,
    role: Role,
    firstName: string,
    lastName: string,
    extra: Partial<User> = {},
  ) => {
    authUsers.push({
      uid,
      email,
      password: SEED_PASSWORD,
      displayName: `${firstName} ${lastName}`.trim(),
      claims:
        role === "customer" ? {} : { role, ...(role === "vendor" ? { vendorId: VENDOR_ID } : {}) },
    });
    profiles.push(
      userSchema.parse({
        uid,
        email,
        firstName,
        lastName,
        role,
        preferences: { marketingEmail: chance(rng, 0.5), marketingSms: false },
        savedSizes: {},
        disabled: false,
        createdAt: ago(int(rng, 30, 700)),
        updatedAt: now,
        ...(role === "vendor" ? { vendorId: VENDOR_ID } : {}),
        ...extra,
      }),
    );
  };

  for (const role of ROLES) {
    if (role === "guest") continue;
    const label = role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    addUser(`seed-${role}`, `${role.replace(/_/g, "-")}@texora.test`, role, label, "Demo", {
      ...(role === "loyalty_member"
        ? {
            loyalty: {
              tier: "enthusiast",
              points: 2350,
              periodSpend: cents(640),
              memberSince: ago(400),
            },
          }
        : {}),
      ...(role === "customer"
        ? {
            preferences: { fitFamily: "petite", marketingEmail: true, marketingSms: false },
            savedSizes: { alpha: "S", numeric: "4" },
          }
        : {}),
    });
  }

  const shoppers: string[] = [];
  for (let i = 1; i <= 20; i++) {
    const uid = `seed-shopper-${String(i).padStart(2, "0")}`;
    const firstName = FIRST_NAMES[(i - 1) % FIRST_NAMES.length] ?? "Alex";
    const lastInitial = pick(rng, LAST_INITIALS);
    const member = chance(rng, 0.6);
    addUser(
      uid,
      `shopper${i}@texora.test`,
      member ? "loyalty_member" : "customer",
      firstName,
      `${lastInitial}.`,
      {
        ...(member
          ? {
              loyalty: {
                tier: pick(rng, ["core", "core", "enthusiast", "icon"] as const),
                points: int(rng, 0, 6000),
                periodSpend: cents(int(rng, 0, 1500)),
                memberSince: ago(int(rng, 30, 900)),
              },
            }
          : {}),
      },
    );
    shoppers.push(uid);
  }

  // ---------------------------------------------------------- reviews
  const reviews: Review[] = [];
  for (const p of products) {
    if (p.status !== "live") continue;
    const count = int(rng, 0, 14);
    const reviewers = sample(rng, shoppers, count);
    const ratings: number[] = [];
    const fits: number[] = [];
    reviewers.forEach((uid, i) => {
      const roll = rng();
      const rating = roll < 0.55 ? 5 : roll < 0.82 ? 4 : roll < 0.92 ? 3 : roll < 0.97 ? 2 : 1;
      const [title, body] =
        rating >= 4
          ? pick(rng, REVIEW_SNIPPETS.positive)
          : rating === 3
            ? pick(rng, REVIEW_SNIPPETS.mixed)
            : pick(rng, REVIEW_SNIPPETS.negative);
      const fit = pick(rng, [-1, 0, 0, 0, 0, 1, 1, -2, 2]);
      const status = i === 0 && chance(rng, 0.15) ? "pending" : "approved";
      const profile = profiles.find((u) => u.uid === uid);
      reviews.push(
        reviewSchema.parse({
          id: `${p.id}-r${i + 1}`,
          productId: p.id,
          userId: uid,
          displayName: profile ? `${profile.firstName} ${profile.lastName}` : "Texora customer",
          rating,
          title,
          body,
          fit,
          fitFamily: pick(rng, p.fitFamilies),
          photos: [],
          verifiedPurchase: chance(rng, 0.8),
          helpfulCount: int(rng, 0, 40),
          status,
          createdAt: ago(int(rng, 1, 360)),
        }),
      );
      if (status === "approved") {
        ratings.push(rating);
        fits.push(fit);
      }
    });
    if (ratings.length > 0) {
      p.ratingAvg = Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10;
      p.ratingCount = ratings.length;
      p.fitScore = Math.round((fits.reduce((a, b) => a + b, 0) / fits.length / 2) * 100) / 100;
    }
  }

  // ------------------------------------------------------- promotions
  const always = { startsAt: ago(30), endsAt: new Date(now.getTime() + 180 * DAY) };
  const promotions: Promotion[] = [
    {
      id: "welcome-15",
      name: "15% off your first order",
      type: "percent",
      value: 15,
      conditions: { excludeSale: true },
      automatic: false,
      stackable: false,
      priority: 10,
      audience: "everyone",
      schedule: always,
      active: true,
    },
    {
      id: "member-free-shipping",
      name: "Free express shipping for Icon members",
      type: "free_shipping",
      value: 0,
      conditions: {},
      automatic: true,
      stackable: true,
      priority: 50,
      audience: "icon",
      schedule: always,
      active: true,
    },
    {
      id: "spend-and-save",
      name: "Spend more, save more",
      type: "tiered",
      value: 0,
      tiers: [
        { minSubtotal: cents(200), value: cents(25) },
        { minSubtotal: cents(350), value: cents(60) },
      ],
      conditions: {},
      automatic: false,
      stackable: false,
      priority: 20,
      audience: "everyone",
      schedule: always,
      active: true,
    },
    {
      id: "denim-bogo",
      name: "Buy one, get one 50% off denim",
      type: "bogo",
      value: 50,
      conditions: { categoryKeys: ["women/jeans", "men/jeans"], excludeSale: true },
      automatic: true,
      stackable: false,
      priority: 30,
      audience: "everyone",
      schedule: always,
      active: true,
    },
  ].map((p) => promotionSchema.parse(p));

  const promoCodes: PromoCode[] = [
    {
      code: "WELCOME15",
      promotionId: "welcome-15",
      perCustomerLimit: 1,
      usedCount: 0,
      active: true,
    },
    {
      code: "SPEND200",
      promotionId: "spend-and-save",
      usageLimit: 5000,
      usedCount: 312,
      active: true,
    },
    { code: "EXPIRED10", promotionId: "welcome-15", usedCount: 0, active: false },
  ].map((c) => promoCodeSchema.parse(c));

  const demoGiftCardCode = "TXGC-DEMO-2026-0001";
  const giftCards: GiftCard[] = [
    giftCardSchema.parse({
      id: createHash("sha256").update(demoGiftCardCode).digest("hex"),
      last4: demoGiftCardCode.slice(-4),
      currency: "USD",
      initialBalance: cents(100),
      balance: cents(100),
      status: "active",
      createdAt: ago(10),
    }),
  ];

  // ------------------------------------------------------ collections
  const live = products.filter((p) => p.status === "live");
  const collections: Collection[] = [
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

  // ----------------------------------------------------------- orders
  // Sample order history for order lookup, tracking and returns demos.
  const demoOrderEmail = "guest@texora.test";
  const productById = new Map(products.map((p) => [p.id, p]));
  const orderable = variants.filter((v) => {
    const p = productById.get(v.productId);
    return p?.status === "live" && !p.badges.includes("final_sale");
  });
  const finalSaleVariant = variants.find(
    (v) => productById.get(v.productId)?.badges.includes("final_sale") ?? false,
  );
  const orderLine = (v: Variant, quantity: number): OrderLine => {
    const p = productById.get(v.productId) as Product;
    const color = p.colors.find((c) => c.code === v.color) ?? p.colors[0];
    return {
      sku: v.sku,
      productId: p.id,
      name: p.name,
      colorName: color?.name ?? v.color,
      size: v.size,
      fitFamily: v.fitFamily,
      imageUrl: color?.images[0]?.url ?? "",
      unitPrice: v.price,
      ...(v.compareAtPrice ? { compareAtPrice: v.compareAtPrice } : {}),
      quantity,
      discount: 0,
      lineTotal: v.price * quantity,
      finalSale: p.badges.includes("final_sale"),
    };
  };
  const orderVariant = (i: number) => orderable[(i * 37) % orderable.length] as Variant;
  const demoAddress = {
    firstName: "Ada",
    lastName: "Lovelace",
    line1: "118 Greene Street",
    city: "New York",
    region: "NY",
    postalCode: "10012",
    country: "US",
    phone: "212 555 0100",
  };
  let orderNumber = 100_000;
  const makeOrder = (spec: {
    id: string;
    email: string;
    userId: string | null;
    lines: OrderLine[];
    status: Order["status"];
    placedDaysAgo: number;
    shippedDaysAgo?: number;
    deliveredDaysAgo?: number;
  }): Order => {
    orderNumber += 1;
    const subtotal = spec.lines.reduce((sum, l) => sum + l.lineTotal, 0);
    const shipping = subtotal >= cents(150) ? 0 : cents(8);
    const tax = Math.round(subtotal * taxRateFor(demoAddress.region));
    const total = subtotal + shipping + tax;
    const placedAt = ago(spec.placedDaysAgo);
    const shipped = spec.shippedDaysAgo !== undefined;
    const delivered = spec.deliveredDaysAgo !== undefined;
    const history: Order["statusHistory"] = [{ status: "placed", at: placedAt }];
    if (spec.status !== "placed") {
      history.push({ status: "processing", at: ago(spec.placedDaysAgo - 0.2) });
    }
    if (shipped) history.push({ status: "shipped", at: ago(spec.shippedDaysAgo ?? 0) });
    if (delivered) history.push({ status: "delivered", at: ago(spec.deliveredDaysAgo ?? 0) });
    const number = `TX-${orderNumber}`;
    return orderSchema.parse({
      id: spec.id,
      vendorIds: [],
      number,
      userId: spec.userId,
      email: spec.email,
      status: spec.status,
      currency: "USD",
      lines: spec.lines,
      totals: { subtotal, discount: 0, shipping, tax, giftCard: 0, rewards: 0, total },
      shippingAddress: demoAddress,
      billingAddress: demoAddress,
      delivery: {
        method: "standard",
        cost: shipping,
        estimatedFrom: ago(spec.placedDaysAgo - 3),
        estimatedTo: ago(spec.placedDaysAgo - 5),
      },
      promoCodes: [],
      payments: [
        { provider: "cod", ref: number, amount: total, status: delivered ? "captured" : "pending" },
      ],
      shipments: shipped
        ? [
            {
              id: `${spec.id}-s1`,
              carrier: "UPS Ground",
              trackingNumber: `1Z999AA1${String(orderNumber).padStart(10, "0")}`,
              skus: spec.lines.map((l) => l.sku),
              status: delivered ? "delivered" : "in_transit",
              shippedAt: ago(spec.shippedDaysAgo ?? 0),
              ...(delivered ? { deliveredAt: ago(spec.deliveredDaysAgo ?? 0) } : {}),
            },
          ]
        : [],
      refunds: [],
      statusHistory: history,
      notes: [],
      idempotencyKey: `seed-order-${spec.id}-0000`,
      loyaltyPointsEarned: 0,
      placedAt,
      updatedAt: now,
    });
  };

  const orders: Order[] = [
    makeOrder({
      id: "seed-order-delivered",
      email: demoOrderEmail,
      userId: null,
      lines: [
        orderLine(orderVariant(1), 2),
        orderLine(orderVariant(2), 1),
        ...(finalSaleVariant ? [orderLine(finalSaleVariant, 1)] : []),
      ],
      status: "delivered",
      placedDaysAgo: 9,
      shippedDaysAgo: 8,
      deliveredDaysAgo: 5,
    }),
    makeOrder({
      id: "seed-order-shipped",
      email: demoOrderEmail,
      userId: null,
      lines: [orderLine(orderVariant(3), 1)],
      status: "shipped",
      placedDaysAgo: 2,
      shippedDaysAgo: 1,
    }),
    makeOrder({
      id: "seed-order-placed",
      email: demoOrderEmail,
      userId: null,
      lines: [orderLine(orderVariant(4), 1), orderLine(orderVariant(5), 1)],
      status: "placed",
      placedDaysAgo: 0.1,
    }),
    makeOrder({
      id: "seed-order-member",
      email: "customer@texora.test",
      userId: "seed-customer",
      lines: [orderLine(orderVariant(6), 1), orderLine(orderVariant(7), 1)],
      status: "delivered",
      placedDaysAgo: 14,
      shippedDaysAgo: 13,
      deliveredDaysAgo: 10,
    }),
  ];
  const memberOrder = orders[3] as Order;
  const returns: Return[] = [
    returnSchema.parse({
      id: `${memberOrder.id}-r1`,
      number: `${memberOrder.number}-R1`,
      orderId: memberOrder.id,
      orderNumber: memberOrder.number,
      userId: memberOrder.userId,
      email: memberOrder.email,
      lines: [{ sku: memberOrder.lines[0]?.sku, quantity: 1, reason: "too_large" }],
      method: "mail",
      refundTo: "original",
      status: "approved",
      label: {
        carrier: "Prepaid return",
        trackingNumber: "TXR1000000001",
        code: `${memberOrder.number}-R1`,
      },
      refundEstimate: memberOrder.lines[0]?.lineTotal ?? 0,
      statusHistory: [
        { status: "requested", at: ago(2) },
        { status: "approved", at: ago(2) },
      ],
      createdAt: ago(2),
    }),
  ];
  const orderCounter = orderNumber;

  // --------------------------------------------------------- settings
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
      vendorMarketplace: false,
      quickView: false,
      cashOnDelivery: true,
      expressPay: false,
    },
    updatedAt: now,
  });

  const pages = buildPages(products, now);

  return {
    pages,
    categories,
    products,
    variants,
    stores,
    reviews,
    authUsers,
    profiles,
    promotions,
    promoCodes,
    giftCards,
    orders,
    returns,
    orderCounter,
    collections,
    settings,
    demoGiftCardCode,
    demoOrderEmail,
  };
}
