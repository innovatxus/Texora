import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

export const badgeVariants = cva(
  "inline-flex items-center rounded-none px-2 py-1 text-label leading-none whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "bg-surface text-ink",
        muted: "bg-surface-muted text-ink",
        inverse: "bg-ink text-surface",
        sale: "bg-surface text-sale",
        success: "bg-surface text-success",
        warning: "bg-surface text-warning",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export interface BadgeProps extends ComponentProps<"span">, VariantProps<typeof badgeVariants> {}

/** Short status label (New, Sale −30%, Final sale, Low stock). */
export function Badge({ tone, className, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
