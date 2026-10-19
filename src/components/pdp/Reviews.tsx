"use client";

import NextLink from "next/link";
import { useId, useState, type FormEvent } from "react";
import { Rating } from "@/components/commerce/Rating";
import { Modal } from "@/components/feedback/Modal";
import { CheckIcon } from "@/components/icons";
import { Button, Chip, Input, Select } from "@/components/primitives";
import { useStorageItem } from "@/lib/browser/hooks";
import { readStorage, writeStorage } from "@/lib/browser/storage";
import type { ReviewView } from "@/lib/catalog/pdp";
import { submitReview, voteHelpful } from "@/lib/catalog/pdp-actions";
import { fitLabel, type ReviewSummary } from "@/lib/catalog/variant-selection";
import { cn } from "@/lib/utils/cn";

const PAGE = 5;
const VOTES_KEY = "texora-helpful-votes";
const SORTS = {
  newest: "Newest",
  helpful: "Most helpful",
  highest: "Highest rated",
  lowest: "Lowest rated",
} as const;
type ReviewSortKey = keyof typeof SORTS;

const FIT_SCALE = ["Runs small", "Slightly small", "True to size", "Slightly large", "Runs large"];
const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
});

function parseVotes(raw: string | null | undefined): string[] {
  try {
    const value: unknown = JSON.parse(raw ?? "[]");
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function FitMeter({ fit }: { fit: number }) {
  const position = ((fit + 1) / 2) * 100;
  return (
    <div>
      <p className="text-sm font-medium">How it fits</p>
      <div className="relative mt-3 h-1 bg-line" role="img" aria-label={`Fit: ${fitLabel(fit)}`}>
        <span
          className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink"
          style={{ left: `${position}%` }}
        />
      </div>
      <div className="mt-2 flex justify-between text-xs text-ink-subtle" aria-hidden>
        <span>Runs small</span>
        <span>True to size</span>
        <span>Runs large</span>
      </div>
    </div>
  );
}

function ReviewForm({
  productId,
  fitFamilies,
  onDone,
}: {
  productId: string;
  fitFamilies: string[];
  onDone: () => void;
}) {
  const id = useId();
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [fit, setFit] = useState(2);
  const [fitFamily, setFitFamily] = useState(fitFamilies[0] ?? "regular");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [state, setState] = useState<"idle" | "pending" | "done" | "signin">("idle");

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      setErrors({ rating: "Choose a star rating" });
      return;
    }
    setState("pending");
    const result = await submitReview({ productId, rating, title, body, fit: fit - 2, fitFamily });
    if (result.ok) {
      setState("done");
      return;
    }
    if (result.error.code === "unauthenticated" || result.error.code === "forbidden") {
      setState("signin");
      return;
    }
    setState("idle");
    const fe = result.error.fieldErrors ?? {};
    setErrors({
      title: fe.title?.[0] ?? "",
      body: fe.body?.[0] ?? "",
      form: fe.title || fe.body ? "" : result.error.message,
    });
  };

  if (state === "done") {
    return (
      <div role="status" className="flex flex-col gap-4">
        <p className="flex items-center gap-2 text-success">
          <CheckIcon /> Thank you. Your review will appear once it&apos;s been checked.
        </p>
        <Button variant="secondary" onClick={onDone} className="self-start">
          Close
        </Button>
      </div>
    );
  }

  if (state === "signin") {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-ink-soft">
          Reviews come from signed-in customers so we can verify purchases.
        </p>
        <NextLink
          href={`/auth/signin?next=${encodeURIComponent(window.location.pathname + "#reviews")}`}
          className="text-label underline underline-offset-4"
        >
          Sign in to write a review
        </NextLink>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Your rating</legend>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="cursor-pointer">
              <input
                type="radio"
                name={`${id}-rating`}
                value={n}
                checked={rating === n}
                onChange={() => {
                  setRating(n);
                  setErrors((e) => ({ ...e, rating: "" }));
                }}
                className="peer sr-only"
              />
              <span className="sr-only">
                {n} {n === 1 ? "star" : "stars"}
              </span>
              <svg
                viewBox="0 0 24 24"
                className={cn(
                  "size-8 peer-focus-visible:outline-2 peer-focus-visible:outline-focus",
                  n <= rating ? "text-ink" : "text-line",
                )}
                aria-hidden
              >
                <path
                  d="M12 3.5l2.6 5.3 5.9.9-4.25 4.15 1 5.85L12 16.95 6.75 19.7l1-5.85L3.5 9.7l5.9-.9z"
                  fill="currentColor"
                />
              </svg>
            </label>
          ))}
        </div>
        {errors.rating && (
          <p className="mt-2 text-sm text-sale" role="alert">
            {errors.rating}
          </p>
        )}
      </fieldset>
      <Input
        label="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        error={errors.title || undefined}
        required
      />
      <div className="flex flex-col gap-2">
        <label htmlFor={`${id}-body`} className="text-sm font-medium">
          Review
        </label>
        <textarea
          id={`${id}-body`}
          rows={5}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          aria-invalid={errors.body ? true : undefined}
          aria-describedby={errors.body ? `${id}-body-error` : undefined}
          className={cn(
            "w-full border bg-surface p-4 text-base outline-none hover:border-ink focus-visible:border-ink",
            errors.body ? "border-sale" : "border-ink-subtle",
          )}
        />
        {errors.body && (
          <p id={`${id}-body-error`} className="text-sm text-sale">
            {errors.body}
          </p>
        )}
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">How does it fit?</legend>
        <div className="grid grid-cols-5 gap-1">
          {FIT_SCALE.map((label, i) => (
            <label key={label} className="cursor-pointer">
              <input
                type="radio"
                name={`${id}-fit`}
                checked={fit === i}
                onChange={() => setFit(i)}
                className="peer sr-only"
              />
              <span
                className={cn(
                  "flex h-12 items-center justify-center border px-1 text-center text-xs peer-focus-visible:outline-2 peer-focus-visible:outline-focus",
                  fit === i ? "border-ink bg-ink text-surface" : "border-ink-subtle",
                )}
              >
                {label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {fitFamilies.length > 1 && (
        <Select
          label="Fit family you bought"
          value={fitFamily}
          onChange={(e) => setFitFamily(e.target.value)}
          options={fitFamilies.map((f) => ({
            value: f,
            label: f.charAt(0).toUpperCase() + f.slice(1),
          }))}
        />
      )}
      {errors.form && (
        <p role="alert" className="text-sm text-sale">
          {errors.form}
        </p>
      )}
      <Button type="submit" loading={state === "pending"} className="self-start">
        Submit review
      </Button>
    </form>
  );
}

interface ReviewsProps {
  productId: string;
  productName: string;
  reviews: ReviewView[];
  summary: ReviewSummary;
  fitFamilies: string[];
}

/** Aggregate, distribution, fit meter, filters, sort, helpful votes and the write form. */
export function Reviews({ productId, productName, reviews, summary, fitFamilies }: ReviewsProps) {
  const [ratingFilter, setRatingFilter] = useState<number | null>(null);
  const [fitFilter, setFitFilter] = useState<string>("all");
  const [sort, setSort] = useState<ReviewSortKey>("newest");
  const [shown, setShown] = useState(PAGE);
  const [writing, setWriting] = useState(false);
  const [helpful, setHelpful] = useState<Record<string, number>>({});
  const voted = parseVotes(useStorageItem("local", VOTES_KEY));

  const filtered = reviews
    .filter((r) => ratingFilter === null || r.rating === ratingFilter)
    .filter((r) => fitFilter === "all" || r.fitFamily === fitFilter)
    .sort((a, b) => {
      if (sort === "helpful")
        return (helpful[b.id] ?? b.helpfulCount) - (helpful[a.id] ?? a.helpfulCount);
      if (sort === "highest") return b.rating - a.rating;
      if (sort === "lowest") return a.rating - b.rating;
      return b.createdAt.localeCompare(a.createdAt);
    });

  const vote = async (reviewId: string, current: number) => {
    if (voted.includes(reviewId)) return;
    setHelpful((h) => ({ ...h, [reviewId]: current + 1 }));
    writeStorage(
      "local",
      VOTES_KEY,
      JSON.stringify([...parseVotes(readStorage("local", VOTES_KEY)), reviewId]),
    );
    const result = await voteHelpful({ reviewId });
    if (!result.ok) setHelpful((h) => ({ ...h, [reviewId]: current }));
  };

  return (
    <section
      id="reviews"
      aria-labelledby="reviews-title"
      className="container-page scroll-mt-24 section-y"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 id="reviews-title" className="font-display text-4xl">
          Reviews
        </h2>
        <Button variant="secondary" onClick={() => setWriting(true)}>
          Write a review
        </Button>
      </div>

      {summary.count === 0 ? (
        <p className="mt-6 text-ink-soft">No reviews yet. Be the first to share how it fits.</p>
      ) : (
        <div className="mt-10 grid gap-12 lg:grid-cols-[18rem_1fr]">
          <aside className="flex flex-col gap-8">
            <div>
              <p className="font-display text-5xl tabular-nums">{summary.average.toFixed(1)}</p>
              <Rating value={summary.average} count={summary.count} size="md" className="mt-2" />
              <p className="mt-2 text-sm text-ink-soft">
                {summary.recommendPercent}% would recommend
              </p>
            </div>
            <ul aria-label="Rating distribution" className="flex flex-col gap-2">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = summary.distribution[star - 1] ?? 0;
                const pct = summary.count ? (count / summary.count) * 100 : 0;
                return (
                  <li key={star}>
                    <button
                      type="button"
                      aria-pressed={ratingFilter === star}
                      disabled={count === 0}
                      onClick={() => {
                        setRatingFilter(ratingFilter === star ? null : star);
                        setShown(PAGE);
                      }}
                      className="flex w-full items-center gap-3 text-sm disabled:text-ink-subtle"
                    >
                      <span className="w-12 text-left tabular-nums">{star} star</span>
                      <span className="h-1.5 flex-1 bg-line">
                        <span
                          className={cn(
                            "block h-full",
                            ratingFilter === star ? "bg-accent" : "bg-ink",
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </span>
                      <span className="w-6 text-right text-ink-subtle tabular-nums">{count}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {summary.fit !== null && <FitMeter fit={summary.fit} />}
          </aside>

          <div>
            <div className="flex flex-wrap items-center gap-3 border-b border-line pb-4">
              <p aria-live="polite" className="mr-auto text-sm text-ink-soft tabular-nums">
                {filtered.length} {filtered.length === 1 ? "review" : "reviews"}
              </p>
              {ratingFilter !== null && (
                <Chip
                  variant="dismissible"
                  label={`${ratingFilter} star`}
                  onClick={() => setRatingFilter(null)}
                />
              )}
              {fitFamilies.length > 1 && (
                <Select
                  label="Filter by fit family"
                  hideLabel
                  value={fitFilter}
                  onChange={(e) => setFitFilter(e.target.value)}
                  options={[
                    { value: "all", label: "All fit families" },
                    ...fitFamilies.map((f) => ({
                      value: f,
                      label: f.charAt(0).toUpperCase() + f.slice(1),
                    })),
                  ]}
                  className="w-44"
                />
              )}
              <Select
                label="Sort reviews"
                hideLabel
                value={sort}
                onChange={(e) => setSort(e.target.value as ReviewSortKey)}
                options={Object.entries(SORTS).map(([value, label]) => ({ value, label }))}
                className="w-44"
              />
            </div>

            <ul className="divide-y divide-line">
              {filtered.slice(0, shown).map((r) => {
                const count = helpful[r.id] ?? r.helpfulCount;
                const hasVoted = voted.includes(r.id);
                return (
                  <li key={r.id} className="py-8">
                    <article aria-label={`Review by ${r.displayName}`}>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <Rating value={r.rating} showCount={false} />
                        <h3 className="font-medium">{r.title}</h3>
                      </div>
                      <p className="mt-1 text-xs text-ink-subtle">
                        {r.displayName} · {dateFormat.format(new Date(r.createdAt))}
                        {r.verifiedPurchase && (
                          <span className="ml-2 inline-flex items-center gap-1 text-success">
                            <CheckIcon size={20} className="size-3.5" /> Verified purchase
                          </span>
                        )}
                      </p>
                      <p className="mt-3 max-w-prose text-ink-soft">{r.body}</p>
                      {(r.fit !== undefined || r.fitFamily) && (
                        <p className="mt-3 text-xs text-ink-subtle">
                          {r.fit !== undefined && <>Fit: {FIT_SCALE[r.fit + 2]}</>}
                          {r.fitFamily && <> · Wears {r.fitFamily}</>}
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={() => vote(r.id, count)}
                        disabled={hasVoted}
                        aria-pressed={hasVoted}
                        className="mt-4 text-xs text-ink-soft underline underline-offset-4 disabled:no-underline"
                      >
                        {hasVoted ? "Thanks for your feedback" : "Helpful?"}{" "}
                        <span className="tabular-nums">({count})</span>
                      </button>
                    </article>
                  </li>
                );
              })}
            </ul>
            {filtered.length > shown && (
              <Button
                variant="secondary"
                onClick={() => setShown((n) => n + PAGE)}
                className="mt-4"
              >
                Show more reviews
              </Button>
            )}
          </div>
        </div>
      )}

      <Modal
        open={writing}
        onOpenChange={setWriting}
        title="Write a review"
        description={productName}
      >
        <ReviewForm
          productId={productId}
          fitFamilies={fitFamilies}
          onDone={() => setWriting(false)}
        />
      </Modal>
    </section>
  );
}
