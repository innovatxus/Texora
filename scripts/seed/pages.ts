// CMS page content for the seed: home, department landings and sale.
import { cmsPageSchema, type CmsModule, type CmsPage } from "../../src/lib/cms/modules";
import type { Product } from "../../src/lib/validation";

const P = "/media/placeholders";
const everyone = { schedule: {}, audience: ["everyone" as const] };

function hero(
  id: string,
  scene: string,
  data: Omit<Extract<CmsModule, { type: "hero" }>["data"], "image"> & { alt: string },
): CmsModule {
  const { alt, ...rest } = data;
  return {
    id,
    type: "hero",
    ...everyone,
    data: {
      ...rest,
      image: {
        alt,
        desktop: {
          url: `${P}/${scene}.svg`,
          width: 2400,
          height: 1200,
          focal: { x: 0.5, y: 0.35 },
        },
        mobile: {
          url: `${P}/${scene}-mobile.svg`,
          width: 1200,
          height: 1500,
          focal: { x: 0.5, y: 0.3 },
        },
      },
    },
  };
}

function firstIn(products: readonly Product[], categoryKey: string, n: number): string[] {
  return products
    .filter((p) => p.status === "live" && p.categoryKeys.includes(categoryKey))
    .sort((a, b) => a.salesRank - b.salesRank)
    .slice(0, n)
    .map((p) => p.id);
}

