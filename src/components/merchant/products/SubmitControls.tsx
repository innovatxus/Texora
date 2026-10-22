"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Modal } from "@/components/feedback/Modal";
import { Button } from "@/components/primitives";
import { submitProductAction, unpublishProductAction } from "@/lib/merchant/actions/products";
import type { PublishProblem } from "@/lib/merchant/publishing/validate";
import type { ProductStatus } from "@/lib/validation/catalog";

/**
 * "Submit for review" (or "Publish" for trusted merchants, "Submit changes"
 * for a live product) and "Unpublish". Saves first; if anything blocks
 * publishing, a dialog lists every problem with a link to the field.
 */
export function SubmitControls({
  productId,
  status,
  trusted,
  dirty,
  saveNow,
}: {
  productId: string;
  status: ProductStatus;
  trusted: boolean;
  dirty: boolean;
  saveNow: () => Promise<boolean>;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [problems, setProblems] = useState<PublishProblem[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const label = trusted ? "Publish" : status === "live" ? "Submit changes" : "Submit for review";
  const canSubmit = status !== "in_review" && status !== "archived";

  const submit = async () => {
    setPending(true);
    setMessage(null);
    if (dirty && !(await saveNow())) {
      setPending(false);
      setMessage("Save your changes first.");
      return;
    }
    const result = await submitProductAction({ productId });
    setPending(false);
    if (!result.ok) {
      setMessage(result.error.message);
      return;
    }
    if (result.data.problems.length > 0) {
      setProblems(result.data.problems);
      return;
    }
    setMessage(
      result.data.status === "in_review"
        ? "Submitted for review — we usually reply within 1 business day."
        : result.data.status === "scheduled"
          ? "Scheduled. It goes live at the time you set."
          : "Published. It can take a minute to appear in search.",
    );
    router.refresh();
  };

  const unpublish = async () => {
    if (!window.confirm("Take this product off sale? It stays as a draft.")) return;
    setPending(true);
    const result = await unpublishProductAction({ productId });
    setPending(false);
    setMessage(result.ok ? "Unpublished. It's a draft again." : result.error.message);
    if (result.ok) router.refresh();
  };

  return (
    <>
      {message && (
        <p role="status" className="w-full text-sm text-ink-soft sm:w-auto">
          {message}
        </p>
      )}
      {(status === "live" || status === "scheduled" || status === "in_review") && (
        <Button
          type="button"
          variant="tertiary"
          onClick={() => void unpublish()}
          disabled={pending}
        >
          Unpublish
        </Button>
      )}
      {canSubmit && (
        <Button type="button" onClick={() => void submit()} loading={pending}>
          {label}
        </Button>
      )}
      {problems && (
        <Modal
          open
          onOpenChange={(open) => !open && setProblems(null)}
          title="Before this can go live"
          description="Fix these, then submit again."
        >
          <ul className="flex list-disc flex-col gap-2 pl-5 text-sm">
            {problems.map((p) => (
              <li key={p.message}>
                {p.field ? (
                  <a
                    href={`#${p.field}`}
                    onClick={() => setProblems(null)}
                    className="underline underline-offset-4"
                  >
                    {p.message}
                  </a>
                ) : (
                  p.message
                )}
              </li>
            ))}
          </ul>
        </Modal>
      )}
    </>
  );
}
