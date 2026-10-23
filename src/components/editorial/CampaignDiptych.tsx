import type { z } from "zod";
import { ProductImage } from "@/components/commerce/ProductImage";
import { ButtonLink } from "@/components/primitives";
import type { campaignDiptychSchema } from "@/lib/cms/modules";
import { cn } from "@/lib/utils/cn";

/**
 * Two photos side by side with the campaign copy over the first.
 * "pair": two full-bleed campaign photos (a seasonal launch).
 * "framed": the second photo is matted in white on limestone with a
 * handwritten accent (an occasion or gift promotion).
 * The copy sits on a soft dark fade, so light text always passes contrast.
 */
export function CampaignDiptych({
  eyebrow,
  headline,
  body,
  ctas,
  primary,
  secondary,
  layout,
  accent,
}: z.infer<typeof campaignDiptychSchema>) {
  return (
    <section className="grid md:grid-cols-2">
      <div className="relative isolate flex aspect-2/3 items-end overflow-hidden sm:aspect-4/5 md:aspect-auto md:min-h-[46rem]">
        <ProductImage
          src={primary.url}
          alt={primary.alt}
          fill
          sizes="(min-width: 768px) 50vw, 100vw"
          className="-z-10 object-cover"
        />
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 -z-10 h-full bg-linear-to-t from-ink/80 via-ink/40 to-transparent md:h-3/4 md:from-ink/75 md:via-ink/35"
        />
        <div className="w-full p-6 text-surface sm:p-10 lg:p-12">
          {eyebrow && <p className="text-label">{eyebrow}</p>}
          <h2 className={cn("font-display text-5xl", eyebrow && "mt-3")}>{headline}</h2>
          {body && <p className="mt-4 max-w-lg text-lg">{body}</p>}
          <div className="mt-8 flex flex-wrap gap-3">
            {ctas.map((cta) => (
              <ButtonLink key={cta.href} href={cta.href} variant="inverse" size="sm">
                {cta.label}
              </ButtonLink>
            ))}
          </div>
        </div>
      </div>

      {layout === "pair" ? (
        <div className="relative aspect-4/5 overflow-hidden md:aspect-auto">
          <ProductImage
            src={secondary.url}
            alt={secondary.alt}
            fill
            sizes="(min-width: 768px) 50vw, 100vw"
            className="object-cover"
          />
        </div>
      ) : (
        <div className="relative flex items-center justify-center overflow-hidden bg-surface-muted px-8 py-16 md:px-14">
          {accent && (
            <p
              aria-hidden="true"
              className="absolute top-6 right-6 z-10 -rotate-6 font-display text-5xl text-brand italic md:top-10 md:right-10 md:text-6xl"
            >
              {accent}
            </p>
          )}
          <figure className="relative w-full max-w-md -rotate-1 bg-surface p-3 shadow-overlay transition-transform duration-slow ease-atelier hover:rotate-0 md:p-4">
            <div className="relative aspect-4/5">
              <ProductImage
                src={secondary.url}
                alt={secondary.alt}
                fill
                sizes="(min-width: 768px) 30vw, 80vw"
                className="object-cover"
              />
            </div>
          </figure>
        </div>
      )}
    </section>
  );
}
