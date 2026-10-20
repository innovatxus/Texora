import type { Metadata } from "next";
import NextLink from "next/link";
import { Suspense } from "react";
import { AdminNav, AdminNavFallback } from "@/components/admin/AdminNav";
import { SignOutButton } from "@/components/admin/SignOutButton";
import { SkipLink } from "@/components/navigation/Logo";
import { Skeleton } from "@/components/primitives";
import { ADMIN_NAV } from "@/config/admin-nav";
import { brand } from "@/config/brand";
import { requirePagePermission } from "@/lib/auth/guard";
import { hasPermission, ROLE_LABELS } from "@/lib/auth/rbac";

/** The back office is private: never indexed. */
export const metadata: Metadata = {
  title: { template: `%s · ${brand.name} back office`, default: `${brand.name} back office` },
  robots: { index: false, follow: false },
};

async function Chrome({ children }: { children: React.ReactNode }) {
  // The proxy already gates /admin; this re-checks against the live session.
  const session = await requirePagePermission("admin.access");
  const groups = ADMIN_NAV.map((g) => ({
    ...g,
    items: g.items.filter((i) => hasPermission(session.role, i.permission)),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="flex min-h-screen flex-1 flex-col lg:flex-row">
      <aside className="border-b border-line bg-surface lg:w-56 lg:shrink-0 lg:border-r lg:border-b-0">
        <div className="flex items-center justify-between px-6 py-5 lg:block">
          <NextLink href="/admin" className="font-display text-lg tracking-[0.28em] uppercase">
            {brand.name}
          </NextLink>
          <p className="text-xs text-ink-subtle lg:mt-1">Back office</p>
        </div>
        <div className="overflow-x-auto px-3 pb-5">
          <Suspense fallback={<AdminNavFallback groups={groups} />}>
            <AdminNav groups={groups} />
          </Suspense>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col bg-canvas">
        <header className="flex flex-wrap items-center justify-end gap-x-6 gap-y-2 border-b border-line px-6 py-3 text-sm">
          <span className="text-ink-soft">
            {session.email ?? session.uid} · {ROLE_LABELS[session.role]}
          </span>
          <NextLink href="/" className="underline underline-offset-4">
            View store
          </NextLink>
          <SignOutButton />
        </header>
        <main id="main" tabIndex={-1} className="flex-1 px-6 py-6 outline-none">
          {children}
        </main>
      </div>
    </div>
  );
}

/** Back office chrome: sidebar navigation for the role, user bar and content area. */
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <>
      <SkipLink />
      <Suspense
        fallback={
          <div className="flex min-h-screen">
            <Skeleton className="hidden w-56 lg:block" />
            <div className="flex-1 p-6">
              <Skeleton className="h-10 w-64" />
              <Skeleton className="mt-6 h-96" />
            </div>
          </div>
        }
      >
        <Chrome>{children}</Chrome>
      </Suspense>
    </>
  );
}
