"use client";

import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { PriceDisplay } from "@/components/commerce/PriceDisplay";
import { ProductImage } from "@/components/commerce/ProductImage";
import { Drawer } from "@/components/feedback/Drawer";
import { CloseIcon, SearchIcon } from "@/components/icons";
import { IconButton, Spinner } from "@/components/primitives";
import { POPULAR_CATEGORIES, POPULAR_SEARCHES } from "@/config/navigation";
import { useStorageItem } from "@/lib/browser/hooks";
import { readStorage, writeStorage } from "@/lib/browser/storage";
import { suggest } from "@/lib/search/actions";
import type { SearchResult } from "@/lib/search/match";
import { useUiStore } from "@/stores/ui";

const DEBOUNCE_MS = 150;
const RECENT_KEY = "texora-recent-searches";
const RECENT_LIMIT = 6;

function parseRecent(raw: string | null | undefined): string[] {
  try {
    const value: unknown = JSON.parse(raw ?? "[]");
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function rememberSearch(query: string): void {
  const next = [query, ...parseRecent(readStorage("local", RECENT_KEY)).filter((q) => q !== query)];
  writeStorage("local", RECENT_KEY, JSON.stringify(next.slice(0, RECENT_LIMIT)));
}

interface Resolved {
  query: string;
  result: SearchResult | null;
  failed: boolean;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-label text-ink-subtle">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** Full-screen search with live results, popular searches and categories. */
export function SearchOverlay() {
  const isOpen = useUiStore((s) => s.panel === "search");
  const setOpen = useUiStore((s) => s.setOpen);
  const close = useUiStore((s) => s.close);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const requestId = useRef(0);

  const [query, setQuery] = useState("");
  const [resolved, setResolved] = useState<Resolved | null>(null);
  const recent = parseRecent(useStorageItem("local", RECENT_KEY));

  const trimmed = query.trim();

  useEffect(() => {
    if (!trimmed) return;
    const id = ++requestId.current;
    const timer = window.setTimeout(async () => {
      const response = await suggest({ query: trimmed });
      // Ignore responses that arrive after a newer keystroke.
      if (id !== requestId.current) return;
      setResolved({
        query: trimmed,
        result: response.ok ? response.data : null,
        failed: !response.ok,
      });
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [trimmed]);

  // Keep showing the previous results while the next query resolves.
  const loading = trimmed.length > 0 && resolved?.query !== trimmed;
  const result = trimmed ? (resolved?.result ?? null) : null;
  const failed = trimmed.length > 0 && resolved?.query === trimmed && resolved.failed;

  const go = (href: string, remember?: string) => {
    if (remember) rememberSearch(remember);
    close();
    router.push(href);
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (trimmed) go(`/search?q=${encodeURIComponent(trimmed)}`, trimmed);
  };

  const showResults = trimmed.length > 0 && result !== null;
  const noResults = showResults && result.total === 0;

  return (
    <Drawer
      open={isOpen}
      onOpenChange={(open) => setOpen("search", open)}
      side="top"
      title="Search"
      hideHeader
      initialFocus={() => inputRef.current}
    >
      <div className="container-page py-4 md:py-6">
        <form
          role="search"
          onSubmit={onSubmit}
          className="flex items-center gap-3 border-b border-ink pb-2"
        >
          <SearchIcon size={24} className="text-ink-soft" />
          <label htmlFor="site-search" className="sr-only">
            Search products
          </label>
          <input
            ref={inputRef}
            id="site-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for linen, cashmere, wide-leg…"
            autoComplete="off"
            enterKeyHint="search"
            className="h-12 min-w-0 flex-1 bg-transparent text-xl outline-none placeholder:text-ink-subtle [&::-webkit-search-cancel-button]:hidden"
          />
          {loading && <Spinner className="text-ink-subtle" />}
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="text-label text-ink-soft underline-offset-4 hover:underline"
            >
              Clear
            </button>
          )}
          <IconButton
            label="Close search"
            icon={<CloseIcon size={24} />}
            onClick={close}
            className="-mr-2"
          />
        </form>

        <p aria-live="polite" className="sr-only">
          {showResults
            ? noResults
              ? `No results for ${trimmed}`
              : `${result.total} products found`
            : ""}
        </p>

        <div className="max-h-[calc(100dvh-8rem)] overflow-y-auto py-8">
          {failed && trimmed && (
            <p className="text-sm text-ink-soft">
              Search is unavailable right now. Press Enter to search the full catalogue.
            </p>
          )}

          {(!showResults || noResults) && (
            <div className="grid gap-10 md:grid-cols-3">
              {noResults && (
                <div className="md:col-span-3">
                  <p className="font-display text-2xl">No results for “{trimmed}”</p>
                  <p className="mt-2 text-ink-soft">
                    Check the spelling or try one of these instead.
                  </p>
                </div>
              )}
              {recent.length > 0 && !noResults && (
                <Section title="Recent searches">
                  <ul className="flex flex-col gap-2">
                    {recent.map((q) => (
                      <li key={q}>
                        <button
                          type="button"
                          onClick={() => setQuery(q)}
                          className="text-sm hover:underline"
                        >
                          {q}
                        </button>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}
              <Section title="Popular searches">
                <ul className="flex flex-col gap-2">
                  {POPULAR_SEARCHES.map((q) => (
                    <li key={q}>
                      <button
                        type="button"
                        onClick={() => setQuery(q)}
                        className="text-sm hover:underline"
                      >
                        {q}
                      </button>
                    </li>
                  ))}
                </ul>
              </Section>
              <Section title="Popular categories">
                <ul className="flex flex-col gap-2">
                  {POPULAR_CATEGORIES.map((c) => (
                    <li key={c.href}>
                      <NextLink href={c.href} onClick={close} className="text-sm hover:underline">
                        {c.label}
                      </NextLink>
                    </li>
                  ))}
                </ul>
              </Section>
            </div>
          )}

          {showResults && !noResults && (
            <div className="grid gap-10 lg:grid-cols-[16rem_1fr]">
              <div className="flex flex-col gap-8">
                <Section title="Suggestions">
                  <ul className="flex flex-col gap-2">
                    {result.suggestions.map((s) => (
                      <li key={s}>
                        <button
                          type="button"
                          onClick={() => go(`/search?q=${encodeURIComponent(s)}`, s)}
                          className="text-left text-sm hover:underline"
                        >
                          {s}
                        </button>
                      </li>
                    ))}
                  </ul>
                </Section>
                <Section title="Categories">
                  <ul className="flex flex-col gap-2">
                    {result.categories.map((c) => (
                      <li key={c.href}>
                        <NextLink href={c.href} onClick={close} className="text-sm hover:underline">
                          {c.label} <span className="text-ink-subtle">({c.count})</span>
                        </NextLink>
                      </li>
                    ))}
                  </ul>
                </Section>
              </div>
              <Section title="Products">
                <ul className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  {result.products.map((p) => (
                    <li key={p.id}>
                      <NextLink
                        href={`/product/${p.slug}`}
                        onClick={() => {
                          rememberSearch(trimmed);
                          close();
                        }}
                        className="group block"
                      >
                        <span className="relative block aspect-[3/4] overflow-hidden">
                          <ProductImage
                            src={p.image}
                            alt={p.imageAlt}
                            fill
                            sizes="(min-width: 768px) 200px, 45vw"
                          />
                        </span>
                        <span className="mt-3 block text-sm group-hover:underline">{p.name}</span>
                        <PriceDisplay
                          size="sm"
                          price={p.price}
                          max={p.maxPrice}
                          compareAtPrice={p.compareAtPrice}
                        />
                      </NextLink>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => go(`/search?q=${encodeURIComponent(trimmed)}`, trimmed)}
                  className="mt-6 text-label underline underline-offset-4"
                >
                  See all {result.total} results for “{trimmed}”
                </button>
              </Section>
            </div>
          )}
        </div>
      </div>
    </Drawer>
  );
}
