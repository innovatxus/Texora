import NextLink from "next/link";
import { cacheLife } from "next/cache";
import { NewsletterForm } from "@/components/marketing/NewsletterForm";
import { Link } from "@/components/primitives";
import { brand } from "@/config/brand";
import { FOOTER_COLUMNS, LEGAL_LINKS, SOCIAL_LINKS } from "@/config/navigation";
import { CookieSettingsButton, CountrySelector } from "./FooterControls";
import { Logo } from "./Logo";

/** Generic, self-drawn payment glyphs (no card-network marks). */
const PAYMENT_METHODS = [
  {
    label: "Credit and debit cards",
    path: "M3 6.5h18v11H3z M3 10h18 M6 14.5h4",
  },
  {
    label: "Digital wallets",
    path: "M8 3.5h8a1.5 1.5 0 0 1 1.5 1.5v14a1.5 1.5 0 0 1-1.5 1.5H8A1.5 1.5 0 0 1 6.5 19V5A1.5 1.5 0 0 1 8 3.5z M10.5 17.5h3",
  },
  {
    label: "Gift cards",
    path: "M3 8.5h18v11H3z M3 12h18 M12 8.5v11 M12 8.5c-1.5-3-5-3-5-1s3.5 1 5 1c1.5 0 5 1 5-1s-3.5-2-5 1",
  },
  {
    label: "Pay on delivery",
    path: "M3 7h18v10H3z M12 12m-2.5 0a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0 M6 10v4 M18 10v4",
  },
] as const;

/** Cached so the static shell can prerender; refreshed daily. */
async function CopyrightYear() {
  "use cache";
  cacheLife("days");
  return <>{new Date().getFullYear()}</>;
}

export function Footer() {
  return (
    <footer className="mt-auto border-t border-line bg-surface-muted print:hidden">
      <div className="container-page grid gap-12 section-y lg:grid-cols-12">
        <div className="lg:col-span-4">
          <h2 className="font-display text-3xl">Letters from {brand.name}</h2>
          <p className="mt-3 max-w-sm text-ink-soft">
            New arrivals, early access to the sale and notes on how our pieces are made.
          </p>
          <NewsletterForm source="footer" className="mt-6 max-w-md" />
        </div>

        <nav
          aria-label="Footer"
          className="grid grid-cols-2 gap-8 sm:grid-cols-4 lg:col-span-7 lg:col-start-6"
        >
          {FOOTER_COLUMNS.map((column) => (
            <div key={column.title}>
              <h2 className="text-label">{column.title}</h2>
              <ul className="mt-4 flex flex-col gap-3">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} variant="quiet" className="text-sm">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      <div className="border-t border-line">
        <div className="container-page flex flex-col gap-6 py-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
            <Logo compact />
            <CountrySelector />
            <ul aria-label="Follow us" className="flex gap-5">
              {SOCIAL_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} variant="quiet" className="text-sm">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <ul
            aria-label="Payment methods we accept"
            className="flex items-center gap-4 text-ink-soft"
          >
            {PAYMENT_METHODS.map((method) => (
              <li key={method.label} title={method.label}>
                <svg
                  viewBox="0 0 24 24"
                  width={28}
                  height={28}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.25}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  role="img"
                  aria-label={method.label}
                >
                  <path d={method.path} />
                </svg>
              </li>
            ))}
          </ul>
        </div>
        <div className="container-page flex flex-col gap-3 pb-8 text-xs text-ink-subtle sm:flex-row sm:items-center sm:justify-between">
          <p>
            © <CopyrightYear /> {brand.name}. All rights reserved.
          </p>
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            {LEGAL_LINKS.map((link) =>
              link.href === "#cookie-settings" ? (
                <li key={link.href}>
                  <CookieSettingsButton className="underline-offset-4 hover:text-ink hover:underline" />
                </li>
              ) : (
                <li key={link.href}>
                  <NextLink
                    href={link.href}
                    className="underline-offset-4 hover:text-ink hover:underline"
                  >
                    {link.label}
                  </NextLink>
                </li>
              ),
            )}
          </ul>
        </div>
      </div>
    </footer>
  );
}
