"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { FormMessage } from "@/components/merchant/forms/ErrorSummary";
import { savedAt, StepFooter, type FormMode } from "@/components/merchant/forms/StepFooter";
import { FocalPointPicker, type FocalPoint } from "@/components/merchant/media/FocalPointPicker";
import { Uploader } from "@/components/merchant/media/Uploader";
import { UploadQueue } from "@/components/merchant/media/UploadQueue";
import { accentColor, MERCHANT_LIMITS, SHOP_ACCENTS, type ShopAccent } from "@/config/merchant";
import { saveShopBrandingAction } from "@/lib/merchant/actions/shop";
import { cn } from "@/lib/utils/cn";
import type { MerchantImage } from "@/lib/validation/merchant";
import { onUploadDone } from "@/stores/uploads";

interface Props {
  mode: FormMode;
  shopId: string;
  shopName: string;
  logo?: MerchantImage | undefined;
  banner?: (MerchantImage & { focal?: FocalPoint | undefined }) | undefined;
  accent: ShopAccent;
}

/** The logo at the three sizes shoppers see it. */
function LogoPreviews({ logo, shopName }: { logo: MerchantImage; shopName: string }) {
  return (
    <div className="flex flex-wrap items-end gap-6 text-xs text-ink-soft">
      <figure className="flex flex-col items-center gap-2">
        <Image
          src={logo.url}
          alt=""
          width={40}
          height={40}
          className="size-10 rounded-full object-cover"
        />
        <figcaption>Avatar</figcaption>
      </figure>
      <figure className="flex flex-col items-center gap-2">
        <Image src={logo.url} alt="" width={96} height={96} className="size-24 object-cover" />
        <figcaption>Shop header</figcaption>
      </figure>
      <figure className="flex flex-col items-start gap-2">
        <span className="flex items-center gap-1.5 text-sm text-ink">
          <Image
            src={logo.url}
            alt=""
            width={20}
            height={20}
            className="size-5 rounded-full object-cover"
          />
          by {shopName}
        </span>
        <figcaption>Sold by line</figcaption>
      </figure>
    </div>
  );
}

/** The banner as cropped on a 1440px desktop and a 375px phone, using the focal point. */
function BannerPreviews({ banner, focal }: { banner: MerchantImage; focal: FocalPoint }) {
  const position = `${focal.x * 100}% ${focal.y * 100}%`;
  return (
    <div className="grid gap-4 text-xs text-ink-soft sm:grid-cols-[3fr_1fr]">
      <figure className="flex flex-col gap-2">
        <div className="relative aspect-[1440/420] overflow-hidden bg-surface-muted">
          <Image
            src={banner.url}
            alt=""
            fill
            sizes="50vw"
            className="object-cover"
            style={{ objectPosition: position }}
          />
        </div>
        <figcaption>Desktop</figcaption>
      </figure>
      <figure className="flex flex-col gap-2">
        <div className="relative aspect-[375/240] overflow-hidden bg-surface-muted">
          <Image
            src={banner.url}
            alt=""
            fill
            sizes="20vw"
            className="object-cover"
            style={{ objectPosition: position }}
          />
        </div>
        <figcaption>Mobile</figcaption>
      </figure>
    </div>
  );
}

/**
 * Onboarding step 2 / Shop › Branding: logo (square crop), banner (3:1 crop
 * plus focal point) and one of eight AA-checked accents. Uploads run in the
 * background; the new image is kept once its processing finishes.
 */
