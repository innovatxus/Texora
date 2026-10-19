import NextLink from "next/link";
import type { ComponentProps, ReactElement } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";
import { Spinner } from "./Spinner";

export const iconButtonVariants = cva(
  [
    "relative inline-flex shrink-0 items-center justify-center rounded-none text-ink",
    "transition-colors duration-fast ease-atelier",
    "disabled:cursor-not-allowed disabled:not-aria-busy:text-ink-subtle aria-busy:cursor-wait",
  ],
  {
    variants: {
      variant: {
        ghost: "bg-transparent not-disabled:hover:bg-surface-muted",
        outline: "border border-ink-subtle bg-transparent not-disabled:hover:border-ink",
        solid: "bg-surface not-disabled:hover:bg-surface-muted",
      },
      size: {
        sm: "size-9",
        md: "size-11",
      },
    },
    defaultVariants: { variant: "ghost", size: "md" },
  },
);

export interface IconButtonProps
  extends
    Omit<ComponentProps<"button">, "children" | "aria-label">,
    VariantProps<typeof iconButtonVariants> {
  /** Required accessible name: icon-only controls have no visible text. */
  label: string;
  icon: ReactElement;
  loading?: boolean;
}

export function IconButton({
  label,
  icon,
  variant,
  size,
  loading = false,
  disabled,
  type = "button",
  className,
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(iconButtonVariants({ variant, size }), className)}
      {...props}
    >
      {loading ? <Spinner /> : icon}
    </button>
  );
}

export interface IconLinkProps
  extends
    Omit<ComponentProps<typeof NextLink>, "children" | "aria-label">,
    VariantProps<typeof iconButtonVariants> {
  label: string;
  icon: ReactElement;
  /** Small count badge, e.g. bag items. Hidden when 0. */
  count?: number;
}

/** Icon-only navigation link (account, wishlist, bag) with the IconButton look. */
export function IconLink({
  label,
  icon,
  count,
  variant,
  size,
  className,
  ...props
}: IconLinkProps) {
  const accessibleLabel = count ? `${label}, ${count} ${count === 1 ? "item" : "items"}` : label;
  return (
    <NextLink
      aria-label={accessibleLabel}
      className={cn(iconButtonVariants({ variant, size }), className)}
      {...props}
    >
      {icon}
      {count ? (
        <span
          aria-hidden
          className="absolute top-1.5 right-1 flex size-4.5 items-center justify-center rounded-full bg-ink text-xs leading-none text-surface tabular-nums"
        >
          {count > 9 ? "9+" : count}
        </span>
      ) : null}
    </NextLink>
  );
}
