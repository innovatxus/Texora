"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { FormMessage } from "@/components/merchant/forms/ErrorSummary";
import { savedAt, StepFooter, type FormMode } from "@/components/merchant/forms/StepFooter";
import { FocalPointPicker, type FocalPoint } from "@/components/merchant/media/FocalPointPicker";
import { Uploader } from "@/components/merchant/media/Uploader";
import { UploadQueue } from "@/components/merchant/media/UploadQueue";
import { MERCHANT_LIMITS } from "@/config/merchant";
import { saveShopBrandingAction } from "@/lib/merchant/actions/shop";
import type { MerchantImage } from "@/lib/validation/merchant";
import { onUploadDone } from "@/stores/uploads";

interface Props {
  mode: FormMode;
  shopId: string;
  shopName: string;
  logo?: MerchantImage | undefined;
  banner?: (MerchantImage & { focal?: FocalPoint | undefined }) | undefined;
}

/** The logo at the sizes it appears in the shop. */
function LogoPreviews({ logo }: { logo: MerchantImage }) {
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
 * plus focal point). Uploads run in the
 * background; the new image is kept once its processing finishes.
 */
export function BrandingForm({ mode, shopId, shopName, logo, banner }: Props) {
  const router = useRouter();
  const [logoImage, setLogoImage] = useState(logo);
  const [bannerImage, setBannerImage] = useState(banner);
  const [focal, setFocal] = useState<FocalPoint>(banner?.focal ?? { x: 0.5, y: 0.5 });
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
        {logoImage && <LogoPreviews logo={logoImage} />}
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
