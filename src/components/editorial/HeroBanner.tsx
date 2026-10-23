import { getImageProps } from "next/image";
import { ButtonLink } from "@/components/primitives";
import type { heroBannerSchema } from "@/lib/cms/modules";
import { cn } from "@/lib/utils/cn";
import type { z } from "zod";
import { HeroVideo } from "./HeroVideo";

type HeroBannerProps = z.infer<typeof heroBannerSchema> & {
  /** The first hero on a page is the LCP element. */
  priority?: boolean;
};

const pct = (n: number) => `${Math.round(n * 100)}%`;

/**
 * Full-bleed editorial hero with art-directed crops (separate mobile and
 * desktop images) positioned by focal point, and overlay copy. With a video,
 * the poster (its first frame) is the LCP image and the video fades in over it
 * once the page has loaded; see VideoHero.
 */
export function HeroBanner(props: HeroBannerProps) {
  return props.video ? <VideoHero {...props} video={props.video} /> : <ImageHero {...props} />;
}

function ImageHero({
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

/**
 * Video hero. The frame blends into the page on the video's own backdrop
 * colour. Desktop: the video is anchored right at full height with a feathered
 * left edge, so the copy column on the left stays clear at every width. Phones:
 * the video sits at the top, framed on the walkers, with the copy below it.
 */
function VideoHero({
  eyebrow,
  headline,
  body,
  ctas,
  image,
  align,
  size,
  priority = false,
  video,
}: HeroBannerProps & { video: NonNullable<HeroBannerProps["video"]> }) {
  const { props: poster } = getImageProps({
    alt: image.alt,
    src: video.poster.jpg,
    width: video.poster.width,
    height: video.poster.height,
    sizes: "(min-width: 768px) 90vw, 100vw",
    priority,
    unoptimized: true,
  });
  const Heading = priority ? "h1" : "h2";

  return (
    <section
      className={cn(
        "relative isolate flex overflow-hidden",
        size === "full"
          ? "md:aspect-2/1 md:min-h-0 lg:max-h-[50rem]"
          : "md:aspect-[2.4/1] md:min-h-0",
      )}
      style={{ backgroundColor: video.backdrop }}
    >
      <div className="absolute inset-x-0 top-0 -z-10 aspect-4/3 [mask-image:linear-gradient(to_bottom,black_82%,transparent)] md:inset-y-0 md:right-0 md:left-auto md:aspect-video md:h-full md:[mask-image:linear-gradient(to_right,transparent,black_14%)]">
        <picture>
          <source type="image/webp" srcSet={video.poster.webp} />
          {/* eslint-disable-next-line jsx-a11y/alt-text -- alt comes from getImageProps */}
          <img
            {...poster}
            className="absolute inset-0 h-full w-full object-cover object-[70%_50%] md:object-[50%_45%]"
          />
        </picture>
        <HeroVideo sources={video} className="object-[70%_50%] md:object-[50%_45%]" />
      </div>
      <div
        className={cn(
          "container-page flex w-full flex-col justify-end pt-[calc(75vw+1rem)] pb-10 text-ink md:pt-24 md:pb-16",
          align === "center" && "items-center text-center",
        )}
      >
        <div className={cn("max-w-xl", align === "left" && "md:max-w-[22rem] lg:max-w-sm")}>
          {eyebrow && <p className="text-label">{eyebrow}</p>}
          <Heading className={cn("font-display text-5xl", eyebrow && "mt-3")}>{headline}</Heading>
          {body && <p className="mt-4 text-lg">{body}</p>}
          <div className={cn("mt-8 flex flex-wrap gap-3", align === "center" && "justify-center")}>
            {ctas.map((cta, i) => (
              <ButtonLink
                key={cta.href}
                href={cta.href}
                variant={i === 0 ? "primary" : "secondary"}
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
