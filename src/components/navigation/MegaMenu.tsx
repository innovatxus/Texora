"use client";

import NextLink from "next/link";
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { ProductImage } from "@/components/commerce/ProductImage";
import { ChevronDownIcon } from "@/components/icons";
import type { NavDepartment } from "@/config/navigation";
import { cn } from "@/lib/utils/cn";

const HOVER_INTENT_MS = 150;

interface MegaMenuProps {
  items: readonly NavDepartment[];
  /** Reports open state so the header stays visible while a menu is open. */
  onOpenChange?: (open: boolean) => void;
}

/**
 * Desktop department navigation. Hover opens after a short intent delay;
 * keyboard users open panels with the disclosure button (Enter/Space/↓),
 * and Escape, outside clicks or tabbing away close them.
 */
export function MegaMenu({ items, onOpenChange }: MegaMenuProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const navRef = useRef<HTMLElement>(null);
  const toggleRefs = useRef(new Map<string, HTMLButtonElement>());
  const baseId = useId();

  const setOpen = useCallback(
    (id: string | null) => {
      setOpenId(id);
      onOpenChange?.(id !== null);
    },
    [onOpenChange],
  );

  const schedule = (id: string | null) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(id), HOVER_INTENT_MS);
  };

  useEffect(() => () => window.clearTimeout(timer.current), []);

  useEffect(() => {
    if (!openId) return;
    const onPointerDown = (event: PointerEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) setOpen(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [openId, setOpen]);

  const closeAndFocus = (id: string) => {
    setOpen(null);
    toggleRefs.current.get(id)?.focus();
  };

  const onPanelKeyDown = (event: KeyboardEvent, id: string) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      closeAndFocus(id);
    }
  };

  return (
    <nav
      ref={navRef}
      aria-label="Main"
      className="hidden lg:block"
      onPointerLeave={() => schedule(null)}
      onBlur={(event) => {
        if (navRef.current && !navRef.current.contains(event.relatedTarget as Node | null))
          setOpen(null);
      }}
    >
      <ul className="flex items-center gap-1">
        {items.map((item) => {
          const isOpen = openId === item.id;
          const panelId = `${baseId}-${item.id}`;
          return (
            <li
              key={item.id}
              className="flex items-center"
              onPointerEnter={() => schedule(item.menu ? item.id : null)}
            >
              <NextLink
                href={item.href}
                className={cn(
                  "nav-indicator flex h-16 items-center px-3 text-label transition-colors",
                  item.tone === "sale" ? "text-sale" : "text-ink",
                )}
                data-active={isOpen}
              >
                {item.label}
              </NextLink>
              {item.menu && (
                <>
                  <button
                    ref={(el) => {
                      if (el) toggleRefs.current.set(item.id, el);
                    }}
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    aria-label={`${item.label} menu`}
                    onClick={() => setOpen(isOpen ? null : item.id)}
                    onKeyDown={(event) => {
                      if (event.key === "ArrowDown") {
                        event.preventDefault();
                        setOpen(item.id);
                        window.requestAnimationFrame(() =>
                          document
                            .getElementById(panelId)
                            ?.querySelector<HTMLElement>("a")
                            ?.focus(),
                        );
                      }
                      if (event.key === "Escape") setOpen(null);
                    }}
                    className="-ml-2 inline-flex size-6 items-center justify-center text-ink-soft"
                  >
                    <ChevronDownIcon
                      size={20}
                      className={cn(
                        "size-4 transition-transform duration-fast",
                        isOpen && "rotate-180",
                      )}
                    />
                  </button>
                  <div
                    id={panelId}
                    hidden={!isOpen}
                    onKeyDown={(event) => onPanelKeyDown(event, item.id)}
                    className="absolute inset-x-0 top-full animate-menu-in border-t border-line bg-surface shadow-overlay"
                  >
                    <div className="container-page grid grid-cols-12 gap-10 py-10">
                      {item.menu.columns.map((column) => (
                        <div key={column.title} className="col-span-2">
                          <p className="text-label text-ink-subtle">{column.title}</p>
                          <ul className="mt-4 flex flex-col gap-3">
                            {column.links.map((link) => (
                              <li key={link.href + link.label}>
                                <NextLink
                                  href={link.href}
                                  onClick={() => setOpen(null)}
                                  className={cn(
                                    "link-sweep text-sm",
                                    link.tone === "sale" ? "text-sale" : "text-ink",
                                  )}
                                >
                                  {link.label}
                                </NextLink>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                      <NextLink
                        href={item.menu.feature.href}
                        onClick={() => setOpen(null)}
                        className="group col-span-4 col-start-9 grid grid-cols-2 items-end gap-6"
                      >
                        <span className="relative block aspect-[3/4] overflow-hidden">
                          <ProductImage
                            src={item.menu.feature.image}
                            alt={item.menu.feature.imageAlt}
                            fill
                            sizes="240px"
                            className="transition-transform duration-slow ease-atelier group-hover:scale-[1.02]"
                          />
                        </span>
                        <span className="pb-2">
                          <span className="text-label text-ink-subtle">
                            {item.menu.feature.eyebrow}
                          </span>
                          <span className="mt-2 block font-display text-2xl">
                            {item.menu.feature.title}
                          </span>
                          <span className="mt-4 inline-block text-label underline underline-offset-4">
                            Shop now
                          </span>
                        </span>
                      </NextLink>
                    </div>
                  </div>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
