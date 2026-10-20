import type { Metadata } from "next";
import { Suspense } from "react";
import { ErrorState } from "@/components/feedback/ErrorState";
import { Link } from "@/components/primitives";
import { ListingSkeleton, ProductListing } from "@/components/plp/ProductListing";
import { POPULAR_CATEGORIES } from "@/config/navigation";

/** Search results are not indexed. */
export const metadata: Metadata = {
  title: "Search",
  // Search result pages are not indexed.
  robots: { index: false, follow: true },
};

async function SearchResults({
  searchParams,
}: {
  searchParams: PageProps<"/search">["searchParams"];
}) {
  const params = await searchParams;
  const raw = params.q;
  const query = (Array.isArray(raw) ? raw[0] : raw)?.trim().slice(0, 80) ?? "";

  if (!query) {
    return (
      <ErrorState
        layout="page"
        title="What are you looking for?"
        description={
          <ul className="mt-2 flex flex-wrap justify-center gap-x-5 gap-y-2">
            {POPULAR_CATEGORIES.map((c) => (
              <li key={c.href}>
                <Link href={c.href}>{c.label}</Link>
              </li>
            ))}
          </ul>
        }
      />
    );
  }

  return (
    <div className="container-page pt-10 pb-24">
      <p className="text-label text-ink-subtle">Search results</p>
      <h1 className="mt-3 mb-8 font-display text-5xl">“{query}”</h1>
      <ProductListing scope={{ query }} searchParams={Promise.resolve(params)} basePath="/search" />
    </div>
  );
}

/** Search results, streamed because they depend on the query string. */
export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return (
    <Suspense
      fallback={
        <div className="container-page pt-10 pb-24">
          <ListingSkeleton />
        </div>
      }
    >
      <SearchResults searchParams={searchParams} />
    </Suspense>
  );
}
