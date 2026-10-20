"use client";

import NextLink from "next/link";
import { usePathname } from "next/navigation";
import type { AdminNavGroup } from "@/config/admin-nav";
import { cn } from "@/lib/utils/cn";

/** Sidebar links, already filtered to what the signed-in role can open. */
export function AdminNav({ groups }: { groups: readonly AdminNavGroup[] }) {
  const pathname = usePathname();
  const active = (href: string) =>
    href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <nav aria-label="Back office" className="flex flex-col gap-6 text-sm">
      {groups.map((group) => (
        <div key={group.title}>
          <p className="px-3 text-xs text-ink-subtle">{group.title}</p>
          <ul className="mt-1 flex flex-col">
            {group.items.map((item) => (
              <li key={item.href}>
                <NextLink
                  href={item.href}
                  aria-current={active(item.href) ? "page" : undefined}
                  className={cn(
                    "block px-3 py-1.5 hover:bg-surface-muted",
                    active(item.href) && "bg-surface-muted font-medium",
                  )}
                >
                  {item.label}
                </NextLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/** Static version for the Suspense fallback and the server render. */
export function AdminNavFallback({ groups }: { groups: readonly AdminNavGroup[] }) {
  return (
    <nav aria-label="Back office" className="flex flex-col gap-6 text-sm">
      {groups.map((group) => (
        <div key={group.title}>
          <p className="px-3 text-xs text-ink-subtle">{group.title}</p>
          <ul className="mt-1 flex flex-col">
            {group.items.map((item) => (
              <li key={item.href}>
                <NextLink href={item.href} className="block px-3 py-1.5 hover:bg-surface-muted">
                  {item.label}
                </NextLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
