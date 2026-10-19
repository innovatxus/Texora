"use client";

import { useState } from "react";
import { HeartIcon } from "@/components/icons";
import { cn } from "@/lib/utils/cn";
import { useWishlistStore } from "@/stores/wishlist";

export interface WishlistButtonProps {
  productId: string;
  productName: string;
  color?: string;
  price: number;
  variant?: "overlay" | "inline";
  className?: string;
}

/** Optimistic save toggle with a short pop animation and a stateful accessible name. */
export function WishlistButton({
  productId,
  productName,
  color,
  price,
  variant = "overlay",
  className,
}: WishlistButtonProps) {
  const saved = useWishlistStore((s) => s.items.some((i) => i.productId === productId));
  const toggle = useWishlistStore((s) => s.toggle);
  const [pulse, setPulse] = useState(false);

  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={saved ? `Remove ${productName} from wishlist` : `Save ${productName} to wishlist`}
      onClick={() => {
        const added = toggle({ productId, ...(color ? { color } : {}), priceAtAdd: price });
        setPulse(added);
      }}
      onAnimationEnd={() => setPulse(false)}
      className={cn(
        "inline-flex items-center justify-center text-ink transition-colors duration-fast",
        variant === "overlay"
          ? "size-10 bg-surface/90 hover:bg-surface"
          : "size-12 border border-ink-subtle hover:border-ink",
        className,
      )}
    >
      <HeartIcon
        filled={saved}
        className={cn(pulse && "animate-[wishlist-pop_400ms_var(--ease-atelier)]")}
      />
    </button>
  );
}
