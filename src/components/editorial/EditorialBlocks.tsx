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

/** Grid of image tiles linking to categories. */
export function CategoryTiles({ heading, tiles }: z.infer<typeof categoryTilesSchema>) {
  return (
    <section className="container-page section-y">
      {heading && <h2 className="font-display text-3xl">{heading}</h2>}
      <ul
        className={cn(
          "grid grid-cols-2 gap-x-4 gap-y-8",
          heading && "mt-8",
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
