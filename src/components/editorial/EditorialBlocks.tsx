import NextLink from "next/link";
import type { z } from "zod";
import { ProductImage } from "@/components/commerce/ProductImage";
import { ButtonLink, Link } from "@/components/primitives";
import type {
  categoryTilesSchema,
  promoStripSchema,
  splitFeatureSchema,
  storyBlockSchema,
} from "@/lib/cms/modules";
import { cn } from "@/lib/utils/cn";

/** Full-width message band with an optional link. */
export function PromoStrip({ message, link, tone }: z.infer<typeof promoStripSchema>) {
  return (
    <section
      className={cn(tone === "inverse" ? "bg-ink text-canvas" : "bg-surface-muted text-ink")}
    >
      <p className="container-page flex flex-wrap items-center justify-center gap-x-4 gap-y-1 py-4 text-center text-sm">
        <span>{message}</span>
        {link && (
          <NextLink href={link.href} className="text-label underline underline-offset-4">
            {link.label}
          </NextLink>
        )}
      </p>
    </section>
  );
}

/**
 * Grid of image tiles linking to categories, in three styles:
 * compact (small label), editorial (large label and "Shop now") and bleed
 * (edge-to-edge photos, each with its own links such as "Shop women · Shop men").
 */
export function CategoryTiles({
  heading,
  subheading,
  variant = "compact",
  tiles,
}: z.infer<typeof categoryTilesSchema>) {
  const bleed = variant === "bleed";
  const header = (heading || subheading) && (
    <div className={cn(bleed && "container-page")}>
      {heading && <h2 className="font-display text-4xl">{heading}</h2>}
      {subheading && <p className="mt-3 max-w-2xl text-lg text-ink-soft">{subheading}</p>}
    </div>
  );

  if (variant === "compact") {
    return (
      <section className="container-page section-y">
        {heading && <h2 className="font-display text-3xl">{heading}</h2>}
        {subheading && <p className="mt-3 text-lg text-ink-soft">{subheading}</p>}
        <ul
          className={cn(
            "grid grid-cols-2 gap-x-4 gap-y-8",
            (heading || subheading) && "mt-8",
            tiles.length <= 4 ? "md:grid-cols-4" : "md:grid-cols-3 lg:grid-cols-6",
          )}
        >
          {tiles.map((tile) => (
            <li key={tile.href}>
              <NextLink href={tile.href} className="group block">
                <span className="relative block aspect-3/4 overflow-hidden">
                  <ProductImage
                    src={tile.image.url}
                    alt={tile.image.alt}
                    fill
                    sizes="(min-width: 1024px) 16vw, (min-width: 768px) 25vw, 50vw"
                    className="transition-transform duration-slow ease-atelier group-hover:scale-[1.02]"
                  />
                </span>
                <span className="mt-3 block text-label underline-offset-4 group-hover:underline">
                  {tile.label}
                </span>
              </NextLink>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <section className={cn("section-y", !bleed && "container-page")}>
      {header}
      <ul
        className={cn(
          "grid grid-cols-2",
          header && "mt-8",
          tiles.length <= 4 ? "md:grid-cols-4" : "md:grid-cols-3 lg:grid-cols-6",
          bleed ? "gap-x-1 gap-y-8" : "gap-x-4 gap-y-10",
        )}
      >
        {tiles.map((tile) => {
          const links = tile.links ?? [{ label: "Shop now", href: tile.href }];
          return (
            <li key={tile.href} className="group">
              <NextLink href={tile.href} className="block" tabIndex={-1} aria-hidden="true">
                <span
                  className={cn(
                    "relative block overflow-hidden",
                    bleed ? "aspect-4/5" : "aspect-3/4",
                  )}
                >
                  <ProductImage
                    src={tile.image.url}
                    alt=""
                    fill
                    sizes="(min-width: 768px) 25vw, 50vw"
                    className="transition-transform duration-slow ease-atelier group-hover:scale-[1.03]"
                  />
                </span>
              </NextLink>
              <div className={cn("mt-4", bleed && "px-3 sm:px-4")}>
                <h3>
                  <NextLink
                    href={tile.href}
                    className={cn(
                      "link-sweep",
                      bleed ? "text-label" : "text-xl tracking-[0.08em] uppercase",
                    )}
                  >
                    {tile.label}
                  </NextLink>
                </h3>
                <ul className={cn("flex flex-wrap gap-x-4 gap-y-1", bleed ? "mt-2" : "mt-4")}>
                  {links.map((link) => (
                    <li key={link.href}>
                      <NextLink
                        href={link.href}
                        className="text-xs tracking-[0.12em] uppercase underline underline-offset-4 transition-colors hover:text-brand"
                      >
                        {link.label}
                        <span className="sr-only"> {tile.label}</span>
                      </NextLink>
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Image and copy side by side, with a call to action. */
export function SplitFeature({
  eyebrow,
  headline,
  body,
  cta,
  image,
  imageSide,
}: z.infer<typeof splitFeatureSchema>) {
  return (
    <section className="container-page section-y">
      <div className="grid items-center gap-8 md:grid-cols-2 md:gap-16">
        <div className={cn("relative aspect-4/5", imageSide === "right" && "md:order-2")}>
          <ProductImage
            src={image.url}
            alt={image.alt}
            fill
            sizes="(min-width: 768px) 50vw, 100vw"
          />
        </div>
        <div className="max-w-md">
          {eyebrow && <p className="text-label text-ink-subtle">{eyebrow}</p>}
          <h2 className="mt-3 font-display text-4xl">{headline}</h2>
          <p className="mt-5 text-lg text-ink-soft">{body}</p>
          <ButtonLink href={cta.href} variant="secondary" className="mt-8">
            {cta.label}
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}

/** Centred editorial text block with an optional call to action. */
export function StoryBlock({ eyebrow, headline, body, cta }: z.infer<typeof storyBlockSchema>) {
  return (
    <section className="container-page section-y text-center">
      <div className="mx-auto max-w-2xl">
        {eyebrow && <p className="text-label text-ink-subtle">{eyebrow}</p>}
        <h2 className="mt-4 font-display text-4xl">{headline}</h2>
        <p className="mt-6 text-lg text-ink-soft">{body}</p>
        {cta && (
          <Link href={cta.href} className="mt-8 inline-block text-label">
            {cta.label}
          </Link>
        )}
      </div>
    </section>
  );
}
