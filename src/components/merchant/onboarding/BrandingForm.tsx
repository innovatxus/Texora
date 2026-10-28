"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { FormMessage } from "@/components/merchant/forms/ErrorSummary";
import { savedAt, StepFooter, type FormMode } from "@/components/merchant/forms/StepFooter";
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
}

/** A small version of the shop header: the green banner with the logo and name. */
function HeaderPreview({ logo, shopName }: { logo: MerchantImage | undefined; shopName: string }) {
  return (
    <figure className="flex flex-col gap-2 text-xs text-ink-soft">
      <div className="flex min-h-28 items-center gap-4 bg-brand px-5 py-6 text-surface">
        {logo && (
          <Image
            src={logo.url}
            alt=""
            width={64}
            height={64}
            className="size-16 border-2 border-surface bg-surface object-cover"
          />
        )}
        <span className="font-display text-3xl break-words">{shopName}</span>
      </div>
      <figcaption>How the top of your shop page looks</figcaption>
    </figure>
  );
}

/**
 * Onboarding step 2 / Shop › Branding: the logo (square crop). The shop page
 * banner is Texora green with the logo and shop name, so there's no banner to
 * upload. Uploads run in the background; the new logo is kept once its
 * processing finishes.
 */
export function BrandingForm({ mode, shopId, shopName, logo }: Props) {
  const router = useRouter();
  const [logoImage, setLogoImage] = useState(logo);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedTime, setSavedTime] = useState<string | null>(null);

  const logoKey = `logo:${shopId}`;

  useEffect(
    () =>
      onUploadDone(logoKey, (item) => {
        if (item.result?.kind === "image") setLogoImage(item.result.image);
      }),
    [logoKey],
  );

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await saveShopBrandingAction({
      shopId,
      ...(logoImage && logoImage.mediaId !== logo?.mediaId
        ? { logoMediaId: logoImage.mediaId }
        : {}),
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
        <HeaderPreview logo={logoImage} shopName={shopName} />
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
