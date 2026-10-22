"use client";

import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/primitives";
import { centsToInput, parseDollars } from "@/lib/format/money";
import { applyBulk, filterRows, type MatrixRow } from "@/lib/merchant/variants/matrix";
import type { FitFamily } from "@/lib/validation/common";
import { FIT_LABELS } from "@/lib/validation/common";
import type { EditorLocation } from "./types";
import { useMediaQuery } from "./useMediaQuery";

const ROW_HEIGHT = 56;
const VIEWPORT_ROWS = 10;
const OVERSCAN = 6;

type Column =
  | "sku"
  | "price"
  | "compareAtPrice"
  | `stock:${string}`
  | "barcode"
  | "weightGrams"
  | "lowStockThreshold";

/**
 * A text cell that commits on blur or Enter and reverts on Escape. Arrow up
 * and down (and Enter) move to the same column in the neighbouring row, like
 * a spreadsheet.
 */
function Cell({
  value,
  onCommit,
  label,
  row,
  column,
  inputMode,
  parse,
  invalid,
  onNavigate,
}: {
  value: string;
  onCommit: (raw: string) => boolean;
  label: string;
  row: number;
  column: Column;
  inputMode?: "decimal" | "numeric" | "text";
  parse?: "money" | "int" | "text";
  invalid?: boolean;
  onNavigate: (row: number, column: Column, delta: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const start = useRef(value);
  const shown = draft ?? value;

  const commit = () => {
    if (draft === null) return;
    if (onCommit(draft)) setDraft(null);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setDraft(null);
      event.currentTarget.value = start.current;
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter") {
      event.preventDefault();
      commit();
      onNavigate(row, column, event.key === "ArrowUp" ? -1 : 1);
    }
  };

  return (
    <input
      aria-label={label}
      data-cell={`${row}:${column}`}
      inputMode={inputMode}
      value={shown}
      aria-invalid={invalid || undefined}
      onFocus={() => {
        start.current = value;
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={onKeyDown}
      className={`h-11 w-full min-w-0 border bg-surface px-2 text-sm tabular-nums ${
        invalid ||
        (draft !== null && parse === "money" && parseDollars(draft) === null && draft !== "")
          ? "border-sale"
          : "border-ink-subtle"
      }`}
    />
  );
}

/**
 * The variant matrix: per-variant SKU, price, compare-at, stock per
 * location, barcode, weight, online and backorder flags and low-stock
 * threshold. Filters, row selection and a bulk-edit bar; virtualised for
 * long matrices; per-colour cards on phones.
 */
export function VariantMatrix({
  rows,
  colorNames,
  locations,
  onChange,
  onExclude,
}: {
  rows: readonly MatrixRow[];
  colorNames: Readonly<Record<string, string>>;
  locations: readonly EditorLocation[];
  onChange: (rows: MatrixRow[]) => void;
  onExclude: (key: string) => void;
}) {
  const mobile = useMediaQuery("(max-width: 767px)");
  const [filter, setFilter] = useState<{ color?: string; fit?: FitFamily; size?: string }>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [scrollTop, setScrollTop] = useState(0);
  const [bulk, setBulk] = useState({
    price: "",
    stock: "",
    location: locations[0]?.id ?? "",
    weight: "",
  });
  const [bulkMessage, setBulkMessage] = useState("");
  const scroller = useRef<HTMLDivElement | null>(null);

  const visible = useMemo(() => filterRows(rows, filter), [rows, filter]);
  const colors = [...new Set(rows.map((r) => r.color))];
  const fits = [...new Set(rows.map((r) => r.fit))];
  const sizes = [...new Set(rows.map((r) => r.size))];
  const columns: Column[] = [
    "sku",
    "price",
    "compareAtPrice",
    ...locations.map((l) => `stock:${l.id}` as const),
    "barcode",
    "weightGrams",
    "lowStockThreshold",
  ];

  const patchRow = (key: string, patch: Partial<MatrixRow>) =>
    onChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const label = (r: MatrixRow) =>
    `${colorNames[r.color] ?? r.color}, ${FIT_LABELS[r.fit]}, ${r.size}`;

  const commit = (r: MatrixRow, column: Column, raw: string): boolean => {
    const trimmed = raw.trim();
    if (column === "price" || column === "compareAtPrice") {
      const cents = trimmed === "" ? null : parseDollars(trimmed);
      if (trimmed !== "" && cents === null) return false;
      patchRow(r.key, { [column]: cents });
      return true;
    }
    if (column.startsWith("stock:")) {
      const quantity = trimmed === "" ? 0 : Number(trimmed);
      if (!Number.isInteger(quantity) || quantity < 0) return false;
      patchRow(r.key, { stock: { ...r.stock, [column.slice(6)]: quantity } });
      return true;
    }
    if (column === "weightGrams" || column === "lowStockThreshold") {
      const n = trimmed === "" ? null : Number(trimmed);
      if (n !== null && (!Number.isInteger(n) || n < 0)) return false;
      patchRow(
        r.key,
        column === "weightGrams" ? { weightGrams: n } : { lowStockThreshold: n ?? 0 },
      );
      return true;
    }
    patchRow(r.key, { [column]: column === "sku" ? trimmed.toUpperCase() : trimmed });
    return true;
  };

  const navigate = (row: number, column: Column, delta: number) => {
    const next = row + delta;
    if (next < 0 || next >= visible.length) return;
    const focus = () =>
      document.querySelector<HTMLInputElement>(`[data-cell="${next}:${column}"]`)?.focus();
    if (scroller.current && !mobile) {
      const top = next * ROW_HEIGHT;
      const el = scroller.current;
      if (top < el.scrollTop) el.scrollTop = top;
      else if (top + ROW_HEIGHT > el.scrollTop + el.clientHeight)
        el.scrollTop = top + ROW_HEIGHT - el.clientHeight;
      requestAnimationFrame(focus);
    } else focus();
  };

  const value = (r: MatrixRow, column: Column): string => {
    if (column === "price" || column === "compareAtPrice") return centsToInput(r[column]);
    if (column.startsWith("stock:")) return String(r.stock[column.slice(6)] ?? 0);
    if (column === "weightGrams") return r.weightGrams === null ? "" : String(r.weightGrams);
    if (column === "lowStockThreshold") return String(r.lowStockThreshold);
    return r[column as "sku" | "barcode"];
  };

  const columnLabel = (column: Column) => {
    if (column.startsWith("stock:")) {
      return `Stock: ${locations.find((l) => l.id === column.slice(6))?.name ?? "location"}`;
    }
    return {
      sku: "SKU",
      price: "Price ($)",
      compareAtPrice: "Compare-at ($)",
      barcode: "Barcode",
      weightGrams: "Weight (g)",
      lowStockThreshold: "Low stock at",
    }[column as "sku"];
  };

  const applyToSelected = (patchName: "price" | "stock" | "weight") => {
    const keys = new Set([...selected].filter((k) => visible.some((r) => r.key === k)));
    if (keys.size === 0) return setBulkMessage("Select rows first.");
    if (patchName === "price") {
      const cents = parseDollars(bulk.price);
      if (cents === null) return setBulkMessage("Enter a price like 148.00");
      onChange(applyBulk(rows, keys, { price: cents }));
    } else if (patchName === "stock") {
      const quantity = Number(bulk.stock);
      if (!Number.isInteger(quantity) || quantity < 0 || !bulk.location)
        return setBulkMessage("Enter a whole number of units");
      onChange(applyBulk(rows, keys, { stock: { locationId: bulk.location, quantity } }));
    } else {
      const grams = Number(bulk.weight);
      if (!Number.isInteger(grams) || grams < 0) return setBulkMessage("Enter a weight in grams");
      onChange(applyBulk(rows, keys, { weightGrams: grams }));
    }
    setBulkMessage(`Applied to ${keys.size} selected row${keys.size === 1 ? "" : "s"}.`);
  };

  const allSelected = visible.length > 0 && visible.every((r) => selected.has(r.key));
  const toggleAll = () =>
    setSelected((s) => {
      const next = new Set(s);
      for (const r of visible) {
        if (allSelected) next.delete(r.key);
        else next.add(r.key);
      }
      return next;
    });
  const toggle = (key: string, on: boolean) =>
    setSelected((s) => {
      const next = new Set(s);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });

  if (rows.length === 0) {
    return (
      <p className="text-sm text-ink-soft">Add colours, fits and sizes to build your variants.</p>
    );
  }

  const filterBar = (
    <div className="flex flex-wrap items-end gap-3">
      {(
        [
          ["Colour", "color", colors, (c: string) => colorNames[c] ?? c],
          ["Fit", "fit", fits, (f: string) => FIT_LABELS[f as FitFamily]],
          ["Size", "size", sizes, (s: string) => s],
        ] as const
      ).map(([name, key, values, show]) => (
        <label key={key} className="flex flex-col gap-1 text-sm">
          {name}
          <select
            value={(filter as Record<string, string | undefined>)[key] ?? ""}
            onChange={(e) => setFilter((f) => ({ ...f, [key]: e.target.value || undefined }))}
            className="h-11 border border-ink-subtle bg-surface px-2"
          >
            <option value="">All</option>
            {values.map((v) => (
              <option key={v} value={v}>
                {show(v)}
              </option>
            ))}
          </select>
        </label>
      ))}
      <p className="pb-3 text-sm text-ink-soft">
        {visible.length} of {rows.length} variants · {selected.size} selected
      </p>
    </div>
  );

  const bulkBar = (
    <div
      role="group"
      aria-label="Bulk edit"
      className="flex flex-wrap items-end gap-3 border border-line bg-surface-muted p-3"
    >
      <label className="flex flex-col gap-1 text-sm">
        Price ($)
        <input
          inputMode="decimal"
          value={bulk.price}
          onChange={(e) => setBulk((b) => ({ ...b, price: e.target.value }))}
          className="h-11 w-28 border border-ink-subtle bg-surface px-2"
        />
      </label>
      <Button type="button" variant="secondary" onClick={() => applyToSelected("price")}>
        Apply price
      </Button>
      <label className="flex flex-col gap-1 text-sm">
        Stock
        <input
          inputMode="numeric"
          value={bulk.stock}
          onChange={(e) => setBulk((b) => ({ ...b, stock: e.target.value }))}
          className="h-11 w-20 border border-ink-subtle bg-surface px-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        at
        <select
          value={bulk.location}
          onChange={(e) => setBulk((b) => ({ ...b, location: e.target.value }))}
          className="h-11 border border-ink-subtle bg-surface px-2"
        >
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </label>
      <Button type="button" variant="secondary" onClick={() => applyToSelected("stock")}>
        Apply stock
      </Button>
      <label className="flex flex-col gap-1 text-sm">
        Weight (g)
        <input
          inputMode="numeric"
          value={bulk.weight}
          onChange={(e) => setBulk((b) => ({ ...b, weight: e.target.value }))}
          className="h-11 w-24 border border-ink-subtle bg-surface px-2"
        />
      </label>
      <Button type="button" variant="secondary" onClick={() => applyToSelected("weight")}>
        Apply weight
      </Button>
      <p aria-live="polite" className="w-full text-sm text-ink-soft">
        {bulkMessage}
      </p>
    </div>
  );

  if (mobile) {
    return (
      <div className="flex flex-col gap-4">
        {filterBar}
        {bulkBar}
        {colors
          .filter((c) => !filter.color || c === filter.color)
          .map((color) => (
            <section
              key={color}
              aria-label={colorNames[color] ?? color}
              className="flex flex-col gap-3"
            >
              <h4 className="font-medium">{colorNames[color] ?? color}</h4>
              {visible
                .filter((r) => r.color === color)
                .map((r) => {
                  const index = visible.indexOf(r);
                  return (
                    <div
                      key={r.key}
                      className="flex flex-col gap-2 border border-line bg-surface p-3"
                    >
                      <label className="flex min-h-11 items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="size-5 accent-ink"
                          checked={selected.has(r.key)}
                          onChange={(e) => toggle(r.key, e.target.checked)}
                        />
                        {FIT_LABELS[r.fit]} · {r.size}
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {columns.map((column) => (
                          <label key={column} className="flex flex-col gap-1 text-xs text-ink-soft">
                            {columnLabel(column)}
                            <Cell
                              value={value(r, column)}
                              onCommit={(raw) => commit(r, column, raw)}
                              label={`${columnLabel(column)}, ${label(r)}`}
                              row={index}
                              column={column}
                              inputMode={
                                column === "price" || column === "compareAtPrice"
                                  ? "decimal"
                                  : column === "sku" || column === "barcode"
                                    ? "text"
                                    : "numeric"
                              }
                              parse={
                                column === "price" || column === "compareAtPrice" ? "money" : "text"
                              }
                              invalid={column === "price" && r.price === null}
                              onNavigate={navigate}
                            />
                          </label>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm">
                        <label className="flex min-h-11 items-center gap-2">
                          <input
                            type="checkbox"
                            className="size-5 accent-ink"
                            checked={r.availableOnline}
                            onChange={(e) => patchRow(r.key, { availableOnline: e.target.checked })}
                          />
                          Sold online
                        </label>
                        <label className="flex min-h-11 items-center gap-2">
                          <input
                            type="checkbox"
                            className="size-5 accent-ink"
                            checked={r.backorder}
                            onChange={(e) => patchRow(r.key, { backorder: e.target.checked })}
                          />
                          Backorder
                        </label>
                        <button
                          type="button"
                          onClick={() => onExclude(r.key)}
                          className="min-h-11 underline underline-offset-4"
                        >
                          Don&apos;t make this
                        </button>
                      </div>
                    </div>
                  );
                })}
            </section>
          ))}
      </div>
    );
  }

  const first = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const last = Math.min(visible.length, first + VIEWPORT_ROWS + OVERSCAN * 2);
  const slice = visible.slice(first, last);

  return (
    <div className="flex flex-col gap-4">
      {filterBar}
      {bulkBar}
      <div
        ref={scroller}
        role="region"
        aria-label="Variants"
        tabIndex={0}
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        className="relative overflow-auto border border-line"
        style={{ maxHeight: ROW_HEIGHT * VIEWPORT_ROWS + 48 }}
      >
        <table className="w-max min-w-full border-collapse text-left text-sm">
          <caption className="sr-only">
            Variants. Use the arrow keys to move between rows, Enter to confirm a value and Escape
            to undo it.
          </caption>
          <thead className="sticky top-0 z-10 bg-surface">
            <tr className="border-b border-line">
              <th scope="col" className="w-12 px-2 py-2">
                <input
                  type="checkbox"
                  aria-label="Select all shown variants"
                  className="size-5 accent-ink"
                  checked={allSelected}
                  onChange={toggleAll}
                />
              </th>
              <th scope="col" className="px-2 py-2 font-medium">
                Variant
              </th>
              {columns.map((c) => (
                <th key={c} scope="col" className="min-w-28 px-2 py-2 font-medium">
                  {columnLabel(c)}
                </th>
              ))}
              <th scope="col" className="px-2 py-2 font-medium">
                Online
              </th>
              <th scope="col" className="px-2 py-2 font-medium">
                Backorder
              </th>
              <th scope="col" className="px-2 py-2">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {first > 0 && (
              <tr aria-hidden="true">
                <td style={{ height: first * ROW_HEIGHT }} />
              </tr>
            )}
            {slice.map((r, i) => {
              const index = first + i;
              return (
                <tr key={r.key} className="border-b border-line" style={{ height: ROW_HEIGHT }}>
                  <td className="px-2">
                    <input
                      type="checkbox"
                      aria-label={`Select ${label(r)}`}
                      className="size-5 accent-ink"
                      checked={selected.has(r.key)}
                      onChange={(e) => toggle(r.key, e.target.checked)}
                    />
                  </td>
                  <th scope="row" className="px-2 font-normal whitespace-nowrap">
                    {label(r)}
                  </th>
                  {columns.map((column) => (
                    <td key={column} className="px-1">
                      <Cell
                        value={value(r, column)}
                        onCommit={(raw) => commit(r, column, raw)}
                        label={`${columnLabel(column)}, ${label(r)}`}
                        row={index}
                        column={column}
                        inputMode={
                          column === "price" || column === "compareAtPrice"
                            ? "decimal"
                            : column === "sku" || column === "barcode"
                              ? "text"
                              : "numeric"
                        }
                        parse={column === "price" || column === "compareAtPrice" ? "money" : "text"}
                        invalid={column === "price" && r.price === null}
                        onNavigate={navigate}
                      />
                    </td>
                  ))}
                  <td className="px-2 text-center">
                    <input
                      type="checkbox"
                      aria-label={`Sold online: ${label(r)}`}
                      className="size-5 accent-ink"
                      checked={r.availableOnline}
                      onChange={(e) => patchRow(r.key, { availableOnline: e.target.checked })}
                    />
                  </td>
                  <td className="px-2 text-center">
                    <input
                      type="checkbox"
                      aria-label={`Backorder: ${label(r)}`}
                      className="size-5 accent-ink"
                      checked={r.backorder}
                      onChange={(e) => patchRow(r.key, { backorder: e.target.checked })}
                    />
                  </td>
                  <td className="px-2">
                    <button
                      type="button"
                      onClick={() => onExclude(r.key)}
                      className="min-h-11 text-sm whitespace-nowrap underline underline-offset-4"
                    >
                      Don&apos;t make<span className="sr-only"> {label(r)}</span>
                    </button>
                  </td>
                </tr>
              );
            })}
            {last < visible.length && (
              <tr aria-hidden="true">
                <td style={{ height: (visible.length - last) * ROW_HEIGHT }} />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
