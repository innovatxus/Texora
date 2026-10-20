import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import {
  ListingPageSkeleton,
  ListingSkeleton,
  ProductListing,
} from "@/components/plp/ProductListing";
import { getCollection } from "@/lib/catalog/queries";

/** Prerenders the seeded collections. */
export function generateStaticParams() {
  return [{ slug: "the-linen-edit" }, { slug: "new-arrivals" }, { slug: "knitwear" }];
}

/** Title, description and canonical URL for a collection. */
export async function generateMetadata({
  params,
}: PageProps<"/collections/[slug]">): Promise<Metadata> {
  const collection = await getCollection((await params).slug);
  if (!collection) return {};
  return {
    title: collection.seo.title ?? collection.name,
    description: collection.seo.description ?? collection.description,
    alternates: { canonical: `/collections/${collection.slug}` },
  };
}

async function CollectionContent({ params, searchParams }: PageProps<"/collections/[slug]">) {
  const collection = await getCollection((await params).slug);
  if (!collection) notFound();
  const basePath = `/collections/${collection.slug}`;

  return (
    <>
      <header className="bg-surface-muted">
        <div className="container-page section-y text-center">
          <p className="text-label text-ink-subtle">Collection</p>
          <h1 className="mt-4 font-display text-5xl">{collection.name}</h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-ink-soft">{collection.description}</p>
        </div>
      </header>
      <div className="container-page pt-8 pb-24">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: collection.name, href: basePath },
          ]}
          className="mb-8"
        />
        <Suspense fallback={<ListingSkeleton />}>
          <ProductListing
            scope={{ collection: collection.slug }}
            searchParams={searchParams}
            basePath={basePath}
          />
        </Suspense>
      </div>
    </>
  );
}

/**
 * Unknown URLs must answer with a real 404 status, which is only possible
 * before streaming starts, so the route validates its params up front.
 * Every known URL is prerendered; the listing still streams behind Suspense.
 */
export const instant = false;

/** Collection listing with filters, sort and pagination. */
export default async function Page(props: PageProps<"/collections/[slug]">) {
  if (!(await getCollection((await props.params).slug))) notFound();
  return (
    <Suspense fallback={<ListingPageSkeleton />}>
      <CollectionContent {...props} />
    </Suspense>
  );
}
