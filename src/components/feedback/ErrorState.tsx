import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export interface ErrorStateProps {
  /** Short eyebrow, e.g. "Error 403". */
  eyebrow?: string;
  title: string;
  description: ReactNode;
  /** Buttons or links offering a way forward. */
  actions?: ReactNode;
  /** Use "page" for full-page states (route errors), "inline" inside a section. */
  layout?: "page" | "inline";
  className?: string;
}

/** Branded empty/error message with a clear next step. */
export function ErrorState({
  eyebrow,
  title,
  description,
  actions,
  layout = "inline",
  className,
}: ErrorStateProps) {
  const Heading = layout === "page" ? "h1" : "h2";
  return (
    <div
      className={cn(
        "flex flex-col items-center text-center",
        layout === "page" ? "container-page flex-1 justify-center section-y" : "py-12",
        className,
      )}
    >
      {eyebrow && <p className="text-label text-ink-subtle">{eyebrow}</p>}
      <Heading
        className={cn(
          "font-display",
          eyebrow && "mt-4",
          layout === "page" ? "text-4xl" : "text-2xl",
        )}
      >
        {title}
      </Heading>
      <div className="mt-4 max-w-md text-ink-soft">{description}</div>
      {actions && <div className="mt-8 flex flex-wrap justify-center gap-3">{actions}</div>}
    </div>
  );
}
