import Image from "next/image";
import type { MerchantImage } from "@/lib/validation/merchant";

export interface ShopHeaderData {
  name: string;
  description: string;
  logo?: MerchantImage | undefined;
}

/**
 * The top of a shop page: a Texora-green banner carrying the shop's logo and
 * name, then its story. Merchants don't upload banners, so every shop shares
 * the same frame. Used by `/shops/[slug]` and by the merchant's review-step
 * preview, so the preview is exactly the real thing.
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
  return (
    <header className="flex flex-col">
      <div className="bg-brand text-surface">
        <div className="container-page flex min-h-48 items-center gap-5 py-10 sm:min-h-72 sm:gap-8 sm:py-14">
          {shop.logo && (
            <div className="relative size-20 shrink-0 overflow-hidden border-2 border-surface bg-surface sm:size-28">
              <Image
                src={shop.logo.url}
                alt={`${shop.name} logo`}
                fill
                sizes="112px"
                className="object-cover"
                {...(priority ? { preload: true } : {})}
              />
            </div>
          )}
          <Heading className="min-w-0 font-display text-4xl break-words sm:text-6xl">
            {shop.name}
          </Heading>
        </div>
      </div>
      {shop.description && (
        <div className="container-page mt-8 max-w-3xl whitespace-pre-line text-ink-soft">
          {shop.description}
        </div>
      )}
    </header>
  );
}
