"use client";

import NextLink from "next/link";
import { useCallback, useState } from "react";
import { DetailsAccordion } from "@/components/pdp/DetailsAccordion";
import { Button } from "@/components/primitives";
import { MERCHANT_LIMITS } from "@/config/merchant";
import type { ProductDraftData } from "@/lib/validation/merchant";
import { AttributesSection } from "./AttributesSection";
import { BasicsSection } from "./BasicsSection";
import { MediaSection } from "./MediaSection";
import { DetailsSection, SeoSection, ShippingSection } from "./MoreSections";
import { OptionsSection } from "./OptionsSection";
import type { DraftUpdate, EditorContext, SectionProps } from "./types";
import { saveStateLabel, useAutosave } from "./useAutosave";
import { useMediaQuery } from "./useMediaQuery";

const SECTIONS = [
  { id: "basics", title: "Basics", Component: BasicsSection },
  { id: "attributes", title: "Attributes", Component: AttributesSection },
  { id: "options", title: "Options", Component: OptionsSection },
  { id: "media", title: "Media", Component: MediaSection },
  { id: "details", title: "Details", Component: DetailsSection },
  { id: "shipping", title: "Shipping", Component: ShippingSection },
  { id: "seo", title: "Visibility & SEO", Component: SeoSection },
] as const;

/**
 * The product editor (journey §9): one long form with a sticky section nav
 * on desktop and accordions on phones, autosaved 5 seconds after the last
 * change, with an unsaved-changes guard and a sticky footer. Loaded with a
 * dynamic import so its code only reaches this page.
 */
export function ProductEditor({
  initialData,
  context,
  footerExtra,
  errors = {},
}: {
  initialData: ProductDraftData;
  context: EditorContext;
  /** Submit / publish controls (added with review and publishing). */
  footerExtra?: (state: {
    data: ProductDraftData;
    dirty: boolean;
    saveNow: () => Promise<boolean>;
  }) => React.ReactNode;
  errors?: Readonly<Record<string, string>>;
}) {
  const [data, setData] = useState(initialData);
  const [saved, setSaved] = useState(initialData);
  const dirty = data !== saved;

  const update: DraftUpdate = useCallback(
    (change) =>
      setData((current) => ({
        ...current,
        ...(typeof change === "function" ? change(current) : change),
      })),
    [],
  );
  const onSaved = useCallback(
    (_summary: unknown, savedData: ProductDraftData) => setSaved(savedData),
    [],
  );
  const { state, saveNow } = useAutosave({
    productId: context.productId,
    initialVersion: context.version,
    data,
    dirty,
    idleMs: MERCHANT_LIMITS.timing.autosaveIdleMs,
    onSaved,
  });

  const compact = useMediaQuery("(max-width: 1023px)");
  const props: SectionProps = { data, update, context, errors };
  const label = saveStateLabel(state, dirty);

  return (
    <div className="flex flex-col gap-6 pb-28">
      {context.reviewNotes.length > 0 && (
        <div
          role="region"
          aria-label="Changes requested"
          className="border border-sale bg-surface p-4 text-sm"
        >
          <p className="font-medium">We need a few changes before this product goes live:</p>
          <ul className="mt-2 list-disc pl-5">
            {context.reviewNotes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
          <p className="mt-2 text-ink-soft">Resubmit when ready.</p>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[12rem_minmax(0,1fr)]">
        <nav aria-label="Editor sections" className={compact ? "hidden" : "block"}>
          <ul className="sticky top-6 flex flex-col text-sm">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a
                  href={`#section-${s.id}`}
                  className="flex min-h-11 items-center px-3 hover:bg-surface-muted"
                >
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0">
          {compact ? (
            // Phones and tablets: accordions.
            <DetailsAccordion
              defaultOpen={["basics"]}
              sections={SECTIONS.map(({ id, title, Component }) => ({
                id,
                title,
                content: <Component {...props} />,
              }))}
            />
          ) : (
            // Desktop: all sections in one form.
            <div className="flex flex-col gap-12">
              {SECTIONS.map(({ id, title, Component }) => (
                <section
                  key={id}
                  id={`section-${id}`}
                  aria-labelledby={`heading-${id}`}
                  className="scroll-mt-6"
                >
                  <h2 id={`heading-${id}`} className="mb-6 font-display text-2xl">
                    {title}
                  </h2>
                  <Component {...props} />
                </section>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-16 z-20 border-t border-line bg-canvas/95 backdrop-blur lg:bottom-0 lg:left-56">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <p role="status" aria-live="polite" className="text-sm text-ink-soft">
            {label}
            {state.kind === "conflict" && (
              <>
                {" "}
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="underline underline-offset-4"
                >
                  Reload
                </button>
              </>
            )}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => void saveNow()}
              loading={state.kind === "saving"}
              disabled={!dirty}
            >
              Save draft
            </Button>
            <NextLink
              href={context.previewHref}
              target="_blank"
              className="inline-flex min-h-11 items-center px-3 text-sm underline underline-offset-4"
              onClick={async (e) => {
                if (dirty) {
                  e.preventDefault();
                  if (await saveNow()) window.open(context.previewHref, "_blank");
                }
              }}
            >
              Preview<span className="sr-only"> (opens in a new tab)</span>
            </NextLink>
            {footerExtra?.({ data, dirty, saveNow })}
          </div>
        </div>
      </div>
    </div>
  );
}
