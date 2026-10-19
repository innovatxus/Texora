import type { ComponentProps } from "react";
import { cn } from "@/lib/utils/cn";

/** Content for assistive technology only. */
export function VisuallyHidden({ className, ...props }: ComponentProps<"span">) {
  return <span className={cn("sr-only", className)} {...props} />;
}
