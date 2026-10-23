import NextLink from "next/link";
import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";
import { Spinner } from "./Spinner";

/** Button styles: primary, secondary and tertiary variants in two sizes, optionally full width. */
export const buttonVariants = cva(
  [
    "relative inline-flex items-center justify-center gap-2 rounded-none text-label whitespace-nowrap select-none",
    "transition-[color,background-color,border-color,box-shadow,transform] duration-base ease-atelier",
    "disabled:cursor-not-allowed aria-busy:cursor-wait aria-disabled:pointer-events-none",
  ],
  {
    variants: {
      variant: {
        primary: [
          "bg-ink text-surface not-disabled:hover:-translate-y-px not-disabled:hover:bg-brand not-disabled:hover:shadow-brand not-disabled:active:translate-y-0 not-disabled:active:bg-brand-strong not-disabled:active:shadow-none",
          "disabled:not-aria-busy:bg-surface-muted disabled:not-aria-busy:text-ink-subtle aria-disabled:not-aria-busy:bg-surface-muted aria-disabled:not-aria-busy:text-ink-subtle",
        ],
        secondary: [
          "border border-ink bg-transparent text-ink not-disabled:hover:border-brand not-disabled:hover:bg-brand not-disabled:hover:text-surface not-disabled:active:bg-brand-strong",
          "disabled:not-aria-busy:border-line disabled:not-aria-busy:text-ink-subtle aria-disabled:not-aria-busy:border-line aria-disabled:not-aria-busy:text-ink-subtle",
        ],
        tertiary: [
          "text-ink underline decoration-1 underline-offset-4 not-disabled:hover:text-brand not-disabled:hover:decoration-2",
          "disabled:not-aria-busy:text-ink-subtle disabled:not-aria-busy:no-underline aria-disabled:not-aria-busy:text-ink-subtle",
        ],
        inverse: [
          "bg-surface text-ink not-disabled:hover:bg-brand-tint not-disabled:hover:text-brand",
          "disabled:not-aria-busy:text-ink-subtle aria-disabled:not-aria-busy:text-ink-subtle",
        ],
      },
      size: {
        sm: "h-10 px-4",
        md: "h-12 px-6",
        lg: "h-14 px-8",
      },
      fullWidth: {
        true: "w-full",
        false: "",
      },
    },
    compoundVariants: [{ variant: "tertiary", class: "h-auto px-0" }],
    defaultVariants: { variant: "primary", size: "md", fullWidth: false },
  },
);

export type ButtonVariantProps = VariantProps<typeof buttonVariants>;

export interface ButtonProps extends ComponentProps<"button">, ButtonVariantProps {
  /** Shows a spinner, sets aria-busy and blocks interaction while keeping the label for screen readers. */
  loading?: boolean;
}

/** Button with variants and a loading state that keeps its width and disables it. */
export function Button({
  variant,
  size,
  fullWidth,
  loading = false,
  disabled,
  type = "button",
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(buttonVariants({ variant, size, fullWidth }), className)}
      {...props}
    >
      <span className={cn("inline-flex items-center gap-2", loading && "opacity-0")}>
        {children}
      </span>
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Spinner />
        </span>
      )}
    </button>
  );
}

export interface ButtonLinkProps extends ComponentProps<typeof NextLink>, ButtonVariantProps {}

/** A navigation link styled as a button. Use `Button` for actions. */
export function ButtonLink({ variant, size, fullWidth, className, ...props }: ButtonLinkProps) {
  return (
    <NextLink className={cn(buttonVariants({ variant, size, fullWidth }), className)} {...props} />
  );
}