export function buildPages(products: readonly Product[], now: Date): CmsPage[] {
  const womenTop = firstIn(products, "women/tops", 1)[0] ?? "";
  const womenPants = firstIn(products, "women/pants", 1)[0] ?? "";
  const womenSweater = firstIn(products, "women/sweaters", 1)[0] ?? "";
  const womenJeans = firstIn(products, "women/jeans", 1)[0] ?? "";
  const menShirt = firstIn(products, "men/shirts", 1)[0] ?? "";
  const menPants = firstIn(products, "men/pants", 1)[0] ?? "";

  const tile = (label: string, href: string, image: string, alt: string) => ({
    label,
    href,
    image: { url: `${P}/${image}.svg`, alt },
  });

  const pages: Array<Omit<CmsPage, "updatedAt">> = [
    {
      id: "home",
      slug: "home",
      title: "Home",
      seo: {
        title: "Texora: considered clothing",
        description: "Tailored essentials, seasonal collections and fit families for every body.",
      },
      status: "live",
      modules: [
        hero("home-hero", "hero-home", {
          eyebrow: "Autumn collection",
          headline: "Made to be worn, season after season",
          body: "Wool, linen and cashmere pieces cut to last, in Regular, Petite and Tall.",
          ctas: [
            { label: "Shop women", href: "/women" },
            { label: "Shop men", href: "/men" },
          ],
          align: "left",
          tone: "dark",
          size: "full",
          alt: "A rail of autumn pieces: a camel coat, terracotta dress, ivory shirt, green sweater and sand trousers",
        }),
        {
          id: "home-tiles",
          type: "categoryTiles",
          ...everyone,
          data: {
            heading: "Shop by category",
            tiles: [
              tile("Dresses", "/women/dresses", "dress-terracotta-model", "Terracotta dress"),
              tile("Sweaters", "/women/sweaters", "sweater-forest-model", "Forest green sweater"),
              tile("Shirts", "/men/shirts", "shirt-chambray-model", "Chambray shirt"),
              tile("Coats", "/men/outerwear", "coat-camel-model", "Camel coat"),
            ],
          },
        },
        {
          id: "home-new",
          type: "productCarousel",
          ...everyone,
          data: {
            heading: "New arrivals",
            cta: { label: "Shop all new", href: "/collections/new-arrivals" },
            source: { type: "rule", sort: "newest", limit: 12 },
          },
        },
        {
          id: "home-linen",
          type: "splitFeature",
          ...everyone,
          data: {
            eyebrow: "The Linen Edit",
            headline: "Easy pieces for warm days",
            body: "Washed linen shirts, drawstring trousers and shirt dresses that soften with every wear. Breathable, relaxed and made to be layered.",
            cta: { label: "Shop the edit", href: "/collections/the-linen-edit" },
            image: {
              url: `${P}/split-linen.svg`,
              alt: "An oat linen shirt and ivory trousers on hangers",
            },
            imageSide: "left",
          },
        },
        {
          id: "home-member",
          type: "promoStrip",
          schedule: {},
          audience: ["member", "core", "enthusiast", "icon"],
          data: {
            message: "Members: double points on knitwear this week",
            link: { label: "Shop knitwear", href: "/collections/knitwear" },
            tone: "inverse",
          },
        },
        {
          id: "home-best",
          type: "productCarousel",
          ...everyone,
          data: {
            heading: "Best sellers",
            source: { type: "rule", sort: "best_sellers", limit: 12 },
          },
        },
        {
          id: "home-looks",
          type: "lookbookGrid",
          ...everyone,
          data: {
            heading: "Shop the looks",
            looks: [
              {
                image: { url: `${P}/look-1.svg`, alt: "An ivory top with camel trousers" },
                title: "Soft tailoring",
                hotspots: [
                  { productId: womenTop, x: 0.5, y: 0.25 },
                  { productId: womenPants, x: 0.5, y: 0.72 },
                ],
              },
              {
                image: { url: `${P}/look-2.svg`, alt: "A navy sweater with light-wash jeans" },
                title: "Weekend denim",
                hotspots: [
                  { productId: womenSweater, x: 0.5, y: 0.25 },
                  { productId: womenJeans, x: 0.5, y: 0.72 },
                ],
              },
              {
                image: { url: `${P}/look-3.svg`, alt: "A chambray shirt with olive trousers" },
                title: "Off duty",
                hotspots: [
                  { productId: menShirt, x: 0.5, y: 0.25 },
                  { productId: menPants, x: 0.5, y: 0.72 },
                ],
              },
            ],
          },
        },
        {
          id: "home-story",
          type: "storyBlock",
          ...everyone,
          data: {
            eyebrow: "How we make it",
            headline: "Fewer, better pieces, cut for real bodies",
            body: "Every style is graded across Regular, Petite and Tall fit families, so sleeves, rises and hems land where they should. We choose natural fibres and finish seams to be worn for years, not seasons.",
            cta: { label: "Materials & care", href: "/help/materials" },
          },
        },
      ],
    },
    {
      id: "women",
      slug: "women",
      title: "Women",
      seo: {
        title: "Women's clothing",
        description: "Dresses, knitwear, tailoring and denim in Regular, Petite and Tall.",
      },
      status: "live",
      modules: [
        hero("women-hero", "hero-women", {
          eyebrow: "Women",
          headline: "The new season wardrobe",
          ctas: [{ label: "Shop new arrivals", href: "/collections/new-arrivals" }],
          align: "left",
          tone: "dark",
          size: "medium",
          alt: "A rail of women's pieces: an oat dress, blush top, light jeans, charcoal coat and butter sweater",
        }),
        {
          id: "women-tiles",
          type: "categoryTiles",
          ...everyone,
          data: {
            tiles: [
              tile("Dresses", "/women/dresses", "dress-oat-model", "Oat dress"),
              tile("Tops & shirts", "/women/tops", "top-blush-model", "Blush blouse"),
              tile("Sweaters", "/women/sweaters", "sweater-butter-model", "Butter sweater"),
              tile("Pants", "/women/pants", "pants-sand-model", "Sand trousers"),
              tile("Jeans", "/women/jeans", "jeans-light-wash-model", "Light-wash jeans"),
              tile("Coats & jackets", "/women/outerwear", "coat-charcoal-model", "Charcoal coat"),
            ],
          },
        },
        {
          id: "women-best",
          type: "productCarousel",
          ...everyone,
          data: {
            heading: "Women's best sellers",
            source: { type: "rule", categoryKey: "women", sort: "best_sellers", limit: 12 },
          },
        },
      ],
    },
    {
      id: "men",
      slug: "men",
      title: "Men",
      seo: {
        title: "Men's clothing",
        description: "Shirts, knitwear, chinos and outerwear in Regular and Tall.",
      },
      status: "live",
      modules: [
        hero("men-hero", "hero-men", {
          eyebrow: "Men",
          headline: "Considered essentials",
          ctas: [{ label: "Shop new arrivals", href: "/collections/new-arrivals" }],
          align: "left",
          tone: "dark",
          size: "medium",
          alt: "A rail of men's pieces: a navy coat, chambray shirt, oat sweater, indigo jeans and black tee",
        }),
        {
          id: "men-tiles",
          type: "categoryTiles",
          ...everyone,
          data: {
            tiles: [
              tile("Shirts", "/men/shirts", "shirt-chambray-model", "Chambray shirt"),
              tile("Tees & polos", "/men/tees-polos", "tee-navy-model", "Navy tee"),
              tile("Sweaters", "/men/sweaters", "sweater-oat-model", "Oat sweater"),
              tile("Pants & chinos", "/men/pants", "pants-olive-model", "Olive chinos"),
              tile("Jeans", "/men/jeans", "jeans-indigo-model", "Indigo jeans"),
              tile("Coats & jackets", "/men/outerwear", "coat-navy-model", "Navy coat"),
            ],
          },
        },
        {
          id: "men-best",
          type: "productCarousel",
          ...everyone,
          data: {
            heading: "Men's best sellers",
            source: { type: "rule", categoryKey: "men", sort: "best_sellers", limit: 12 },
          },
        },
      ],
    },
    {
      id: "sale",
      slug: "sale",
      title: "Sale",
      seo: { title: "Sale", description: "Selected styles, reduced." },
      status: "live",
      modules: [
        hero("sale-hero", "hero-sale", {
          eyebrow: "Sale",
          headline: "Selected styles, reduced",
          body: "Final sale items are marked and can't be returned.",
          ctas: [
            { label: "Women's sale", href: "/sale/women" },
            { label: "Men's sale", href: "/sale/men" },
          ],
          align: "left",
          tone: "dark",
          size: "medium",
          alt: "A rail of reduced pieces in terracotta, sage, plum and butter",
        }),
      ],
    },
  ];

  return pages.map((page) => cmsPageSchema.parse({ ...page, updatedAt: now }));
}
