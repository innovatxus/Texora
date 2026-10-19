"use client";

import NextLink from "next/link";
import { useRef, useState } from "react";
import { ProductImage } from "@/components/commerce/ProductImage";
import { PriceDisplay } from "@/components/commerce/PriceDisplay";
import { Drawer } from "@/components/feedback/Drawer";
import {
  AccountIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  HeartIcon,
  StoreIcon,
} from "@/components/icons";
import { IconButton } from "@/components/primitives";
import { MAIN_NAV, type NavDepartment } from "@/config/navigation";
import { cn } from "@/lib/utils/cn";
import { useRecentlyViewedStore } from "@/stores/recentlyViewed";
import { useUiStore } from "@/stores/ui";
import { Logo } from "./Logo";

const SHORTCUTS = [
  { label: "Sign in or create an account", href: "/account", icon: AccountIcon },
  { label: "Wishlist", href: "/account/wishlist", icon: HeartIcon },
  { label: "Find a store", href: "/stores", icon: StoreIcon },
] as const;

/** Full-height drawer with drill-down panels per department. */
export function MobileNav() {
  const isOpen = useUiStore((s) => s.panel === "mobile-nav");
  const setOpen = useUiStore((s) => s.setOpen);
  const close = useUiStore((s) => s.close);
  const recentlyViewed = useRecentlyViewedStore((s) => s.items);
  const [active, setActive] = useState<NavDepartment | null>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const triggerRefs = useRef(new Map<string, HTMLButtonElement>());

  const openPanel = (dept: NavDepartment) => {
    setActive(dept);
    window.requestAnimationFrame(() => backRef.current?.focus());
  };
  const closePanel = () => {
    const id = active?.id;
    setActive(null);
    window.requestAnimationFrame(() => (id ? triggerRefs.current.get(id)?.focus() : undefined));
  };

  return (
    <Drawer
      open={isOpen}
      onOpenChange={(open) => {
        setOpen("mobile-nav", open);
        if (!open) setActive(null);
      }}
      side="left"
      title="Menu"
      hideHeader
    >
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-line px-4">
        <Logo compact />
        <IconButton
          label="Close menu"
          icon={<CloseIcon size={24} />}
          onClick={close}
          className="-mr-2"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {active?.menu ? (
          <nav aria-label={active.label} className="animate-fade-in">
            <button
              ref={backRef}
              type="button"
              onClick={closePanel}
              className="flex h-14 w-full items-center gap-2 border-b border-line px-4 text-label"
            >
              <ChevronLeftIcon /> All departments
            </button>
            <p className="px-4 pt-6 font-display text-3xl">{active.label}</p>
            <NextLink
              href={active.href}
              onClick={close}
              className="block px-4 pt-2 pb-4 text-sm underline underline-offset-4"
            >
              Shop all {active.label.toLowerCase()}
            </NextLink>
            {active.menu.columns.map((column) => (
              <section key={column.title} className="border-t border-line px-4 py-5">
                <h2 className="text-label text-ink-subtle">{column.title}</h2>
                <ul className="mt-3 flex flex-col">
                  {column.links.map((link) => (
                    <li key={link.href + link.label}>
                      <NextLink
                        href={link.href}
                        onClick={close}
                        className={cn(
                          "block py-2.5 text-base",
                          link.tone === "sale" ? "text-sale" : "text-ink",
                        )}
                      >
                        {link.label}
                      </NextLink>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </nav>
        ) : (
          <nav aria-label="Departments" className="animate-fade-in">
            <ul>
              {MAIN_NAV.map((dept) => (
                <li key={dept.id} className="border-b border-line">
                  {dept.menu ? (
                    <button
                      ref={(el) => {
                        if (el) triggerRefs.current.set(dept.id, el);
                      }}
                      type="button"
                      onClick={() => openPanel(dept)}
                      aria-label={`${dept.label}, open submenu`}
                      className="flex h-14 w-full items-center justify-between px-4 text-left text-label"
                    >
                      {dept.label}
                      <ChevronRightIcon />
                    </button>
                  ) : (
                    <NextLink
                      href={dept.href}
                      onClick={close}
                      className={cn(
                        "flex h-14 items-center px-4 text-label",
                        dept.tone === "sale" && "text-sale",
                      )}
                    >
                      {dept.label}
                    </NextLink>
                  )}
                </li>
              ))}
            </ul>

            {recentlyViewed.length > 0 && (
              <section className="px-4 pt-8">
                <h2 className="text-label text-ink-subtle">Recently viewed</h2>
                <ul className="mt-4 flex gap-3 overflow-x-auto pb-2">
                  {recentlyViewed.slice(0, 6).map((item) => (
                    <li key={item.productId} className="w-28 shrink-0">
                      <NextLink href={`/product/${item.slug}`} onClick={close} className="block">
                        <span className="relative block aspect-[3/4]">
                          <ProductImage src={item.image} alt={item.name} fill sizes="112px" />
                        </span>
                        <span className="mt-2 block truncate text-xs">{item.name}</span>
                        <PriceDisplay
                          size="sm"
                          price={item.price}
                          compareAtPrice={item.compareAtPrice}
                          showPercent={false}
                          className="text-xs"
                        />
                      </NextLink>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <ul className="mt-8 border-t border-line px-4 py-4">
              {SHORTCUTS.map(({ label, href, icon: Icon }) => (
                <li key={href}>
                  <NextLink
                    href={href}
                    onClick={close}
                    className="flex items-center gap-3 py-3 text-sm"
                  >
                    <Icon /> {label}
                  </NextLink>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>
    </Drawer>
  );
}
