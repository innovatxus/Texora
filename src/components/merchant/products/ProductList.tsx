"use client";

import Image from "next/image";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FormMessage } from "@/components/merchant/forms/ErrorSummary";
import { Button, ButtonLink } from "@/components/primitives";
import { formatMoney } from "@/lib/format/money";
import { PRODUCT_STATUS_LABELS, PRODUCT_STATUS_TONES } from "@/lib/catalog/product-status";
import { bulkProductAction, updateStockAction } from "@/lib/merchant/actions/products";
import type { DraftListItem } from "@/lib/merchant/product-service";
import { cn } from "@/lib/utils/cn";

const TONE_CLASSES = {
  neutral: "border-line text-ink",
  success: "border-success text-success",
  warning: "border-warning text-warning",
  danger: "border-sale text-sale",
} as const;

function price(item: DraftListItem): string {
  const { priceMin, priceMax } = item.summary;
  if (priceMin === null) return "No price";
  return priceMin === priceMax || priceMax === null
    ? formatMoney(priceMin)
    : `${formatMoney(priceMin)}–${formatMoney(priceMax)}`;
}

/** Inline stock for one variant at one location: optimistic, rolled back if the server refuses. */
function StockEditor({
  item,
  locations,
}: {
  item: DraftListItem;
  locations: ReadonlyArray<{ id: string; name: string }>;
}) {
  const [rows, setRows] = useState(item.rows);
  const [key, setKey] = useState(item.rows[0]?.key ?? "");
  const [location, setLocation] = useState(locations[0]?.id ?? "");
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const current = rows.find((r) => r.key === key)?.stock[location] ?? 0;
  const [value, setValue] = useState(String(current));

  if (rows.length === 0 || locations.length === 0) return null;

  const save = async () => {
    const quantity = Number(value);
    if (!Number.isInteger(quantity) || quantity < 0) {
      setMessage({ tone: "error", text: "Enter a whole number" });
      return;
    }
    const before = rows;
    setRows((list) =>
      list.map((r) => (r.key === key ? { ...r, stock: { ...r.stock, [location]: quantity } } : r)),
    );
    const result = await updateStockAction({
      productId: item.id,
      key,
      locationId: location,
      quantity,
    });
    if (result.ok) setMessage({ tone: "success", text: "Stock saved" });
    else {
      setRows(before);
      setValue(String(before.find((r) => r.key === key)?.stock[location] ?? 0));
      setMessage({ tone: "error", text: `Stock not saved — ${result.error.message}` });
    }
  };

  return (
    <details className="text-sm">
      <summary className="min-h-11 cursor-pointer content-center underline underline-offset-4">
        Edit stock<span className="sr-only"> for {item.summary.name}</span>
      </summary>
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1">
          Variant
          <select
            value={key}
            onChange={(e) => {
              setKey(e.target.value);
              setValue(String(rows.find((r) => r.key === e.target.value)?.stock[location] ?? 0));
            }}
            className="h-11 max-w-56 border border-ink-subtle bg-surface px-2"
          >
            {rows.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          Location
          <select
            value={location}
            onChange={(e) => {
              setLocation(e.target.value);
              setValue(String(rows.find((r) => r.key === key)?.stock[e.target.value] ?? 0));
            }}
            className="h-11 border border-ink-subtle bg-surface px-2"
          >
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          Units
          <input
            inputMode="numeric"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="h-11 w-20 border border-ink-subtle bg-surface px-2"
          />
        </label>
        <Button type="button" variant="secondary" onClick={() => void save()}>
          Save stock
        </Button>
      </div>
      {message && (
        <div className="mt-2">
          <FormMessage tone={message.tone}>{message.text}</FormMessage>
        </div>
      )}
    </details>
  );
}

/**
 * The merchant's products: table or grid, row selection with bulk archive,
 * restore and duplicate, inline stock edits, and "Load more" paging.
 * Filters and sort live in the URL (handled by the page).
 */
export function ProductList({
  items,
  total,
  nextHref,
  locations,
  showingArchived,
}: {
  items: readonly DraftListItem[];
  total: number;
  nextHref: string | null;
  locations: ReadonlyArray<{ id: string; name: string }>;
  showingArchived: boolean;
}) {
  const router = useRouter();
  const [view, setView] = useState<"table" | "grid">("table");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (operation: "archive" | "restore" | "duplicate") =>
    startTransition(async () => {
      const result = await bulkProductAction({ productIds: [...selected], operation });
      if (!result.ok) {
        setMessage({ tone: "error", text: result.error.message });
        return;
      }
      const n = result.data.changed;
      const noun = `product${n === 1 ? "" : "s"}`;
      setMessage({
        tone: "success",
        text:
          operation === "duplicate"
            ? `${n} ${noun} duplicated`
            : operation === "archive"
              ? `${n} ${noun} archived`
              : `${n} ${noun} restored`,
      });
      setSelected(new Set());
      router.refresh();
    });

  const toggle = (id: string, on: boolean) =>
    setSelected((s) => {
      const next = new Set(s);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  const allSelected = items.length > 0 && items.every((i) => selected.has(i.id));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p aria-live="polite" className="text-sm text-ink-soft">
          {total} product{total === 1 ? "" : "s"}
          {selected.size > 0 && ` · ${selected.size} selected`}
        </p>
        <div role="group" aria-label="View" className="flex">
          {(["table", "grid"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={cn(
                "min-h-11 border border-ink-subtle px-4 text-sm",
                view === v && "bg-ink text-surface",
              )}
            >
              {v === "table" ? "Table" : "Grid"}
            </button>
          ))}
        </div>
      </div>

      {selected.size > 0 && (
        <div
          role="group"
          aria-label="Bulk actions"
          className="flex flex-wrap gap-3 border border-line bg-surface-muted p-3"
        >
          {showingArchived ? (
            <Button
              type="button"
              variant="secondary"
              loading={pending}
              onClick={() => run("restore")}
            >
              Restore
            </Button>
          ) : (
            <Button
              type="button"
              variant="secondary"
              loading={pending}
              onClick={() => run("archive")}
            >
              Archive
            </Button>
          )}
          <Button
            type="button"
            variant="secondary"
            loading={pending}
            onClick={() => run("duplicate")}
          >
            Duplicate
          </Button>
        </div>
      )}
      {message && <FormMessage tone={message.tone}>{message.text}</FormMessage>}

      {view === "table" ? (
        <div
          className="overflow-x-auto border border-line"
          role="region"
          aria-label="Products"
          tabIndex={0}
        >
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-surface">
              <tr className="border-b border-line">
                <th scope="col" className="w-12 px-3 py-2">
                  <input
                    type="checkbox"
                    aria-label="Select all products shown"
                    className="size-5 accent-ink"
                    checked={allSelected}
                    onChange={() =>
                      setSelected(allSelected ? new Set() : new Set(items.map((i) => i.id)))
                    }
                  />
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Product
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Status
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Price
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Stock
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Variants
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-line align-top">
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      aria-label={`Select ${item.summary.name}`}
                      className="size-5 accent-ink"
                      checked={selected.has(item.id)}
                      onChange={(e) => toggle(item.id, e.target.checked)}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-start gap-3">
                      <div className="relative size-14 shrink-0 overflow-hidden bg-surface-muted">
                        {item.summary.image && (
                          <Image
                            src={item.summary.image}
                            alt=""
                            fill
                            sizes="56px"
                            className="object-cover"
                          />
                        )}
                      </div>
                      <div className="flex flex-col gap-1">
                        <NextLink
                          href={`/merchant/products/${item.id}`}
                          className="font-medium underline-offset-4 hover:underline"
                        >
                          {item.summary.name}
                        </NextLink>
                        {item.styleId && (
                          <span className="text-xs text-ink-soft">{item.styleId}</span>
                        )}
                        <StockEditor item={item} locations={locations} />
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={cn(
                        "inline-block border px-2 py-0.5 text-xs",
                        TONE_CLASSES[PRODUCT_STATUS_TONES[item.status]],
                      )}
                    >
                      {PRODUCT_STATUS_LABELS[item.status]}
                    </span>
                  </td>
                  <td className="px-3 py-3 tabular-nums">{price(item)}</td>
                  <td className="px-3 py-3 tabular-nums">
                    {item.summary.stock}
                    {item.summary.lowStock && (
                      <span className="ml-2 text-xs text-warning">Low</span>
                    )}
                  </td>
                  <td className="px-3 py-3 tabular-nums">{item.summary.variants}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => (
            <li key={item.id} className="flex flex-col gap-2 border border-line bg-surface p-3">
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-5 accent-ink"
                  checked={selected.has(item.id)}
                  onChange={(e) => toggle(item.id, e.target.checked)}
                />
                <span className="sr-only">Select {item.summary.name}</span>
                {PRODUCT_STATUS_LABELS[item.status]}
              </label>
              <div className="relative aspect-[3/4] overflow-hidden bg-surface-muted">
                {item.summary.image && (
                  <Image
                    src={item.summary.image}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 20vw, 45vw"
                    className="object-cover"
                  />
                )}
              </div>
              <NextLink
                href={`/merchant/products/${item.id}`}
                className="font-medium hover:underline"
              >
                {item.summary.name}
              </NextLink>
              <p className="text-sm text-ink-soft">
                {price(item)} · {item.summary.stock} in stock
              </p>
            </li>
          ))}
        </ul>
      )}

      {nextHref && (
        <ButtonLink href={nextHref} variant="secondary" className="self-center" scroll={false}>
          Load more
        </ButtonLink>
      )}
    </div>
  );
}
