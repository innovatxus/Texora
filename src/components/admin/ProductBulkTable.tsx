"use client";

import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/primitives";
import { setProductStatusAction } from "@/lib/admin/catalog-actions";
import { PRODUCT_STATUS_LABELS, PRODUCT_STATUS_TONES } from "@/lib/catalog/product-status";
import type { ProductStatus } from "@/lib/validation/catalog";
import { StatusPill } from "./ui";

export interface ProductRow {
  id: string;
  name: string;
  slug: string;
  status: ProductStatus;
  category: string;
  price: string;
  colors: number;
}

/** Product table with row selection and bulk publish / unpublish / archive. */
export function ProductBulkTable({
  rows,
  canPublish,
}: {
  rows: ProductRow[];
  canPublish: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const all = rows.length > 0 && selected.size === rows.length;
  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const apply = (status: ProductRow["status"], label: string) =>
    startTransition(async () => {
      const result = await setProductStatusAction({ productIds: [...selected], status });
      if (result.ok) {
        setMessage({ ok: true, text: `${result.data.changed} product(s) ${label}` });
        setSelected(new Set());
        router.refresh();
      } else setMessage({ ok: false, text: result.error.message });
    });

  if (rows.length === 0) {
    return (
      <p className="border border-dashed border-line p-6 text-sm text-ink-soft">
        No products match.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {canPublish && (
        <div
          role="toolbar"
          aria-label="Bulk actions"
          className="flex flex-wrap items-center gap-2 text-sm"
        >
          <span className="text-ink-soft">{selected.size} selected</span>
          <Button
            size="sm"
            variant="secondary"
            disabled={selected.size === 0}
            loading={pending}
            onClick={() => apply("live", "published")}
          >
            Publish
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={selected.size === 0}
            onClick={() => apply("draft", "unpublished")}
          >
            Unpublish
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={selected.size === 0}
            onClick={() => apply("archived", "archived")}
          >
            Archive
          </Button>
          {message && (
            <span
              role="status"
              className={message.ok ? "text-xs text-success" : "text-xs text-sale"}
            >
              {message.text}
            </span>
          )}
        </div>
      )}
      <div
        tabIndex={0}
        role="region"
        aria-label="Products"
        className="overflow-x-auto border border-line bg-surface focus-visible:outline-2 focus-visible:outline-ink"
      >
        <table className="w-full text-sm">
          <caption className="sr-only">Products</caption>
          <thead>
            <tr className="border-b border-line text-left text-xs text-ink-subtle">
              {canPublish && (
                <th scope="col" className="w-10 px-3 py-2">
                  <input
                    type="checkbox"
                    aria-label="Select all products"
                    checked={all}
                    onChange={() => setSelected(all ? new Set() : new Set(rows.map((r) => r.id)))}
                    className="size-4 accent-ink"
                  />
                </th>
              )}
              <th scope="col" className="px-3 py-2 font-medium">
                Product
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Category
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Colours
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Price
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-line last:border-0 hover:bg-canvas">
                {canPublish && (
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      aria-label={`Select ${row.name}`}
                      checked={selected.has(row.id)}
                      onChange={() => toggle(row.id)}
                      className="size-4 accent-ink"
                    />
                  </td>
                )}
                <td className="px-3 py-2">
                  <NextLink href={`/admin/catalog/${row.id}`} className="font-medium underline">
                    {row.name}
                  </NextLink>
                  <span className="font-mono block text-xs text-ink-subtle">{row.id}</span>
                </td>
                <td className="px-3 py-2">{row.category}</td>
                <td className="px-3 py-2 text-right tabular-nums">{row.colors}</td>
                <td className="px-3 py-2 text-right tabular-nums">{row.price}</td>
                <td className="px-3 py-2">
                  <StatusPill tone={PRODUCT_STATUS_TONES[row.status]}>
                    {PRODUCT_STATUS_LABELS[row.status]}
                  </StatusPill>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
