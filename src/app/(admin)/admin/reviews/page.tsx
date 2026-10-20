import type { Metadata } from "next";
import NextLink from "next/link";
import { Suspense } from "react";
import { ActionButton } from "@/components/admin/ActionButton";
import { AdminLoading } from "@/components/admin/AdminLoading";
import { formatDateTime } from "@/components/admin/status";
import { AdminPageHeader, StatusPill } from "@/components/admin/ui";
import { Rating } from "@/components/commerce/Rating";
import { listReviewQueue } from "@/lib/admin/merch-service";
import { moderateReviewAction } from "@/lib/admin/ops-actions";
import { requirePagePermission } from "@/lib/auth/guard";
import { fitLabel } from "@/lib/catalog/variant-selection";

/** Reviews title. */
export const metadata: Metadata = { title: "Reviews" };

async function Reviews() {
  await requirePagePermission("reviews.moderate");
  const queue = await listReviewQueue();
  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader
        title="Reviews"
        description={`${queue.length} waiting. Approved reviews appear on the product page and update its rating.`}
      />
      {queue.length === 0 ? (
        <p className="border border-dashed border-line p-6 text-sm text-ink-soft">
          Nothing to moderate.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {queue.map((r) => (
            <li key={r.id} className="border border-line bg-surface p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <Rating value={r.rating} />
                  <span className="font-medium">{r.title}</span>
                  {r.verifiedPurchase && <StatusPill tone="success">Verified purchase</StatusPill>}
                </div>
                <span className="text-xs text-ink-soft">
                  {r.displayName} · {formatDateTime(r.createdAt)} ·{" "}
                  <NextLink href={`/admin/catalog/${r.productId}`} className="underline">
                    product
                  </NextLink>
                </span>
              </div>
              <p className="mt-2 whitespace-pre-line text-ink-soft">{r.body}</p>
              {(r.fit !== undefined || r.sizePurchased) && (
                <p className="mt-2 text-xs text-ink-subtle">
                  {r.sizePurchased && `Size ${r.sizePurchased}`}
                  {r.fit !== undefined && ` · ${fitLabel(r.fit / 2) ?? "True to size"}`}
                </p>
              )}
              <div className="mt-3 flex gap-2">
                <ActionButton
                  action={moderateReviewAction}
                  payload={{ reviewId: r.id, decision: "approved" }}
                  variant="primary"
                >
                  Approve
                </ActionButton>
                <ActionButton
                  action={moderateReviewAction}
                  payload={{ reviewId: r.id, decision: "rejected" }}
                >
                  Reject
                </ActionButton>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Review moderation queue, oldest first. */
export default function Page() {
  return (
    <Suspense fallback={<AdminLoading />}>
      <Reviews />
    </Suspense>
  );
}
