import Image from "next/image";
import type { MerchantImage } from "@/lib/validation/merchant";

export interface ShopHeaderData {
  name: string;
  tagline: string;
  description: string;
  logo?: MerchantImage | undefined;
  banner?: (MerchantImage & { focal?: { x: number; y: number } | undefined }) | undefined;
}

/**
 * The top of a shop page as shoppers see it: focal-point-aware banner,
 * logo, name, tagline and story. Used by `/shops/[slug]` and by the
 * merchant's review-step preview, so the preview is exactly the real thing.
 */
export function ShopHeader({
  shop,
  headingLevel = 1,
  priority = false,
}: {
  shop: ShopHeaderData;
  headingLevel?: 1 | 2;
  priority?: boolean;
}) {
  const Heading = headingLevel === 1 ? "h1" : "h2";
  const focal = shop.banner?.focal ?? { x: 0.5, y: 0.5 };
  return (
    <header className="flex flex-col">
      <div className="relative aspect-[375/200] overflow-hidden bg-surface-muted sm:aspect-[1440/420]">
        {shop.banner && (
          <Image
            src={shop.banner.url}
            alt=""
            fill
            sizes="100vw"
            className="object-cover"
            style={{ objectPosition: `${focal.x * 100}% ${focal.y * 100}%` }}
            placeholder="blur"
            blurDataURL={shop.banner.blurDataURL}
            {...(priority ? { preload: true } : {})}
          />
        )}
      </div>
      <div className="container-page -mt-10 flex flex-col gap-4 sm:-mt-12 sm:flex-row sm:items-end sm:gap-6">
        <div className="relative size-20 shrink-0 overflow-hidden border-4 border-canvas bg-surface sm:size-24">
          {shop.logo ? (
            <Image
              src={shop.logo.url}
              alt={`${shop.name} logo`}
              fill
              sizes="96px"
              className="object-cover"
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex size-full items-center justify-center bg-brand font-display text-3xl text-surface"
            >
              {shop.name.slice(0, 1)}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-1 pb-1">
          <Heading className="font-display text-4xl">{shop.name}</Heading>
          {shop.tagline && <p className="text-ink-soft">{shop.tagline}</p>}
        </div>
      </div>
      {shop.description && (
        <div className="container-page mt-6 max-w-3xl whitespace-pre-line text-ink-soft">
          {shop.description}
        </div>
      )}
    </header>
  );
}
