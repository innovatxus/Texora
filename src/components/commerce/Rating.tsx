import { useId } from "react";
import { cn } from "@/lib/utils/cn";

const STAR = "M12 3.5l2.6 5.3 5.9.9-4.25 4.15 1 5.85L12 16.95 6.75 19.7l1-5.85L3.5 9.7l5.9-.9z";

export interface RatingProps {
  value: number;
  count?: number;
  size?: "sm" | "md";
  /** Render the count next to the stars. */
  showCount?: boolean;
  className?: string;
}

/** Five stars with fractional fill; one accessible label for the whole group. */
export function Rating({ value, count, size = "sm", showCount = true, className }: RatingProps) {
  const id = useId();
  const clamped = Math.max(0, Math.min(5, value));
  const px = size === "sm" ? 14 : 18;
  const label =
    count === undefined
      ? `Rated ${clamped.toFixed(1)} out of 5`
      : `Rated ${clamped.toFixed(1)} out of 5 from ${count} ${count === 1 ? "review" : "reviews"}`;

  return (
    <span
      role="img"
      aria-label={label}
      className={cn("inline-flex items-center gap-1.5", className)}
    >
      <svg width={px * 5} height={px} viewBox="0 0 120 24" aria-hidden className="text-ink">
        <defs>
          <clipPath id={`${id}-fill`}>
            <rect x="0" y="0" width={(clamped / 5) * 120} height="24" />
          </clipPath>
        </defs>
        {[0, 1, 2, 3, 4].map((i) => (
          <path
            key={i}
            d={STAR}
            transform={`translate(${i * 24} 0)`}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.25"
          />
        ))}
        <g clipPath={`url(#${id}-fill)`}>
          {[0, 1, 2, 3, 4].map((i) => (
            <path key={i} d={STAR} transform={`translate(${i * 24} 0)`} fill="currentColor" />
          ))}
        </g>
      </svg>
      {showCount && count !== undefined && (
        <span className="text-xs text-ink-subtle tabular-nums">({count})</span>
      )}
    </span>
  );
}
