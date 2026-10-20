import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

/** Divider styles: horizontal or vertical, subtle or strong. */
export const dividerVariants = cva("shrink-0 border-0", {
  variants: {
    orientation: {
      horizontal: "h-px w-full",
      vertical: "h-auto w-px self-stretch",
    },
    tone: {
      subtle: "bg-line",
      strong: "bg-line-strong",
    },
  },
  defaultVariants: { orientation: "horizontal", tone: "subtle" },
});

export interface DividerProps
  extends Omit<ComponentProps<"div">, "role">, VariantProps<typeof dividerVariants> {
  /** Purely visual dividers are hidden from assistive tech. */
  decorative?: boolean;
}

/** Visual separator line; decorative, so hidden from assistive technology. */
export function Divider({
  orientation,
  tone,
  decorative = false,
  className,
  ...props
}: DividerProps) {
  return (
    <div
      {...(decorative
        ? { "aria-hidden": true }
        : { role: "separator", "aria-orientation": orientation ?? "horizontal" })}
      className={cn(dividerVariants({ orientation, tone }), className)}
      {...props}
    />
  );
}
