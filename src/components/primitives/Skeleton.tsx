import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

export const skeletonVariants = cva("animate-pulse bg-surface-muted", {
  variants: {
    shape: {
      /** Images and blocks; size it with width/aspect classes to match the final layout. */
      block: "w-full",
      /** One line of body text. */
      text: "h-[1em] w-full",
      /** Product image placeholder at the 3:4 card ratio. */
      product: "aspect-[3/4] w-full",
    },
  },
  defaultVariants: { shape: "block" },
});

export interface SkeletonProps
  extends ComponentProps<"div">, VariantProps<typeof skeletonVariants> {}

/** Loading placeholder. Hidden from assistive tech: announce loading on the region instead (aria-busy). */
export function Skeleton({ shape, className, ...props }: SkeletonProps) {
  return <div aria-hidden className={cn(skeletonVariants({ shape }), className)} {...props} />;
}
