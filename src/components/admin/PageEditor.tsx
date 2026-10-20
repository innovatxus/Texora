"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { Button } from "@/components/primitives";
import { savePageAction } from "@/lib/admin/ops-actions";
import type { CmsModule, CmsModuleType, CmsPage } from "@/lib/cms/modules";
import { AUDIENCES } from "@/lib/validation";
import { AdminField, adminControl } from "./ui";

const TYPE_LABELS: Record<CmsModuleType, string> = {
  hero: "Hero banner",
  promoStrip: "Promo strip",
  categoryTiles: "Category tiles",
  productCarousel: "Product carousel",
  splitFeature: "Split feature",
  storyBlock: "Story block",
  lookbookGrid: "Lookbook grid",
  shopTheLook: "Shop the look",
};

interface Draft {
  module: CmsModule;
  /** The data as the editor is typing it; parsed on save. */
  json: string;
  error: string | null;
}

const localInput = (d: Date | undefined) =>
  d ? new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : "";

/**
 * Page builder: reorder, add and remove modules, set each one's schedule and
 * audience, and edit its content as JSON. Everything is validated against
 * the module schemas on the server before it is saved.
 */
export function PageEditor({
  page,
  templates,
}: {
  page: Pick<CmsPage, "slug" | "title" | "status" | "seo" | "modules">;
  templates: Partial<Record<CmsModuleType, CmsModule>>;
}) {
  const router = useRouter();
  const id = useId();
  const [title, setTitle] = useState(page.title);
  const [status, setStatus] = useState(page.status);
  const [seoTitle, setSeoTitle] = useState(page.seo.title ?? "");
  const [seoDescription, setSeoDescription] = useState(page.seo.description ?? "");
  const [drafts, setDrafts] = useState<Draft[]>(
    page.modules.map((m) => ({ module: m, json: JSON.stringify(m.data, null, 2), error: null })),
  );
  const [adding, setAdding] = useState<CmsModuleType | "">("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const update = (index: number, patch: Partial<Draft>) =>
    setDrafts((list) => list.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  const updateModule = (index: number, patch: Partial<CmsModule>) =>
    setDrafts((list) =>
      list.map((d, i) =>
        i === index ? { ...d, module: { ...d.module, ...patch } as CmsModule } : d,
      ),
    );
  const move = (index: number, delta: number) =>
    setDrafts((list) => {
      const j = index + delta;
      if (j < 0 || j >= list.length) return list;
      const next = [...list];
      [next[index], next[j]] = [next[j] as Draft, next[index] as Draft];
      return next;
    });

  const add = () => {
    const template = adding ? templates[adding] : undefined;
    if (!template) return;
    const added = { ...template, id: `m-${crypto.randomUUID().slice(0, 8)}` } as CmsModule;
    setDrafts((list) => [
      ...list,
      { module: added, json: JSON.stringify(added.data, null, 2), error: null },
    ]);
    setAdding("");
  };

  const save = () => {
    let failed = false;
    const modules = drafts.map((d, i) => {
      try {
        return { ...d.module, data: JSON.parse(d.json) as unknown } as CmsModule;
      } catch {
        failed = true;
        update(i, { error: "This isn't valid JSON" });
        return d.module;
      }
    });
    if (failed) {
      setMessage({ ok: false, text: "Fix the highlighted modules before saving" });
      return;
    }
    startTransition(async () => {
      const result = await savePageAction({
        slug: page.slug,
        title,
        status,
        seo: {
          ...(seoTitle ? { title: seoTitle } : {}),
          ...(seoDescription ? { description: seoDescription } : {}),
        },
        modules,
      });
      if (result.ok) {
        setMessage({ ok: true, text: "Saved. The storefront updates within a minute." });
        router.refresh();
        return;
      }
      const field = Object.entries(result.error.fieldErrors ?? {})[0];
      setMessage({ ok: false, text: field ? `${field[0]}: ${field[1][0]}` : result.error.message });
    });
  };

  return (
    <div className="flex flex-col gap-6 text-sm">
      <div className="grid gap-4 md:grid-cols-2">
        <AdminField label="Title">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={adminControl}
          />
        </AdminField>
        <AdminField label="Status">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as CmsPage["status"])}
            className={adminControl}
          >
            {["draft", "scheduled", "live", "archived"].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </AdminField>
        <AdminField label="SEO title" hint="Up to 70 characters">
          <input
            value={seoTitle}
            maxLength={70}
            onChange={(e) => setSeoTitle(e.target.value)}
            className={adminControl}
          />
        </AdminField>
        <AdminField label="SEO description" hint="Up to 160 characters">
          <input
            value={seoDescription}
            maxLength={160}
            onChange={(e) => setSeoDescription(e.target.value)}
            className={adminControl}
          />
        </AdminField>
      </div>

      <ol className="flex flex-col gap-4">
        {drafts.map((d, i) => {
          const m = d.module;
          return (
            <li key={m.id} className="border border-line bg-surface p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-medium">
                  {i + 1}. {TYPE_LABELS[m.type]}
                </h3>
                <span className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    className="size-10 border border-line disabled:opacity-40"
                  >
                    ↑<span className="sr-only"> Move module {i + 1} up</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={i === drafts.length - 1}
                    className="size-10 border border-line disabled:opacity-40"
                  >
                    ↓<span className="sr-only"> Move module {i + 1} down</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      window.confirm("Remove this module?") &&
                      setDrafts((l) => l.filter((_, j) => j !== i))
                    }
                    className="h-10 border border-line px-3"
                  >
                    Remove<span className="sr-only"> module {i + 1}</span>
                  </button>
                </span>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <AdminField label="Show from">
                  <input
                    type="datetime-local"
                    value={localInput(m.schedule.startsAt)}
                    onChange={(e) =>
                      updateModule(i, {
                        schedule: {
                          ...m.schedule,
                          startsAt: e.target.value ? new Date(e.target.value) : undefined,
                        },
                      } as Partial<CmsModule>)
                    }
                    className={adminControl}
                  />
                </AdminField>
                <AdminField label="Show until">
                  <input
                    type="datetime-local"
                    value={localInput(m.schedule.endsAt)}
                    onChange={(e) =>
                      updateModule(i, {
                        schedule: {
                          ...m.schedule,
                          endsAt: e.target.value ? new Date(e.target.value) : undefined,
                        },
                      } as Partial<CmsModule>)
                    }
                    className={adminControl}
                  />
                </AdminField>
              </div>
              <fieldset className="mt-3">
                <legend className="text-xs text-ink-soft">Who sees it</legend>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                  {AUDIENCES.map((a) => (
                    <label key={a} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={m.audience.includes(a)}
                        onChange={(e) =>
                          updateModule(i, {
                            audience: e.target.checked
                              ? [...m.audience, a]
                              : m.audience.filter((x) => x !== a),
                          })
                        }
                        className="size-4 accent-ink"
                      />
                      {a}
                    </label>
                  ))}
                </div>
              </fieldset>
              <label htmlFor={`${id}-${m.id}`} className="mt-3 block text-xs text-ink-soft">
                Content (JSON)
              </label>
              <textarea
                id={`${id}-${m.id}`}
                value={d.json}
                rows={Math.min(16, d.json.split("\n").length + 1)}
                spellCheck={false}
                aria-invalid={d.error ? true : undefined}
                aria-describedby={d.error ? `${id}-${m.id}-error` : undefined}
                onChange={(e) => update(i, { json: e.target.value, error: null })}
                className={`${adminControl} font-mono mt-1 h-auto w-full py-2 text-xs`}
              />
              {d.error && (
                <p id={`${id}-${m.id}-error`} className="mt-1 text-xs text-sale">
                  {d.error}
                </p>
              )}
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap items-end gap-3">
        <AdminField label="Add a module">
          <select
            value={adding}
            onChange={(e) => setAdding(e.target.value as CmsModuleType | "")}
            className={adminControl}
          >
            <option value="">Choose…</option>
            {(Object.keys(templates) as CmsModuleType[]).map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </AdminField>
        <Button size="sm" variant="secondary" onClick={add} disabled={!adding}>
          Add
        </Button>
      </div>

      <div className="sticky bottom-0 flex flex-wrap items-center gap-3 border-t border-line bg-canvas py-3">
        <Button size="sm" loading={pending} onClick={save}>
          Save page
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
