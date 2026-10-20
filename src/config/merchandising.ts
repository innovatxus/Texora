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
      image: "/media/placeholders/look-1.svg",
      imageAlt: "An ivory top with camel trousers",
    },
  ],
  men: [
    {
      position: 7,
      eyebrow: "Knitwear",
      title: "Merino, cashmere and lambswool",
      href: "/collections/knitwear",
      image: "/media/placeholders/editorial-knitwear.svg",
      imageAlt: "A forest green sweater on a hanger",
    },
  ],
};
