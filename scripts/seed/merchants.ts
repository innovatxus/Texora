// Builds the seed merchants (see merchant-definitions) as schema-validated
// documents. Products go through the same pure code the portal uses: the
// variant matrix, the publish checks and the storefront document builder, so
// seeded products look exactly like ones a merchant published.
import { createHash } from "node:crypto";
import { productConfigFor } from "../../src/config/product-attributes";
import { counterDelta, summarize } from "../../src/lib/merchant/drafts";
import { colorCode, suggestAlt, suggestStyleId } from "../../src/lib/merchant/editor";
import { chooseSlug, toStorefrontDocs } from "../../src/lib/merchant/publishing/storefront-docs";
import { publishProblems } from "../../src/lib/merchant/publishing/validate";
import { buildMatrix } from "../../src/lib/merchant/variants/matrix";
import type { Product, Variant } from "../../src/lib/validation/catalog";
import { userSchema, type User } from "../../src/lib/validation/customer";
import {
  EMPTY_SHOP_COUNTERS,
  merchantLocationSchema,
  merchantMediaSchema,
  merchantSchema,
  productDraftDataSchema,
  productDraftSchema,
  shopSchema,
  shopSlugLockSchema,
  usernameLockSchema,
  type DraftColor,
  type ProductDraftData,
  type Shop,
} from "../../src/lib/validation/merchant";
import { COLORS } from "./catalog-definitions";
import type { SeedAuthUser } from "./generate";
import { SEED_MERCHANTS, type SeedMerchant } from "./merchant-definitions";

/** A document to write: its path and data (ids live in the path, not the data). */
export interface SeedDoc {
  path: string;
  data: Record<string, unknown>;
}

export interface MerchantSeed {
  authUsers: SeedAuthUser[];
  profiles: User[];
  docs: SeedDoc[];
  products: Product[];
  variants: Variant[];
  /** One line per merchant, for the seed summary. */
  summary: string[];
}

const REVIEWER_UID = "seed-admin";

function strip<T extends { id?: unknown }>(doc: T): Record<string, unknown> {
  const { id: _id, ...rest } = doc;
  return rest;
}

/** A stable id from parts (Firestore-safe). */
function idFor(...parts: string[]): string {
  return createHash("sha1").update(parts.join("/")).digest("hex").slice(0, 20);
}

