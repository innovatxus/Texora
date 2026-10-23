/** In-grid editorial tiles per listing (position is 1-based within the grid). */
export interface GridTile {
  position: number;
  eyebrow: string;
  title: string;
  href: string;
  image: string;
  imageAlt: string;
}

/** Editorial tiles placed between products in listing grids, per department. */
export const GRID_TILES: Record<string, readonly GridTile[]> = {
  women: [
    {
      position: 7,
      eyebrow: "The Linen Edit",
      title: "Easy pieces for warm days",
      href: "/collections/the-linen-edit",
      image: "/media/stock/womenTops-tile.jpg",
      imageAlt: "A woman in a fitted ivory tee and high-waisted jeans",
    },
  ],
  men: [
    {
      position: 7,
      eyebrow: "Knitwear",
      title: "Merino, cashmere and lambswool",
      href: "/collections/knitwear",
      image: "/media/stock/menSweaters-tile.jpg",
      imageAlt: "A man in a charcoal crew-neck sweater under an olive overcoat",
    },
  ],
};
