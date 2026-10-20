import NextLink from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Back office building blocks. Same tokens as the storefront, in the denser
 * "admin" rhythm: smaller type, tighter spacing, tables over cards.
 */

/** Page title row with an optional description and actions on the right. */
export function AdminPageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
      <div>
        {eyebrow && <p className="text-label text-ink-subtle">{eyebrow}</p>}
        <h1 className="font-display text-3xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-soft">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** A headline number with a label and optional context line. */
export function StatCard({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  href?: string;
}) {
  const body = (
    <>
      <p className="text-label text-ink-subtle">{label}</p>
      <p className="mt-2 text-3xl font-medium tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-soft">{hint}</p>}
    </>
  );
  const className = "block border border-line bg-surface p-4";
  return href ? (
    <NextLink href={href} className={cn(className, "transition-colors hover:border-ink")}>
      {body}
    </NextLink>
  ) : (
    <div className={className}>{body}</div>
  );
}

/** A titled panel. */
export function Panel({
  title,
  actions,
  children,
  className,
}: {
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-label={title}
      className={cn("border border-line bg-surface p-4 text-sm", className)}
    >
      {(title || actions) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          {title && <h2 className="text-label">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
  align?: "left" | "right";
  className?: string;
}

/** Dense, accessible data table with a caption and an empty state. */
export function DataTable<T>({
  caption,
  columns,
  rows,
  rowKey,
  empty = "Nothing to show.",
}: {
  caption: string;
  columns: ReadonlyArray<Column<T>>;
  rows: readonly T[];
  rowKey: (row: T) => string;
  empty?: ReactNode;
}) {
  if (rows.length === 0) {
    return <p className="border border-dashed border-line p-6 text-sm text-ink-soft">{empty}</p>;
  }
  return (
    <div className="overflow-x-auto border border-line bg-surface">
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-line text-left text-xs text-ink-subtle">
            {columns.map((c) => (
              <th
                key={c.header}
                scope="col"
                className={cn(
                  "px-3 py-2 font-medium whitespace-nowrap",
                  c.align === "right" && "text-right",
                )}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className="border-b border-line last:border-0 hover:bg-canvas">
              {columns.map((c) => (
                <td
                  key={c.header}
                  className={cn(
                    "px-3 py-2 align-top",
                    c.align === "right" && "text-right tabular-nums",
                    c.className,
                  )}
                >
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const PILL_TONES = {
  neutral: "bg-surface-muted text-ink",
  success: "bg-surface-muted text-success",
  warning: "bg-surface-muted text-warning",
  danger: "bg-surface-muted text-sale",
} as const;

/** Small status label. */
export function StatusPill({
  tone = "neutral",
  children,
}: {
  tone?: keyof typeof PILL_TONES;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 text-xs whitespace-nowrap",
        PILL_TONES[tone],
      )}
    >
      {children}
    </span>
  );
}

/** "Next page" link for cursor pagination; keeps the other query parameters. */
export function CursorPagination({
  basePath,
  params,
  nextCursor,
  hasPrevious,
}: {
  basePath: string;
  params: Record<string, string | undefined>;
  nextCursor: string | null;
  hasPrevious: boolean;
}) {
  const query = (cursor?: string) => {
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v && k !== "cursor") search.set(k, v);
    if (cursor) search.set("cursor", cursor);
    const s = search.toString();
    return s ? `${basePath}?${s}` : basePath;
  };
  if (!nextCursor && !hasPrevious) return null;
  return (
    <nav aria-label="Pagination" className="flex justify-between text-sm">
      {hasPrevious ? (
        <NextLink href={query()} className="underline underline-offset-4">
          First page
        </NextLink>
      ) : (
        <span />
      )}
      {nextCursor && (
        <NextLink href={query(nextCursor)} className="underline underline-offset-4">
          Next page
        </NextLink>
      )}
    </nav>
  );
}

/**
 * Filter bar as a plain GET form: works without JavaScript and keeps
 * filters in the URL, so filtered views can be shared and bookmarked.
 */
export function FilterBar({ action, children }: { action: string; children: ReactNode }) {
  return (
    <form
      action={action}
      method="get"
      role="search"
      className="flex flex-wrap items-end gap-3 border border-line bg-surface p-3 text-sm"
    >
      {children}
      <button
        type="submit"
        className="h-10 border border-ink px-4 text-label hover:bg-ink hover:text-surface"
      >
        Apply
      </button>
      <NextLink href={action} className="h-10 px-2 leading-10 underline underline-offset-4">
        Reset
      </NextLink>
    </form>
  );
}

/** Compact native field for filter bars and admin forms. */
export function AdminField({
  label,
  children,
  hint,
  className,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <label className={cn("flex flex-col gap-1 text-xs text-ink-soft", className)}>
      {label}
      {children}
      {hint && <span className="text-ink-subtle">{hint}</span>}
    </label>
  );
}

/** Shared classes for compact native inputs and selects. */
export const adminControl =
  "h-10 min-w-0 border border-ink-subtle bg-surface px-3 text-sm text-ink hover:border-ink focus-visible:border-ink";

/** Definition list of label/value pairs. */
export function DetailList({ items }: { items: ReadonlyArray<[string, ReactNode]> }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
      {items.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-ink-subtle">{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
