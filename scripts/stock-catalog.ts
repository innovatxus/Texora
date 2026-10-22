// The interim storefront photographs (royalty-free Pexels photos; see
// docs/IMAGE_CREDITS.md). Pure data, shared by the image builder
// (scripts/stock-images.ts) and the live-store starter pages.

export interface StockSource {
  id: number;
  /** Pexels page slug (for the credits). */
  page: string;
  alt: string;
}

export const STOCK = {
  heroHome: {
    id: 8484104,
    page: "women-posing-wearing-matching-outfits",
    alt: "Two women in ivory and taupe knits and wide trousers in a pale studio",
  },
  heroWomen: {
    id: 39705635,
    page: "fashionable-woman-in-minimalist-studio-portrait",
    alt: "A woman in a white blouse and wide brown trousers seated in a white studio",
  },
  heroMen: {
    id: 35414994,
    page: "elegant-man-in-pale-pink-shirt-and-gray-pants",
    alt: "A man in a pale pink shirt and grey trousers in a grey studio",
  },
  heroSale: {
    id: 9594676,
    page: "fashion-shopping-indoors-blouse",
    alt: "A clothes rail of neutral pieces in a bright, minimal room",
  },
  womenDresses: {
    id: 13816064,
    page: "a-woman-wearing-a-beige-dress",
    alt: "A woman in a long beige dress",
  },
  womenTops: {
    id: 19456445,
    page: "studio-shot-of-a-woman-in-a-trendy-casual-outfit",
    alt: "A woman in a black blouse and cream trousers",
  },
  womenSweaters: {
    id: 7760243,
    page: "a-woman-in-beige-sweater",
    alt: "A woman in an oatmeal knit sweater",
  },
  womenPants: {
    id: 19317139,
    page: "model-on-white-background",
    alt: "A woman in a black top and ivory trousers",
  },
  womenJeans: {
    id: 19317144,
    page: "woman-in-transparent-blouse",
    alt: "A woman in a sheer top and straight-leg jeans",
  },
  womenCoats: {
    id: 7760238,
    page: "a-person-hugging-a-beige-coat",
    alt: "A woman wrapped in a pale grey wool coat",
  },
  menShirts: {
    id: 10004175,
    page: "a-man-wearing-a-denim-shirt-and-pants",
    alt: "A man in a denim shirt and light-wash jeans",
  },
  menTees: {
    id: 8498700,
    page: "man-in-a-white-crew-neck-shirt-smiling-while-looking-at-the-camera",
    alt: "A man in a white crew-neck tee",
  },
  menSweaters: {
    id: 3754247,
    page: "photo-of-man-wearing-beige-sweater",
    alt: "A man in a beige sweater and black trousers",
  },
  menPants: {
    id: 11000250,
    page: "man-in-black-long-sleeve-shirt-and-beige-pants",
    alt: "A man in a black sweater and stone trousers",
  },
  menJeans: {
    id: 8474077,
    page: "a-handsome-man-in-black-shirt-and-denim-jeans",
    alt: "A man in a black tee and dark-wash jeans",
  },
  menCoats: {
    id: 6626749,
    page: "man-in-white-winter-coat",
    alt: "A man in a cream padded jacket",
  },
} satisfies Record<string, StockSource>;

export type StockKey = keyof typeof STOCK;

/** Published path of a composed image. */
export const stockUrl = (key: StockKey, variant: "tile" | "desktop" | "mobile") =>
  `/media/stock/${key}-${variant}.jpg`;