export function BrandingForm({
  mode,
  shopId,
  shopName,
  logo,
  banner,
  accent: initialAccent,
}: Props) {
  const router = useRouter();
  const [logoImage, setLogoImage] = useState(logo);
  const [bannerImage, setBannerImage] = useState(banner);
  const [focal, setFocal] = useState<FocalPoint>(banner?.focal ?? { x: 0.5, y: 0.5 });
  const [accent, setAccent] = useState<ShopAccent>(initialAccent);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedTime, setSavedTime] = useState<string | null>(null);

  const logoKey = `logo:${shopId}`;
  const bannerKey = `banner:${shopId}`;

  useEffect(() => {
    const offLogo = onUploadDone(logoKey, (item) => {
      if (item.result?.kind === "image") setLogoImage(item.result.image);
    });
    const offBanner = onUploadDone(bannerKey, (item) => {
      if (item.result?.kind === "image") {
        setBannerImage(item.result.image);
        setFocal({ x: 0.5, y: 0.5 });
      }
    });
    return () => {
      offLogo();
      offBanner();
    };
  }, [logoKey, bannerKey]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await saveShopBrandingAction({
      shopId,
      accent,
      ...(logoImage && logoImage.mediaId !== logo?.mediaId
        ? { logoMediaId: logoImage.mediaId }
        : {}),
      ...(bannerImage && bannerImage.mediaId !== banner?.mediaId
        ? { bannerMediaId: bannerImage.mediaId }
        : {}),
      ...(bannerImage ? { bannerFocal: focal } : {}),
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    if (mode === "onboarding") {
      router.push("/merchant/onboarding/contact");
      return;
    }
    setSavedTime(savedAt(new Date()));
    router.refresh();
  };

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-10">
      <section aria-labelledby="logo-title" className="flex flex-col gap-4">
        <h2 id="logo-title" className="font-display text-2xl">
          Logo
        </h2>
        {logoImage && <LogoPreviews logo={logoImage} shopName={shopName} />}
        <Uploader
          kind="logo"
          shopId={shopId}
          ownerKey={logoKey}
          cropTitle="Crop your logo"
          alt={`${shopName} logo`}
          instructions={`Square, at least ${MERCHANT_LIMITS.logo.minWidth}×${MERCHANT_LIMITS.logo.minHeight} px, PNG, JPG, WebP or SVG, up to 5 MB.`}
        />
        <UploadQueue ownerKey={logoKey} />
      </section>

      <section aria-labelledby="banner-title" className="flex flex-col gap-4">
        <h2 id="banner-title" className="font-display text-2xl">
          Banner
        </h2>
        {bannerImage && (
          <>
            <BannerPreviews banner={bannerImage} focal={focal} />
            <div className="max-w-xl">
              <FocalPointPicker
                src={bannerImage.url}
                width={bannerImage.width}
                height={bannerImage.height}
                value={focal}
                onChange={setFocal}
                label="Banner focal point"
              />
            </div>
          </>
        )}
        <Uploader
          kind="banner"
          shopId={shopId}
          ownerKey={bannerKey}
          cropTitle="Crop your banner"
          alt={`${shopName} banner`}
          instructions={`3:1, at least ${MERCHANT_LIMITS.banner.minWidth}×${MERCHANT_LIMITS.banner.minHeight} px, PNG, JPG or WebP, up to 10 MB.`}
        />
        <UploadQueue ownerKey={bannerKey} />
      </section>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 font-display text-2xl">Accent colour</legend>
        <p className="text-sm text-ink-soft">Used for buttons and links on your shop page.</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {SHOP_ACCENTS.map((option) => (
            <label
              key={option.key}
              className={cn(
                "flex min-h-11 cursor-pointer items-center gap-3 border border-ink-subtle bg-surface p-3",
                "has-checked:border-ink has-checked:ring-1 has-checked:ring-ink has-focus-visible:outline-2 has-focus-visible:outline-focus",
              )}
            >
              <input
                type="radio"
                name="accent"
                value={option.key}
                checked={accent === option.key}
                onChange={() => setAccent(option.key)}
                className="accent-ink"
              />
              <span
                aria-hidden="true"
                className="size-6"
                style={{ background: accentColor(option.key) }}
              />
              <span className="text-sm">{option.label}</span>
            </label>
          ))}
        </div>
        <div>
          <span
            className="inline-flex min-h-11 items-center px-5 text-sm font-medium text-surface"
            style={{ background: accentColor(accent) }}
          >
            Shop now
          </span>
          <span className="ml-3 text-sm text-ink-soft">Preview</span>
        </div>
      </fieldset>

      {error && <FormMessage>{error}</FormMessage>}
      <StepFooter
        mode={mode}
        backHref="/merchant/onboarding/basics"
        pending={pending}
        savedTime={savedTime}
      />
    </form>
  );
}
