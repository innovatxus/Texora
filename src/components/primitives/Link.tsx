import NextLink from "next/link";
import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";
import { VisuallyHidden } from "./VisuallyHidden";

export const linkVariants = cva("transition-colors duration-fast ease-atelier", {
  variants: {
    variant: {
      /** Links inside running text. */
      inline: "text-ink underline decoration-1 underline-offset-4 hover:text-accent",
      /** Lists of links (footer, account menus): underline on hover only. */
      quiet: "text-ink-soft underline-offset-4 hover:text-ink hover:underline",
      /** Primary navigation labels. */
      nav: "text-label text-ink underline-offset-8 hover:underline",
    },
  },
  defaultVariants: { variant: "inline" },
});

export interface LinkProps
  extends ComponentProps<typeof NextLink>, VariantProps<typeof linkVariants> {
  /** Open in a new tab. Defaults to true for absolute http(s) URLs. */
  external?: boolean;
}

function isAbsoluteUrl(href: LinkProps["href"]): boolean {
  return typeof href === "string" && /^https?:\/\//.test(href);
}

export function Link({ variant, external, className, children, ...props }: LinkProps) {
  const opensNewTab = external ?? isAbsoluteUrl(props.href);
  return (
    <NextLink
      className={cn(linkVariants({ variant }), className)}
      {...(opensNewTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      {...props}
    >
      {children}
      {opensNewTab && <VisuallyHidden> (opens in a new tab)</VisuallyHidden>}
    </NextLink>
  );
}
