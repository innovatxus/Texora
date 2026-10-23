// Storefront photography slots: the store's own campaign photography
// (CAMPAIGN) and the home hero (HOME_HERO). Pure data, shared by the image
// builders and the live-store starter pages.

/** Published path of a composed image. */
export const stockUrl = (key: CampaignKey, variant: "tile" | "panel" | "desktop" | "mobile") =>
  `/media/stock/${key}-${variant}.jpg`;

/**
 * The home hero: the store's own photograph (public/media/assets), framed for
 * desktop and phones by scripts/hero-images.ts.
 */
export const HOME_HERO = {
  desktop: "/media/hero/home-desktop.jpg",
  mobile: "/media/hero/home-mobile.jpg",
  alt: "Three people walking in relaxed neutral tailoring, wide trousers and sneakers",
} as const;

/** A region of a source photo, in its pixels. */
export interface Crop {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface CampaignShot {
  /** File in public/media/assets/campaign. */
  file: string;
  /** Crop before framing; the whole photo when absent. */
  crop?: Crop;
  /** Phone hero only: a portrait crop around the people. */
  mobileCrop?: Crop;
  /** Desktop hero only: crop to 2:1 directly instead of composing on a backdrop. */
  desktopCrop?: Crop;
  alt: string;
}

/**
 * The store's own campaign photography (public/media/assets/campaign),
 * in every slot except the home hero (the store's own photo, HOME_HERO). Built by
 * scripts/campaign-images.ts into the same /media/stock paths, so pages that
 * already use those paths update without a content change.
 */
export const CAMPAIGN = {
  heroWomen: {
    file: "olive-trench.jpg",
    desktopCrop: { left: 0, top: 0, width: 1672, height: 836 },
    mobileCrop: { left: 700, top: 0, width: 753, height: 941 },
    alt: "A woman in an olive trench coat and cream trousers carrying gift boxes through a limestone courtyard",
  },
  heroMen: {
    file: "menswear-motion.jpg",
    desktopCrop: { left: 397, top: 0, width: 1586, height: 793 },
    mobileCrop: { left: 830, top: 0, width: 640, height: 793 },
    alt: "Three men walking across a sunlit concrete plaza in an olive jacket, a cream knit polo and a charcoal overshirt",
  },
  heroSale: {
    file: "evening-villa.jpg",
    desktopCrop: { left: 274, top: 0, width: 1642, height: 821 },
    mobileCrop: { left: 720, top: 0, width: 760, height: 821 },
    alt: "Three people in evening wear, an olive satin gown, a dark suit and a black draped dress, in a sunlit villa",
  },
  womenDresses: {
    file: "champagne-dress.jpg",
    alt: "A woman in a champagne pleated midi dress with an olive handbag",
  },
  womenTops: {
    file: "denim-pair.jpg",
    crop: { left: 80, top: 80, width: 480, height: 640 },
    alt: "A woman in a fitted ivory tee and high-waisted jeans",
  },
  womenSweaters: {
    file: "oatmeal-knit.jpg",
    alt: "A woman in an oatmeal cable-knit cardigan and olive ribbed skirt",
  },
  womenPants: {
    file: "olive-trench.jpg",
    crop: { left: 830, top: 380, width: 420, height: 560 },
    alt: "Wide cream trousers under an olive trench coat",
  },
  womenJeans: {
    file: "denim-pair.jpg",
    crop: { left: 60, top: 520, width: 500, height: 667 },
    alt: "Wide-leg mid-wash jeans with brown loafers",
  },
  womenCoats: {
    file: "olive-trench.jpg",
    crop: { left: 657, top: 0, width: 706, height: 941 },
    alt: "A woman in a belted olive trench coat",
  },
  menShirts: {
    file: "denim-pair.jpg",
    crop: { left: 520, top: 10, width: 510, height: 680 },
    alt: "A man in a charcoal overshirt over an olive tee",
  },
  menTees: {
    file: "denim-pair.jpg",
    crop: { left: 570, top: 160, width: 390, height: 520 },
    alt: "An olive crew-neck tee under an open charcoal overshirt",
  },
  menSweaters: {
    file: "olive-overcoat.jpg",
    crop: { left: 300, top: 20, width: 540, height: 720 },
    alt: "A man in a charcoal crew-neck sweater under an olive overcoat",
  },
  menPants: {
    file: "olive-overcoat.jpg",
    crop: { left: 330, top: 640, width: 500, height: 667 },
    alt: "Pressed black trousers with Chelsea boots",
  },
  menJeans: {
    file: "denim-pair.jpg",
    crop: { left: 520, top: 520, width: 520, height: 693 },
    alt: "Straight dark-wash jeans with brown leather boots",
  },
  menCoats: {
    file: "olive-overcoat.jpg",
    alt: "A man in a long olive wool overcoat",
  },
  // Home page sections. "panel*" slots are 1200×1500 campaign panels; "cross*" are tiles.
  panelEvening: {
    file: "evening-villa.jpg",
    crop: { left: 690, top: 0, width: 528, height: 660 },
    alt: "A woman in a draped olive satin gown in a sunlit villa",
  },
  panelEveningAlt: {
    file: "evening-villa.jpg",
    crop: { left: 1440, top: 0, width: 476, height: 595 },
    alt: "A woman in a black one-shoulder draped gown",
  },
  panelGift: {
    file: "olive-trench.jpg",
    crop: { left: 640, top: 0, width: 753, height: 941 },
    alt: "A woman in an olive trench coat carrying gift boxes tied with black ribbon",
  },
  panelGiftFramed: {
    file: "olive-trench.jpg",
    crop: { left: 1150, top: 330, width: 522, height: 611 },
    alt: "Gift boxes, a black leather tote, a folded scarf and sunglasses on a limestone table",
  },
  crossDenim: {
    file: "denim-pair.jpg",
    alt: "A woman in wide-leg jeans and a man in straight dark jeans",
  },
  crossTrousers: {
    file: "menswear-motion.jpg",
    crop: { left: 720, top: 0, width: 595, height: 793 },
    alt: "A man in pleated charcoal trousers, an olive jacket and white sneakers",
  },
} satisfies Record<string, CampaignShot>;

export type CampaignKey = keyof typeof CAMPAIGN;
/** Kept as an alias: every photo slot is a campaign slot. */
export type StockKey = CampaignKey;

/** The description for a slot's photo. */
export const stockAlt = (key: CampaignKey) => CAMPAIGN[key].alt;
