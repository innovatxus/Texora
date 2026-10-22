"use client";

import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { ACCOUNT_NAV } from "@/config/account-nav";
import { cn } from "@/lib/utils/cn";

/** Account menu: a sidebar on desktop, a scrolling row on phones. */
export function AccountNav() {
  const pathname = usePathname();
  const current = (href: string) =>
    href === "/account" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <nav aria-label="Account" className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
      <ul className="flex gap-1 lg:flex-col">
        {ACCOUNT_NAV.map((item) => (
          <li key={item.href} className="shrink-0">
            <NextLink
              href={item.href}
              aria-current={current(item.href) ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center px-3 text-sm whitespace-nowrap transition-colors duration-fast",
                current(item.href)
                  ? "bg-surface font-medium text-ink"
                  : "text-ink-soft hover:bg-surface hover:text-ink",
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
