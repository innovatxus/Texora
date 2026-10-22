import type { Metadata } from "next";
import NextLink from "next/link";
import { Suspense } from "react";
import { SignOutButton } from "@/components/admin/SignOutButton";
import { ResendVerificationButton } from "@/components/merchant/auth/VerifyEmail";
import { BottomTabBar, SidebarNav } from "@/components/merchant/layout/MerchantNav";
import { ShopSwitcher } from "@/components/merchant/layout/ShopSwitcher";
import { SkipLink } from "@/components/navigation/Logo";
import { Skeleton } from "@/components/primitives";
import { brand } from "@/config/brand";
import { MERCHANT_NAV } from "@/config/merchant-nav";
import { getMerchantContext } from "@/lib/merchant/context";

/** The merchant portal is private: never indexed. */
export const metadata: Metadata = {
  title: { template: `%s · ${brand.name} merchants`, default: `${brand.name} merchants` },
  robots: { index: false, follow: false },
};

async function Shell({ children }: { children: React.ReactNode }) {
  // The proxy gates /merchant; this re-checks the live session and loads the account.
  const { merchant, shops, shop } = await getMerchantContext();

  return (
    <div className="flex min-h-screen flex-1 flex-col pb-16 lg:flex-row lg:pb-0">
      <aside className="hidden border-r border-line bg-surface lg:block lg:w-56 lg:shrink-0">
        <div className="px-6 py-5">
          <NextLink href="/merchant" className="font-display text-lg tracking-[0.28em] uppercase">
            {brand.name}
          </NextLink>
          <p className="mt-1 text-xs text-ink-subtle">Merchant portal</p>
        </div>
        <div className="px-3 pb-5">
          <SidebarNav items={MERCHANT_NAV} />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col bg-canvas">
        <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-line px-4 py-3 text-sm sm:px-6">
          <NextLink href="/merchant" className="font-display tracking-[0.28em] uppercase lg:hidden">
            {brand.name}
          </NextLink>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 lg:ml-auto">
            {shops.length > 1 && shop && (
              <ShopSwitcher
                shops={shops.map((s) => ({ id: s.id, name: s.name }))}
                current={shop.id}
              />
            )}
            <span className="text-ink-soft">@{merchant.username}</span>
            <NextLink href="/" className="underline underline-offset-4">
              View store
            </NextLink>
            <SignOutButton />
          </div>
        </header>
        {!merchant.emailVerified && (
          <div
            role="region"
            aria-label="Email verification"
            className="flex flex-col gap-2 border-b border-warning/40 bg-surface px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6"
          >
            <p>
              Verify your email to submit your shop and publish products. We sent a link to{" "}
              <strong>{merchant.email}</strong>.
            </p>
            <ResendVerificationButton />
          </div>
        )}
        <main id="main" tabIndex={-1} className="flex-1 px-4 py-6 outline-none sm:px-6">
          {children}
        </main>
      </div>
      <BottomTabBar items={MERCHANT_NAV} />
    </div>
  );
}

/** Portal chrome: desktop sidebar, mobile bottom tab bar, account bar, verification banner. */
export default function MerchantLayout({ children }: LayoutProps<"/merchant">) {
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
        <Shell>{children}</Shell>
      </Suspense>
    </>
  );
}
