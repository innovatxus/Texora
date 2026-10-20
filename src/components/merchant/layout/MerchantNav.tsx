"use client";

import NextLink from "next/link";
import { usePathname } from "next/navigation";
import type { MerchantNavItem } from "@/config/merchant-nav";
import { cn } from "@/lib/utils/cn";

function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  return href === "/merchant"
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}

/** Desktop sidebar links, marking the current section. */
export function SidebarNav({ items }: { items: readonly MerchantNavItem[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Merchant portal" className="text-sm">
      <ul className="flex flex-col">
        {items.map((item) => (
          <li key={item.href}>
            <NextLink
              href={item.href}
              aria-current={isActive(pathname, item.href) ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center px-3 hover:bg-surface-muted",
                isActive(pathname, item.href) && "bg-surface-muted font-medium",
              )}
            >
              {item.label}
            </NextLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Mobile bottom tab bar: primary sections within thumb reach, 44px+ targets. */
export function BottomTabBar({ items }: { items: readonly MerchantNavItem[] }) {
  const pathname = usePathname();
  const tabs = items.filter((i) => i.mobile);
  return (
    <nav
      aria-label="Merchant portal sections"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul
        className="grid"
        style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
      >
        {tabs.map((item) => (
          <li key={item.href}>
            <NextLink
              href={item.href}
              aria-current={isActive(pathname, item.href) ? "page" : undefined}
              className={cn(
                "flex min-h-14 items-center justify-center px-2 text-xs",
                isActive(pathname, item.href) ? "font-medium text-ink" : "text-ink-soft",
              )}
            >
              {item.label}
            </NextLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
