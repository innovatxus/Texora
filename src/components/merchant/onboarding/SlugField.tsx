"use client";

import { useEffect, useState, type ComponentProps } from "react";
import { CheckIcon } from "@/components/icons";
import { Input } from "@/components/primitives";
import { MERCHANT_LIMITS } from "@/config/merchant";
import { checkShopSlugAvailability } from "@/lib/merchant/actions/shop";
import { cn } from "@/lib/utils/cn";

interface Availability {
  slug: string;
  available: boolean;
  message: string;
}

/**
 * Shop address with the live availability check (300ms debounce, announced
 * politely). The address lock in the save transaction is what guarantees
 * uniqueness; this is guidance.
 */
export function SlugField({
  value,
  shopId,
  error,
  ...inputProps
}: Omit<ComponentProps<typeof Input>, "label" | "value"> & {
  value: string;
  shopId?: string | undefined;
}) {
  const [result, setResult] = useState<Availability | null>(null);
  const normalised = value.trim().toLowerCase();
  const tooShort = normalised.length < MERCHANT_LIMITS.shop.slugMin;

  useEffect(() => {
    if (tooShort) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const response = await checkShopSlugAvailability({
        slug: normalised,
        ...(shopId ? { shopId } : {}),
      });
      if (!cancelled && response.ok) setResult(response.data);
    }, MERCHANT_LIMITS.timing.availabilityDebounceMs);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [normalised, shopId, tooShort]);

  const current = result && result.slug === normalised ? result : null;
  const checking = !tooShort && !current;
  const showStatus = !error && !tooShort;

  return (
    <Input
      label="Shop address"
      autoCapitalize="none"
      spellCheck={false}
      hint={
        <>
          <span className="block">texora.com/shops/{normalised || "your-shop"}</span>
          <span
            aria-live="polite"
            className={cn(
              "mt-1 flex min-h-5 items-center gap-1.5",
              current && (current.available ? "text-success" : "text-sale"),
            )}
          >
            {showStatus && checking && "Checking…"}
            {showStatus && current && (
              <>
                {current.available && <CheckIcon className="size-4" />}
                {current.available ? "Available" : current.message}
              </>
            )}
          </span>
        </>
      }
      error={error}
      {...inputProps}
    />
  );
}
