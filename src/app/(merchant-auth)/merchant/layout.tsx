import type { Metadata } from "next";
import NextLink from "next/link";
import { Logo, SkipLink } from "@/components/navigation/Logo";
import { brand } from "@/config/brand";

/** Merchant sign-up, sign-in and recovery pages are never indexed. */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/** Focused chrome for merchant account pages: logo, a way back, help. */
export default function MerchantAuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SkipLink />
      <header className="border-b border-line bg-canvas">
        <div className="container-page flex h-16 items-center justify-between gap-4 lg:h-20">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="text-label text-ink-soft">Merchants</span>
          </div>
          <NextLink href="/merchants" className="text-sm underline underline-offset-4">
            About selling on {brand.name}
          </NextLink>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="flex flex-1 flex-col outline-none">
        {children}
      </main>
      <footer className="border-t border-line">
        <p className="container-page py-6 text-xs text-ink-subtle">
          © {brand.name}. Questions? Read{" "}
          <NextLink href="/help/merchants" className="underline underline-offset-4">
            merchant help
          </NextLink>{" "}
          or email {brand.support.email}.
        </p>
      </footer>
    </>
  );
}
