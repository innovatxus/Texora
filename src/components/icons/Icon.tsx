import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export type IconSize = 20 | 24;

export interface IconProps extends Omit<ComponentProps<"svg">, "children"> {
  /** Rendered size in px. The set is drawn on a 24px grid. */
  size?: IconSize;
  /**
   * Accessible name. Omit for decorative icons (the default), which are
   * hidden from assistive tech because the surrounding control is labelled.
   */
  label?: string;
}

interface BaseIconProps extends IconProps {
  children: ReactNode;
}

/**
 * Base for the ATELIER icon set: 24px grid, 1.25px stroke at every size
 * (non-scaling), round caps and joins, colour from `currentColor`.
 */
export function Icon({ size = 20, label, className, children, ...props }: BaseIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
      className={cn("shrink-0 [&_*]:[vector-effect:non-scaling-stroke]", className)}
      {...props}
    >
      {children}
    </svg>
  );
}
