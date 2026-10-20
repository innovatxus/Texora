import type { ReactNode } from "react";
import { Divider } from "@/components/primitives";

interface SectionProps {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
}

/** A titled styleguide section with an anchor id. */
export function Section({ id, title, description, children }: SectionProps) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="scroll-mt-8 py-12"
      data-testid={`sg-${id}`}
    >
      <h2 id={`${id}-title`} className="font-display text-3xl">
        {title}
      </h2>
      {description && <p className="mt-2 max-w-2xl text-ink-soft">{description}</p>}
      <div className="mt-8">{children}</div>
      <Divider decorative className="mt-12" />
    </section>
  );
}

interface SpecimenProps {
  label: string;
  /** Set when the specimen sits on an ink background. */
  inverse?: boolean;
  children: ReactNode;
}

/** A labelled example of a component state, optionally on a dark background. */
export function Specimen({ label, inverse = false, children }: SpecimenProps) {
  return (
    <div className="flex flex-col gap-3">
      <p className={inverse ? "text-xs text-canvas" : "text-xs text-ink-subtle"}>{label}</p>
      <div className="flex flex-wrap items-center gap-4">{children}</div>
    </div>
  );
}
