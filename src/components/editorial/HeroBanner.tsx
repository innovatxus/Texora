import { getImageProps } from "next/image";
import { ButtonLink } from "@/components/primitives";
import type { heroBannerSchema } from "@/lib/cms/modules";
import { cn } from "@/lib/utils/cn";
import type { z } from "zod";

type HeroBannerProps = z.infer<typeof heroBannerSchema> & {
  /** The first hero on a page is the LCP element. */
  priority?: boolean;
};

const pct = (n: number) => `${Math.round(n * 100)}%`;

/**
 * Full-bleed editorial hero with art-directed crops (separate mobile and
 * desktop images) positioned by focal point, and overlay copy.
 */
export function HeroBanner({
  eyebrow,
  headline,
  body,
  ctas,
  image,
  align,
  tone,
  size,
  priority = false,
}: HeroBannerProps) {
  const common = { alt: image.alt, sizes: "100vw", priority, unoptimized: true };
  const {
    props: { srcSet: desktopSrcSet, src: desktopSrc },
  } = getImageProps({
    ...common,
    src: image.desktop.url,
    width: image.desktop.width,
    height: image.desktop.height,
  });
  const { props: mobileProps } = getImageProps({
    ...common,
    src: image.mobile.url,
    width: image.mobile.width,
    height: image.mobile.height,
  });

  const Heading = priority ? "h1" : "h2";

  return (
    <section
      className={cn(
        "relative isolate flex overflow-hidden bg-surface-muted",
        size === "full"
          ? "min-h-[38rem] md:aspect-2/1 md:min-h-0 lg:max-h-[50rem]"
          : "min-h-[34rem] md:aspect-[2.4/1] md:min-h-0",
      )}
    >
      <picture className="absolute inset-0 -z-10">
        {/* Unoptimised (SVG) images have no srcSet; fall back to the plain URL. */}
        <source media="(min-width: 768px)" srcSet={desktopSrcSet ?? desktopSrc} />
        {/* eslint-disable-next-line jsx-a11y/alt-text -- alt comes from getImageProps */}
        <img
          {...mobileProps}
          className="h-full w-full object-cover"
          style={{ objectPosition: `${pct(image.mobile.focal.x)} ${pct(image.mobile.focal.y)}` }}
        />
      </picture>
      <div
        className={cn(
          "container-page flex w-full flex-col justify-end pt-24 pb-10 md:pb-16",
          align === "center" && "items-center text-center",
          tone === "light" ? "text-surface" : "text-ink",
        )}
      >
        <div className={cn("max-w-xl", align === "left" && "md:max-w-lg")}>
          {eyebrow && <p className="text-label">{eyebrow}</p>}
          <Heading className={cn("font-display text-5xl", eyebrow && "mt-3")}>{headline}</Heading>
          {body && <p className="mt-4 text-lg">{body}</p>}
          <div className={cn("mt-8 flex flex-wrap gap-3", align === "center" && "justify-center")}>
            {ctas.map((cta, i) => (
              <ButtonLink
                key={cta.href}
                href={cta.href}
                variant={
                  tone === "light"
                    ? i === 0
                      ? "inverse"
                      : "secondary"
                    : i === 0
                      ? "primary"
                      : "secondary"
                }
                className={cn(tone === "light" && i > 0 && "border-surface text-surface")}
              >
                {cta.label}
              </ButtonLink>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