/** A tiny placeholder in the image's dominant colour (stands in for the real blur). */
function blurFor(hex: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="${hex}"/></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

const days = (now: Date, n: number) => new Date(now.getTime() - n * 86_400_000);

const WEEKDAY_HOURS = [1, 2, 3, 4, 5].map((day) => ({ day, open: "10:00", close: "19:00" }));
const RETAIL_HOURS = [
  ...WEEKDAY_HOURS,
  { day: 6, open: "10:00", close: "18:00" },
  { day: 0, open: "11:00", close: "17:00" },
];

function buildMerchant(def: SeedMerchant, index: number, now: Date, takenSlugs: Set<string>) {
  const vendorId = `seed-${def.key}`;
  const uid = `merchant-${def.key}`;
  const shopId = `shop-${def.key}`;
  const email = `${def.key}@merchants.texora.test`;
  const createdAt = days(now, 120 - index * 10);
  const docs: SeedDoc[] = [];
  const media: SeedDoc[] = [];

  const image = (
    kind: "logo" | "banner" | "productImage",
    url: string,
    alt: string,
    width: number,
    height: number,
    dominantColor: string,
  ) => {
    const mediaId = idFor(vendorId, url);
    media.push({
      path: `merchantMedia/${mediaId}`,
      data: strip(
        merchantMediaSchema.parse({
          id: mediaId,
          vendorId,
          shopId,
          ownerUid: uid,
          kind,
          // Seed media points at the drawn placeholders, not a Storage object.
          path: `seed${url}`,
          contentType: "image/svg+xml",
          width,
          height,
          bytes: 0,
          blurDataURL: blurFor(dominantColor),
          dominantColor,
          alt,
          status: "attached",
          createdAt,
          processedAt: createdAt,
        }),
      ),
    });
    return { mediaId, url, alt, width, height, blurDataURL: blurFor(dominantColor), dominantColor };
  };

  // ---- locations
  const locations = def.locations.map((l, i) =>
    merchantLocationSchema.parse({
      id: `loc-${i + 1}`,
      shopId,
      vendorId,
      name: l.name,
      types: l.types,
      address: {
        line1: l.line1,
        city: l.city,
        region: l.region,
        postalCode: l.postalCode,
        country: "US",
      },
      geo: l.geo,
      timezone: l.timezone,
      hours: l.types.includes("retail") ? RETAIL_HOURS : WEEKDAY_HOURS,
      specialHours: [
        { date: "2026-11-26", closed: true, note: "Thanksgiving" },
        { date: "2026-12-24", closed: false, open: "10:00", close: "15:00", note: "Christmas Eve" },
      ],
      phone: l.phone,
      isPrimary: i === 0,
      sortOrder: i,
      status: "active",
      createdAt,
      updatedAt: createdAt,
    }),
  );
  const shipFrom = locations.filter((l) => l.types.includes("ship_from")).map((l) => l.id);

  // ---- shop
  const approved = def.status === "approved";
  const logo = image(
    "logo",
    `/media/placeholders/shops/${def.shop.slug}-logo.svg`,
    `${def.shop.name} logo`,
    800,
    800,
    def.shop.palette.ground,
  );
  // The shop with changes requested was asked for a banner, so it has none yet.
  const banner =
    def.status === "changes_requested"
      ? undefined
      : image(
          "banner",
          `/media/placeholders/shops/${def.shop.slug}-banner.svg`,
          `${def.shop.name} banner`,
          2400,
          800,
          def.shop.palette.ground,
        );
  const submittedAt = days(now, 100 - index * 10);
  const reviewNotes = [
    { at: submittedAt, byUid: uid, decision: "submitted" as const, reasons: [] },
    ...(approved
      ? [
          {
            at: days(now, 98 - index * 10),
            byUid: REVIEWER_UID,
            decision: "approved" as const,
            reasons: [],
          },
        ]
      : []),
    ...(def.status === "changes_requested"
      ? [
          {
            at: days(now, 2),
            byUid: REVIEWER_UID,
            decision: "changes_requested" as const,
            reasons: [...(def.reasons ?? [])],
          },
        ]
      : []),
  ];
  const categoryKeys = [...new Set(def.lines.map((l) => l.categoryKey))];
  let shop: Shop = shopSchema.parse({
    id: shopId,
    vendorId,
    name: def.shop.name,
    slug: def.shop.slug,
    tagline: def.shop.tagline,
    description: def.shop.description,
    shopType: def.shop.shopType,
    departments: def.shop.departments,
    categoryKeys,
    logo,
    ...(banner ? { banner: { ...banner, focal: { x: 0.5, y: 0.5 } } } : {}),
    accent: def.shop.accent,
    contact: { email: `hello@${def.shop.slug}.example`, phone: def.locations[0]?.phone },
    social: { instagram: def.shop.instagram },
    returnPolicy:
      def.shop.returnWindow === null
        ? { mode: "platform" }
        : { mode: "custom", windowDays: def.shop.returnWindow },
    shipping: { shipsFromLocationId: shipFrom[0], processingTime: def.shop.processingTime },
    status: def.status,
    ...(def.status === "changes_requested" ? { statusReason: (def.reasons ?? []).join("\n") } : {}),
    reviewNotes,
    onboardingStep: "review",
    completedSteps: ["basics", "branding", "contact", "locations", "review"],
    counters: EMPTY_SHOP_COUNTERS,
    submittedAt,
    ...(approved ? { approvedAt: days(now, 98 - index * 10) } : {}),
    createdAt,
    updatedAt: now,
  });
  if (def.shop.website) shop = { ...shop, contact: { ...shop.contact, website: def.shop.website } };

  // ---- products
  const products: Product[] = [];
  const variants: Variant[] = [];
  let counters = { ...EMPTY_SHOP_COUNTERS };
  let sequence = 0;
  for (const line of def.lines) {
    const config = productConfigFor(line.categoryKey);
    if (!config) throw new Error(`Unknown category ${line.categoryKey}`);
    for (const [n, name] of line.names.entries()) {
      sequence++;
      const productId = `${shopId}-p${String(sequence).padStart(2, "0")}`;
      const codes: string[] = [];
      const colors: DraftColor[] = line.colors.map((code) => {
        const c = COLORS.find((x) => x.code === code);
        if (!c) throw new Error(`Unknown colour ${code}`);
        const ownCode = colorCode(c.name, codes);
        codes.push(ownCode);
        return {
          code: ownCode,
          name: c.name,
          family: c.family,
          swatch: c.hex,
          images: (["model", "flat", "detail"] as const).map((view, i) => ({
            ...image(
              "productImage",
              `/media/placeholders/${line.garment}-${c.code}-${view}.svg`,
              suggestAlt(name, c.name, i),
              1200,
              1600,
              c.hex,
            ),
            altConfirmed: true,
            focal: { x: 0.5, y: 0.4 },
          })),
        };
      });
      const fits = def.fits.filter((f) => config.fitFamilies.includes(f));
      const styleId = suggestStyleId(def.shop.slug, shopId, line.categoryKey, sequence);
      // A little variety: prices step up through a line, and one product in four is on sale.
      const price = (line.price + n * 10) * 100;
      const onSale = sequence % 4 === 0;
      const { rows } = buildMatrix(
        { colors: codes, fits, sizes: def.sizes, excluded: new Set() },
        [],
        [],
        {
          skuPrefix: styleId,
          price: onSale ? Math.round(price * 0.75) : price,
          compareAtPrice: onSale ? price : null,
          weightGrams: 600,
          lowStockThreshold: 3,
        },
      );
      // Stock across the ship-from locations: middle sizes deeper, the odd size sold out.
      const matrix = rows.map((row, r) => {
        const middle = ["M", "L"].includes(row.size);
        const stock: Record<string, number> = {};
        for (const [i, loc] of shipFrom.entries()) {
          stock[loc] = (r + sequence) % 17 === 0 ? 0 : (middle ? 8 : 4) - i * 2 + ((r * 7) % 3);
        }
        return { ...row, stock };
      });
      const data: ProductDraftData = productDraftDataSchema.parse({
        name,
        description: `${name} from ${def.shop.name}. ${def.shop.tagline}. Cut and finished with care, and easy to wear on repeat.`,
        highlights: [
          `${line.materials.map((m) => m.material).join(" and ")}`,
          "Ships in its own recyclable packaging",
        ],
        categoryKey: line.categoryKey,
        styleId,
        attributes: line.attributes,
        composition: line.materials,
        colors,
        fits,
        sizes: def.sizes,
        excluded: [],
        matrix,
        parked: [],
        details: {
          fitNotes: "True to size. Size down for a closer fit.",
          modelInfo: "Model is 5'10\" and wears a size S.",
          care: line.care,
          sizeGuide: "platform",
          customGuide: [],
        },
        shipping: {
          weightGrams: 600,
          lengthCm: 35,
          widthCm: 28,
          heightCm: 6,
          shipsFromLocationId: shipFrom[0] ?? "",
          processingTime: def.shop.processingTime,
        },
        seo: { title: "", description: "" },
        slug: "",
        searchKeywords: [def.shop.name.toLowerCase(), line.garment],
        publishAt: "",
      });

      const problems = publishProblems(data, { emailVerified: true, shipFrom });
      if (problems.length > 0) {
        throw new Error(
          `Seed product ${name} (${def.shop.name}) fails the publish checks: ${problems.map((p) => p.message).join("; ")}`,
        );
      }

      // Approved shops' products are live; the pending shop's first product is in
      // review and the rest are drafts; the shop with changes requested has a draft.
      const status: Product["status"] = approved
        ? "live"
        : def.status === "pending_review" && n === 0
          ? "in_review"
          : "draft";
      const summary = summarize(data, shipFrom);
      counters = counterDelta(counters, null, { status, lowStock: summary.lowStock });
      docs.push({
        path: `productDrafts/${productId}`,
        data: strip(
          productDraftSchema.parse({
            id: productId,
            vendorId,
            shopId,
            version: 3,
            data,
            status,
            summary,
            reviewNotes: [],
            published: status === "live",
            createdAt: days(now, 90 - sequence),
            updatedBy: uid,
            updatedAt: days(now, 60 - sequence),
          }),
        ),
      });

      if (status === "live") {
        const slug = chooseSlug(data, (s) => takenSlugs.has(s));
        takenSlugs.add(slug);
        const out = toStorefrontDocs({
          productId,
          data,
          shop,
          merchantStatus: "live",
          slug,
          shipFrom,
          now,
          createdAt: days(now, 90 - sequence),
        });
        products.push(out.product);
        variants.push(...out.variants);
      }
    }
  }
  shop = shopSchema.parse({ ...shop, counters });

  const merchant = merchantSchema.parse({
    id: vendorId,
    ownerUid: uid,
    email,
    username: def.username,
    displayName: def.displayName,
    status: "active",
    emailVerified: true,
    trustLevel: def.trusted ? "trusted" : "standard",
    shopIds: [shopId],
    notifications: { newOrders: true, productReviews: true },
    createdAt,
    updatedAt: now,
  });
  const [firstName = def.displayName, ...rest] = def.displayName.split(" ");

  docs.push(
    { path: `merchants/${vendorId}`, data: strip(merchant) },
    {
      path: `usernames/${def.username}`,
      data: strip(usernameLockSchema.parse({ id: def.username, uid, vendorId, createdAt })),
    },
    { path: `shops/${shopId}`, data: strip(shop) },
    {
      path: `shopSlugs/${def.shop.slug}`,
      data: strip(shopSlugLockSchema.parse({ id: def.shop.slug, shopId, vendorId, createdAt })),
    },
    ...locations.map((l) => ({ path: `shops/${shopId}/locations/${l.id}`, data: strip(l) })),
    ...media,
  );

  return {
    authUser: {
      uid,
      email,
      password: "",
      displayName: def.displayName,
      claims: { role: "vendor", vendorId },
    } satisfies SeedAuthUser,
    profile: userSchema.parse({
      uid,
      email,
      firstName,
      lastName: rest.join(" "),
      role: "vendor",
      vendorId,
      preferences: { marketingEmail: false, marketingSms: false },
      savedSizes: {},
      disabled: false,
      createdAt,
      updatedAt: now,
    }),
    docs,
    products,
    variants,
    summary: `${def.shop.name} (${def.shop.shopType}, ${def.status.replace("_", " ")}): ${email} · /shops/${def.shop.slug} · ${products.length} live / ${sequence} products`,
  };
}

/** Every seed merchant. `takenSlugs` holds the catalog's product slugs, so none collide. */
export function generateMerchantSeed(
  now: Date,
  takenSlugs: Iterable<string>,
  password: string,
): MerchantSeed {
  const taken = new Set(takenSlugs);
  const out: MerchantSeed = {
    authUsers: [],
    profiles: [],
    docs: [],
    products: [],
    variants: [],
    summary: [],
  };
  for (const [i, def] of SEED_MERCHANTS.entries()) {
    const m = buildMerchant(def, i, now, taken);
    out.authUsers.push({ ...m.authUser, password });
    out.profiles.push(m.profile);
    out.docs.push(...m.docs);
    out.products.push(...m.products);
    out.variants.push(...m.variants);
    out.summary.push(m.summary);
  }
  return out;
}
