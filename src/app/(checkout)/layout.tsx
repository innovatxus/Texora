import type { Metadata } from "next";
import NextLink from "next/link";
import { Logo, SkipLink } from "@/components/navigation/Logo";
import { brand } from "@/config/brand";
import { StoreHydration } from "@/stores/StoreHydration";

/** Checkout pages are never indexed. */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/** Minimal checkout chrome: no mega menu, search or footer links to pull people away. */
export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SkipLink />
      <header className="border-b border-line bg-canvas">
        <div className="container-page flex h-16 items-center justify-between lg:h-20">
          <Logo />
          <div className="flex items-center gap-6 text-sm">
            <span className="hidden text-ink-soft sm:inline">Secure checkout</span>
            <NextLink href="/bag" className="underline underline-offset-4">
              Back to bag
            </NextLink>
          </div>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="flex flex-1 flex-col outline-none">
        {children}
      </main>
      <footer className="border-t border-line">
        <p className="container-page py-6 text-xs text-ink-subtle">
          © {brand.name}. Need help? Call (212) 555-0141 or visit our{" "}
          <NextLink href="/help" className="underline underline-offset-4">
            help centre
          </NextLink>
          .
        </p>
      </footer>
      <StoreHydration />
    </>
  );
}
