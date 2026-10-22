/** Client-safe shapes for product listings (cards, grids, carousels). */

export interface ListingImage {
  url: string;
  alt: string;
}

export interface QuickAddSize {
  size: string;
  sku: string;
  inStock: boolean;
}

export interface ListingColor {
  code: string;
  name: string;
  family: string;
  swatch: string;
  image: ListingImage;
  /** Second view, crossfaded in on hover. */
  altImage?: ListingImage;
  /** Size run for the default fit family, for quick add. */
  sizes: QuickAddSize[];
}

export interface ListingProduct {
  id: string;
  slug: string;
  name: string;
  department: string;
  categoryPath: string[];
  /** Attribute values, normalised to arrays. */
  attributes: Record<string, string[]>;
  fitFamilies: string[];
  defaultFit: string;
  sizeType: string;
  colors: ListingColor[];
  price: number;
  maxPrice: number;
  compareAtPrice?: number;
  /** Badge codes in display priority; the card shows the first. */
  badges: string[];
  ratingAvg: number;
  ratingCount: number;
  salesRank: number;
  createdAt: number;
  /** Sizes in stock online in any colour or fit. */
  sizesInStock: string[];
  inStockOnline: boolean;
  /** Store ids holding any stock. */
  storesInStock: string[];
  /** The merchant shop selling it; absent for Texora's own catalog. */
  shop?: { id: string; slug: string; name: string };
}
