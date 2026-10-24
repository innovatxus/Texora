import type { Metadata } from "next";
import NextLink from "next/link";
import { Logo, SkipLink } from "@/components/navigation/Logo";
import { brand } from "@/config/brand";

/** The back office sign-in is never indexed. */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/** Focused chrome for the team's sign-in: logo, "Back office", a way back to the shop. */
export default function StaffAuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SkipLink />
      <header className="border-b border-line bg-canvas">
        <div className="container-page flex h-16 items-center justify-between gap-4 lg:h-20">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="text-label text-ink-soft">Back office</span>
          </div>
          <NextLink href="/" className="text-sm underline underline-offset-4">
            Go to the shop
          </NextLink>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="flex flex-1 flex-col outline-none">
        {children}
      </main>
      <footer className="border-t border-line">
        <p className="container-page py-6 text-xs text-ink-subtle">
          © {brand.name}. For the {brand.name} team only. Access is logged.
        </p>
      </footer>
    </>
  );
}
