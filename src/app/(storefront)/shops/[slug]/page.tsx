import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { OpenNow } from "@/components/merchant/shop/OpenNow";
import { ShopHeader } from "@/components/merchant/shop/ShopHeader";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import {
  ListingPageSkeleton,
  ListingSkeleton,
  ProductListing,
} from "@/components/plp/ProductListing";
import { getListingIndex } from "@/lib/catalog/queries";
import { clientEnv } from "@/lib/env/client";
import {
  getPublicShopBySlug,
  listApprovedShopSlugs,
  returnSummary,
} from "@/lib/merchant/storefront";
import { DAY_NAMES, weeklyHours } from "@/lib/stores/hours";

/** Prerenders every approved shop (Cache Components needs at least one entry). */
export async function generateStaticParams() {
  const slugs = await listApprovedShopSlugs();
  // "texora" is a reserved name, never a shop: it renders the not-found page.
  return (slugs.length ? slugs : ["texora"]).map((slug) => ({ slug }));
}

/** Title, description and canonical URL for a shop. */
export async function generateMetadata({ params }: PageProps<"/shops/[slug]">): Promise<Metadata> {
  const data = await getPublicShopBySlug((await params).slug);
  if (!data) return { title: "Page not found", robots: { index: false } };
  const { shop } = data;
  return {
    title: shop.name,
    description: shop.tagline || shop.description.slice(0, 155) || `Shop ${shop.name} on Texora.`,
    alternates: { canonical: `/shops/${shop.slug}` },
    ...(shop.banner
      ? { openGraph: { images: [{ url: shop.banner.url, alt: shop.banner.alt }] } }
      : {}),
  };
}

async function ShopJsonLd({ slug }: { slug: string }) {
  const data = await getPublicShopBySlug(slug);
  if (!data) return null;
  const { shop } = data;
  const site = clientEnv.NEXT_PUBLIC_SITE_URL;
  const products = (await getListingIndex()).filter((p) => p.shop?.id === shop.id).slice(0, 30);
  const json = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: shop.name,
      url: new URL(`/shops/${shop.slug}`, site).toString(),
      ...(shop.logo ? { logo: new URL(shop.logo.url, site).toString() } : {}),
      ...(shop.description ? { description: shop.description } : {}),
      ...(shop.contact.email ? { email: shop.contact.email } : {}),
      address: data.stores.map((l) => ({
        "@type": "PostalAddress",
        streetAddress: l.address.line1,
        addressLocality: l.address.city,
        addressRegion: l.address.region,
        postalCode: l.address.postalCode,
        addressCountry: "US",
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      itemListElement: products.map((p, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: new URL(`/product/${p.slug}`, site).toString(),
        name: p.name,
      })),
    },
  ];
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(json).replace(/</g, "\\u003c") }}
    />
  );
}

async function ShopContent({ params, searchParams }: PageProps<"/shops/[slug]">) {
  const { slug } = await params;
  const data = await getPublicShopBySlug(slug);
  if (!data) notFound();
  const { shop, stores } = data;
  const basePath = `/shops/${shop.slug}`;

  return (
    <>
      <ShopJsonLd slug={slug} />
      <ShopHeader shop={shop} priority />
      <div className="container-page pt-8 pb-24">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: shop.name, href: basePath },
          ]}
          className="mb-6"
        />
        <p className="mb-8 text-sm text-ink-soft">{returnSummary(shop.returnPolicy)}</p>

        {stores.length > 0 && (
          <section aria-labelledby="visit" className="mb-12 border-y border-line py-8">
            <h2 id="visit" className="font-display text-2xl">
              Visit us
            </h2>
            <ul className="mt-6 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {stores.map((store) => (
                <li key={store.id} className="flex flex-col gap-2 text-sm">
                  <p className="font-medium">{store.name}</p>
                  <address className="text-ink-soft not-italic">
                    {store.address.line1}
                    {store.address.line2 ? `, ${store.address.line2}` : ""}
                    <br />
                    {store.address.city}, {store.address.region} {store.address.postalCode}
                  </address>
                  <OpenNow location={store} />
                  <details>
                    <summary className="min-h-11 cursor-pointer content-center underline underline-offset-4">
                      Opening hours<span className="sr-only"> for {store.name}</span>
                    </summary>
                    <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-ink-soft">
                      {weeklyHours(store).map((d) => (
                        <div key={d.day} className="contents">
                          <dt>{DAY_NAMES[d.day]}</dt>
                          <dd>{d.text}</dd>
                        </div>
                      ))}
                    </dl>
                  </details>
                </li>
              ))}
            </ul>
          </section>
        )}

        <h2 className="mb-6 font-display text-3xl">Shop {shop.name}</h2>
        <Suspense fallback={<ListingSkeleton />}>
          <ProductListing
            scope={{ shopId: shop.id }}
            emptyScope={{
              title: `${shop.name} hasn't listed anything yet`,
              description: "Check back soon.",
            }}
            searchParams={searchParams}
            basePath={basePath}
          />
        </Suspense>
      </div>
    </>
  );
}

/**
 * Unknown or unapproved shops answer with a real 404, which is only possible
 * before streaming starts, so params are validated up front.
 */
export const instant = false;

/** A merchant's shop page: banner, story, stores and products (journey §14). */
export default async function Page(props: PageProps<"/shops/[slug]">) {
  if (!(await getPublicShopBySlug((await props.params).slug))) notFound();
  return (
    <Suspense fallback={<ListingPageSkeleton />}>
      <ShopContent {...props} />
    </Suspense>
  );
}
