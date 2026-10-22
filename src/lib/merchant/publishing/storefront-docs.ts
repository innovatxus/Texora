/**
 * Turns a merchant draft into the storefront's existing `products` and
 * `variants` documents (no separate merchant product model). Pure, so the
 * mapping is unit tested: shop fields are denormalised onto the product,
 * stock is written per merchant location plus the online total (D-065),
 * and composition becomes material filter values and a fabric line (D-081).
 */
import { formatComposition, productConfigFor } from "@/config/product-attributes";
import { categoryKeysFor, type Product, type Variant } from "@/lib/validation/catalog";
import { ONLINE_LOCATION } from "@/lib/validation/catalog";
import { merchantStockKey, type ProductDraftData, type Shop } from "@/lib/validation/merchant";
import { suggestProductSlug, suggestSeoDescription, suggestSeoTitle } from "../editor";
import { onlineStock } from "../variants/matrix";

export interface StorefrontDocs {
  product: Product;
  variants: Variant[];
}

/** The storefront status for a product: live only when the merchant's product is live and the shop approved. */
export function storefrontStatus(
  merchantStatus: Product["status"],
  shopStatus: Shop["status"],
): Product["status"] {
  if (merchantStatus === "live" && shopStatus === "approved") return "live";
  if (merchantStatus === "archived") return "archived";
  return merchantStatus === "scheduled" ? "scheduled" : "draft";
}

export function toStorefrontDocs(input: {
  productId: string;
  data: ProductDraftData;
  shop: Pick<Shop, "id" | "slug" | "name" | "logo" | "vendorId" | "status">;
  merchantStatus: Product["status"];
  slug: string;
  shipFrom: readonly string[];
  now: Date;
  createdAt?: Date | undefined;
  /** Kept from the live product (reviews and sales aren't the merchant's to set). */
  ratings?: Pick<Product, "ratingAvg" | "ratingCount" | "salesRank" | "fitScore"> | undefined;
}): StorefrontDocs {
  const { productId, data, shop, now } = input;
  const config = productConfigFor(data.categoryKey);
  const categoryPath = data.categoryKey.split("/");
  const priced = data.matrix.filter((r) => r.price !== null && r.price > 0);
  const prices = priced.map((r) => r.price as number);
  const marked = priced.filter(
    (r) => r.compareAtPrice !== null && r.compareAtPrice > (r.price ?? 0),
  );
  const materials = data.composition.map((c) => c.material);

  const attributes: Record<string, string | string[]> = { ...data.attributes };
  if (materials.length > 0)
    attributes.material = materials.length === 1 ? (materials[0] as string) : materials;

  const fabricCare = [
    ...(data.composition.length ? [formatComposition(data.composition)] : []),
    ...data.details.care.filter((l) => l.trim()),
  ];

  const product: Product = {
    id: productId,
    styleId: data.styleId.trim(),
    slug: input.slug,
    name: data.name.trim(),
    description: [
      data.description.trim(),
      ...data.highlights.filter((h) => h.trim()).map((h) => `• ${h.trim()}`),
    ].join("\n"),
    department: (categoryPath[0] === "men" ? "men" : "women") as Product["department"],
    categoryPath,
    categoryKeys: categoryKeysFor(categoryPath),
    attributes,
    fitFamilies: data.fits,
    sizeType: config?.sizeType ?? "alpha",
    colors: data.colors
      .filter((c) => c.images.length > 0)
      .map((c) => ({
        code: c.code,
        name: c.name.trim(),
        family: c.family,
        swatch: c.swatch.toLowerCase(),
        images: c.images.map((i) => ({
          url: i.url,
          alt: i.alt.trim(),
          width: i.width,
          height: i.height,
          ...(i.focal ? { focal: i.focal } : {}),
        })),
        ...(c.video && c.images[0]
          ? {
              video: {
                url: c.video.url,
                poster: {
                  url: c.images[0].url,
                  alt: c.images[0].alt,
                  width: c.images[0].width,
                  height: c.images[0].height,
                },
              },
            }
          : {}),
      })),
    priceRange: {
      min: prices.length ? Math.min(...prices) : 0,
      max: prices.length ? Math.max(...prices) : 0,
      ...(marked.length
        ? {
            compareAtMin: Math.min(...marked.map((r) => r.compareAtPrice as number)),
            compareAtMax: Math.max(...marked.map((r) => r.compareAtPrice as number)),
          }
        : {}),
    },
    badges: marked.length ? ["sale"] : [],
    ratingAvg: input.ratings?.ratingAvg ?? 0,
    ratingCount: input.ratings?.ratingCount ?? 0,
    ...(input.ratings?.fitScore !== undefined ? { fitScore: input.ratings.fitScore } : {}),
    details: {
      ...(data.details.fitNotes.trim() ? { fitNotes: data.details.fitNotes.trim() } : {}),
      ...(data.details.modelInfo.trim() ? { modelInfo: data.details.modelInfo.trim() } : {}),
      fabricCare,
    },
    completeTheLook: [],
    salesRank: input.ratings?.salesRank ?? 0,
    status: storefrontStatus(input.merchantStatus, shop.status),
    ...(data.publishAt ? { publishAt: new Date(data.publishAt) } : {}),
    seo: {
      title: (data.seo.title.trim() || suggestSeoTitle(data.name, shop.name)).slice(0, 70),
      description: (data.seo.description.trim() || suggestSeoDescription(data.description)).slice(
        0,
        160,
      ),
    },
    searchKeywords: data.searchKeywords,
    vendorId: shop.vendorId,
    shopId: shop.id,
    shop: {
      id: shop.id,
      slug: shop.slug,
      name: shop.name,
      ...(shop.logo
        ? {
            logo: {
              url: shop.logo.url,
              alt: shop.logo.alt,
              width: shop.logo.width,
              height: shop.logo.height,
            },
          }
        : {}),
    },
    createdAt: input.createdAt ?? now,
    updatedAt: now,
  };

  const variants: Variant[] = priced.map((r) => {
    const stockByLocation: Record<string, number> = {};
    for (const [locationId, units] of Object.entries(r.stock)) {
      stockByLocation[merchantStockKey(shop.id, locationId)] = units;
    }
    stockByLocation[ONLINE_LOCATION] = onlineStock(r.stock, input.shipFrom);
    return {
      sku: r.sku,
      productId,
      color: r.color,
      fitFamily: r.fit,
      size: r.size,
      price: r.price as number,
      ...(r.compareAtPrice !== null && r.compareAtPrice > (r.price ?? 0)
        ? { compareAtPrice: r.compareAtPrice }
        : {}),
      ...(r.barcode ? { barcode: r.barcode } : {}),
      weightGrams: r.weightGrams || data.shipping.weightGrams || 1,
      stockByLocation,
      availableOnline: r.availableOnline,
      backorder: r.backorder,
      lowStockThreshold: r.lowStockThreshold,
      vendorId: shop.vendorId,
      shopId: shop.id,
      updatedAt: now,
    };
  });

  return { product, variants };
}

/** The product address: the merchant's, else one from the name, made unique with a suffix. */
export function chooseSlug(
  data: Pick<ProductDraftData, "slug" | "name">,
  taken: (slug: string) => boolean,
): string {
  const base = (data.slug || suggestProductSlug(data.name) || "product").slice(0, 100);
  if (!taken(base)) return base;
  for (let n = 2; n < 100; n++) {
    if (!taken(`${base}-${n}`)) return `${base}-${n}`;
  }
  return `${base}-${Date.now().toString(36)}`;
}
