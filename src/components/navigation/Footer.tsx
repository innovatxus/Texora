import NextLink from "next/link";
import { cacheLife } from "next/cache";
import { PaymentMarks } from "@/components/commerce/PaymentMarks";
import { NewsletterForm } from "@/components/marketing/NewsletterForm";
import { Link } from "@/components/primitives";
import { brand } from "@/config/brand";
import { FOOTER_COLUMNS, LEGAL_LINKS } from "@/config/navigation";
import { getStores } from "@/lib/catalog/queries";
import { CookieSettingsButton } from "./FooterControls";
import { Logo } from "./Logo";
import { SocialIcons } from "./SocialIcons";

/** Cached so the static shell can prerender; refreshed daily. */
async function CopyrightYear() {
  "use cache";
  cacheLife("days");
  return <>{new Date().getFullYear()}</>;
}

/** The live stores, under "Find a store": only stores that exist (cached with the store list). */
async function StoreLinks() {
  const stores = (await getStores().catch(() => [])).filter((s) => s.status !== "closed");
  return stores.map((store) => (
    <li key={store.id}>
      <Link href={`/stores/${store.slug}`} variant="quiet" className="text-sm">
        {store.name}
      </Link>
    </li>
  ));
}

/** Site footer: newsletter signup, link columns, social links, payment methods and legal links. */
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
          className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:col-span-8 lg:col-start-5 lg:grid-cols-5"
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
                {column.title === "Stores" && <StoreLinks />}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      <div className="border-t border-line">
        <div className="container-page flex flex-col gap-6 py-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
            <Logo compact />
            <SocialIcons />
          </div>
          <PaymentMarks />
        </div>
        <div className="container-page flex flex-col gap-3 pb-8 text-xs text-ink-subtle sm:flex-row sm:items-center sm:justify-between">
          <p>
            © <CopyrightYear /> {brand.name}. All rights reserved.
          </p>
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            {LEGAL_LINKS.map((link) =>
              link.href === "#cookie-settings" ? (
                <li key={link.href}>
                  <CookieSettingsButton className="link-sweep" />
                </li>
              ) : (
                <li key={link.href}>
                  <NextLink href={link.href} className="link-sweep">
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
