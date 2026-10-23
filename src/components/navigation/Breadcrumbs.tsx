import NextLink from "next/link";
import { clientEnv } from "@/lib/env/client";
import { cn } from "@/lib/utils/cn";

export interface Crumb {
  label: string;
  href: string;
}

/** Trail with the current page last (not a link). Optional BreadcrumbList JSON-LD. */
export function Breadcrumbs({
  items,
  structuredData = true,
  className,
}: {
  items: readonly Crumb[];
  structuredData?: boolean;
  className?: string;
}) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.label,
      item: new URL(item.href, clientEnv.NEXT_PUBLIC_SITE_URL).toString(),
    })),
  };
  return (
    <nav aria-label="Breadcrumb" className={cn("text-xs text-ink-subtle", className)}>
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={item.href} className="flex items-center gap-2">
              {last ? (
                <span aria-current="page" className="text-ink">
                  {item.label}
                </span>
              ) : (
                <>
                  <NextLink href={item.href} className="link-sweep">
                    {item.label}
                  </NextLink>
                  <span aria-hidden>/</span>
                </>
              )}
            </li>
          );
        })}
      </ol>
      {structuredData && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
        />
      )}
    </nav>
  );
}
