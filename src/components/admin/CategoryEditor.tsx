"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { Button } from "@/components/primitives";
import { updateCategoryAction } from "@/lib/admin/catalog-actions";
import type { Category } from "@/lib/validation";
import { AdminField, adminControl } from "./ui";

type Rule = "none" | "pinned" | "boosted" | "buried";

const SORTS: ReadonlyArray<{ value: Category["merchRules"]["defaultSort"]; label: string }> = [
  { value: "featured", label: "Featured" },
  { value: "newest", label: "Newest" },
  { value: "best_sellers", label: "Best sellers" },
  { value: "top_rated", label: "Top rated" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
];

/**
 * Category details plus merchandising: choose, per product, whether it is
 * pinned (in a set order), boosted, buried or left to the sort.
 */
export function CategoryEditor({
  category,
  products,
}: {
  category: Pick<Category, "id" | "name" | "sortOrder" | "status" | "merchRules">;
  products: Array<{ id: string; name: string; status: string }>;
}) {
  const router = useRouter();
  const id = useId();
  const initial = new Map<string, Rule>();
  for (const p of category.merchRules.boosted) initial.set(p, "boosted");
  for (const p of category.merchRules.buried) initial.set(p, "buried");
  for (const p of category.merchRules.pinned) initial.set(p, "pinned");
  const [rules, setRules] = useState(initial);
  const [pinOrder, setPinOrder] = useState<string[]>(category.merchRules.pinned);
  const [name, setName] = useState(category.name);
  const [sortOrder, setSortOrder] = useState(String(category.sortOrder));
  const [status, setStatus] = useState(category.status);
  const [defaultSort, setDefaultSort] = useState(category.merchRules.defaultSort);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const setRule = (productId: string, rule: Rule) => {
    setRules((current) => new Map(current).set(productId, rule));
    setPinOrder((order) =>
      rule === "pinned"
        ? order.includes(productId)
          ? order
          : [...order, productId]
        : order.filter((p) => p !== productId),
    );
  };
  const movePin = (productId: string, delta: number) =>
    setPinOrder((order) => {
      const i = order.indexOf(productId);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= order.length) return order;
      const next = [...order];
      [next[i], next[j]] = [next[j] as string, next[i] as string];
      return next;
    });

  const save = () =>
    startTransition(async () => {
      const of = (rule: Rule) => [...rules].filter(([, r]) => r === rule).map(([p]) => p);
      const result = await updateCategoryAction({
        categoryId: category.id,
        name,
        sortOrder,
        status,
        merchRules: { pinned: pinOrder, boosted: of("boosted"), buried: of("buried"), defaultSort },
      });
      if (result.ok) {
        setMessage({ ok: true, text: "Saved" });
        router.refresh();
      } else {
        setMessage({
          ok: false,
          text: Object.values(result.error.fieldErrors ?? {})[0]?.[0] ?? result.error.message,
        });
      }
    });

  const nameOf = (productId: string) => products.find((p) => p.id === productId)?.name ?? productId;

  return (
    <div className="flex flex-col gap-6 text-sm">
      <div className="flex flex-wrap gap-4">
        <AdminField label="Name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`${adminControl} w-56`}
          />
        </AdminField>
        <AdminField label="Menu order">
          <input
            type="number"
            min={0}
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className={`${adminControl} w-24`}
          />
        </AdminField>
        <AdminField label="Status">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as Category["status"])}
            className={adminControl}
          >
            {["draft", "scheduled", "live", "archived"].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </AdminField>
        <AdminField label="Default sort">
          <select
            value={defaultSort}
            onChange={(e) => setDefaultSort(e.target.value as typeof defaultSort)}
            className={adminControl}
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </AdminField>
      </div>

      {pinOrder.length > 0 && (
        <section aria-labelledby={`${id}-pins`}>
          <h3 id={`${id}-pins`} className="mb-2 text-xs text-ink-soft">
            Pinned order (shown first, in this order, in the Featured sort)
          </h3>
          <ol className="flex flex-col gap-1">
            {pinOrder.map((p, i) => (
              <li key={p} className="flex items-center gap-2">
                <span className="w-6 text-ink-subtle tabular-nums">{i + 1}.</span>
                <span className="flex-1">{nameOf(p)}</span>
                <button
                  type="button"
                  onClick={() => movePin(p, -1)}
                  disabled={i === 0}
                  className="size-9 border border-line disabled:opacity-40"
                >
                  ↑<span className="sr-only"> Move {nameOf(p)} up</span>
                </button>
                <button
                  type="button"
                  onClick={() => movePin(p, 1)}
                  disabled={i === pinOrder.length - 1}
                  className="size-9 border border-line disabled:opacity-40"
                >
                  ↓<span className="sr-only"> Move {nameOf(p)} down</span>
                </button>
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="overflow-x-auto border border-line">
        <table className="w-full text-sm">
          <caption className="sr-only">
            Products in this category and their merchandising rule
          </caption>
          <thead>
            <tr className="border-b border-line text-left text-xs text-ink-subtle">
              <th scope="col" className="px-3 py-2 font-medium">
                Product
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Status
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Rule
              </th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-b border-line last:border-0">
                <td className="px-3 py-2">{p.name}</td>
                <td className="px-3 py-2 text-ink-soft">{p.status}</td>
                <td className="px-3 py-2">
                  <select
                    aria-label={`Rule for ${p.name}`}
                    value={rules.get(p.id) ?? "none"}
                    onChange={(e) => setRule(p.id, e.target.value as Rule)}
                    className={adminControl}
                  >
                    <option value="none">None</option>
                    <option value="pinned">Pin</option>
                    <option value="boosted">Boost</option>
                    <option value="buried">Bury</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3">
        <Button size="sm" loading={pending} onClick={save}>
          Save category
        </Button>
        {message && (
          <span role="status" className={message.ok ? "text-xs text-success" : "text-xs text-sale"}>
            {message.text}
          </span>
        )}
      </div>
    </div>
  );
}
