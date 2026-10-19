import NextLink from "next/link";
import { brand } from "@/config/brand";
import { cn } from "@/lib/utils/cn";

/** Self-drawn wordmark: the display serif, widely tracked. */
export function Logo({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <NextLink
      href="/"
      aria-label={`${brand.name} home`}
      className={cn(
        "inline-flex items-center font-display leading-none tracking-[0.28em] text-ink uppercase transition-[font-size] duration-base ease-atelier",
        compact ? "text-xl" : "text-2xl",
        className,
      )}
    >
      {brand.name}
    </NextLink>
  );
}

export function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only z-[60] bg-ink px-4 py-3 text-label text-surface focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
    >
      Skip to content
    </a>
  );
}
