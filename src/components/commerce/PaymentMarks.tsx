import { PAYMENT_MARKS } from "@/config/payments";
import { cn } from "@/lib/utils/cn";

/** The payment methods we accept, as small badges (or official marks when configured). */
export function PaymentMarks({ className }: { className?: string }) {
  return (
    <ul
      aria-label="Payment methods we accept"
      className={cn("flex flex-wrap items-center gap-2", className)}
    >
      {PAYMENT_MARKS.map((mark) => (
        <li
          key={mark.id}
          title={mark.label}
          className="rounded-sm flex h-8 min-w-12 items-center justify-center border border-line bg-surface px-2"
        >
          {mark.logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- tiny static SVG marks
            <img src={mark.logo} alt={mark.label} height={20} className="h-5 w-auto" />
          ) : (
            <span
              aria-label={mark.label}
              role="img"
              className={cn(
                "text-[11px] leading-none font-semibold whitespace-nowrap text-ink",
                mark.id === "visa" && "tracking-[0.12em] italic",
              )}
            >
              {mark.badge}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
