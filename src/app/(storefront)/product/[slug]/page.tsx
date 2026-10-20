import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ProductCard } from "@/components/commerce/ProductCard";
import { ProductRail } from "@/components/editorial/ProductCarousel";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { DetailsAccordion } from "@/components/pdp/DetailsAccordion";
import {
  ProductDetail,
  ProductDetailFromParams,
  type PdpProductView,
} from "@/components/pdp/ProductDetail";
import { RecentlyViewed } from "@/components/pdp/RecentlyViewed";
import { Reviews } from "@/components/pdp/Reviews";
import { brand } from "@/config/brand";
import { sizeGuideFor } from "@/config/size-guides";
import { sortProducts } from "@/lib/catalog/listing";
import { getPdpData, listLiveProductSlugs, type PdpData } from "@/lib/catalog/pdp";
import { getListingIndex, getProductsForIds } from "@/lib/catalog/queries";
import { clientEnv } from "@/lib/env/client";

/** Prerenders every live product page. */
export async function generateStaticParams() {
  return (await listLiveProductSlugs()).map((slug) => ({ slug }));
}

/** Title, description, canonical URL and share image for a product. */
export async function generateMetadata({
  params,
}: PageProps<"/product/[slug]">): Promise<Metadata> {
  const data = await getPdpData((await params).slug);
  if (!data) return {};
  const { product } = data;
  const image = product.colors[0]?.images[0];
  return {
    title: product.seo.title ?? product.name,
    description: product.seo.description ?? product.description.slice(0, 155),
    alternates: { canonical: `/product/${product.slug}` },
    openGraph: {
      type: "website",
      title: product.name,
      ...(image ? { images: [{ url: image.url, alt: image.alt }] } : {}),
    },
  };
}

function productJsonLd(data: PdpData) {
  const { product, variants, summary } = data;
  const url = new URL(`/product/${product.slug}`, clientEnv.NEXT_PUBLIC_SITE_URL).toString();
  const inStock = variants.some((v) => v.online > 0);
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    sku: product.styleId,
    brand: { "@type": "Brand", name: brand.name },
    image: product.colors.flatMap((c) =>
      c.images.slice(0, 1).map((i) => new URL(i.url, clientEnv.NEXT_PUBLIC_SITE_URL).toString()),
    ),
    url,
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "USD",
      lowPrice: (product.priceRange.min / 100).toFixed(2),
      highPrice: (product.priceRange.max / 100).toFixed(2),
      offerCount: variants.length,
      availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url,
    },
    ...(summary.count > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: summary.average,
            reviewCount: summary.count,
          },
        }
      : {}),
  };
}

async function CompleteTheLook({ ids }: { ids: string[] }) {
  const products = await getProductsForIds(ids);
  if (products.length === 0) return null;
  return (
    <section className="container-page section-y">
      <h2 className="font-display text-3xl">Complete the look</h2>
      <ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3">
        {products.map((p) => (
          <li key={p.id}>
            <ProductCard product={p} sizes="(min-width: 768px) 33vw, 50vw" />
          </li>
        ))}
      </ul>
    </section>
  );
}

async function YouMayAlsoLike({
  productId,
  categoryKey,
}: {
  productId: string;
  categoryKey: string;
}) {
  const index = await getListingIndex();
  const similar = sortProducts(
    index.filter((p) => p.id !== productId && p.categoryPath.join("/") === categoryKey),
    "best_sellers",
  ).slice(0, 8);
  if (similar.length === 0) return null;
  return <ProductRail heading="You may also like" products={similar} />;
}

/**
 * Unknown slugs must answer 404 before streaming starts; every live product
 * is prerendered, and ?color= is read on the client behind Suspense.
 */
export const instant = false;

/** Product detail page (PDP): gallery, buy box, details, recommendations and reviews. */
export default async function ProductPage({ params }: PageProps<"/product/[slug]">) {
  const data = await getPdpData((await params).slug);
  if (!data) notFound();
  const { product, variants, reviews, summary, categoryName } = data;
  const departmentLabel = product.department === "women" ? "Women" : "Men";
  const categoryHref = `/${product.categoryPath.join("/")}`;
  const defaultColor = product.colors[0]?.code ?? "";

  const view: PdpProductView = {
    id: product.id,
    slug: product.slug,
    name: product.name,
    fitFamilies: product.fitFamilies,
    colors: product.colors.map((c) => ({
      code: c.code,
      name: c.name,
      swatch: c.swatch,
      images: c.images.map((i) => ({ url: i.url, alt: i.alt })),
    })),
    priceRange: product.priceRange,
    badges: product.badges,
    ratingAvg: summary.average,
    ratingCount: summary.count,
    fitScore: summary.fit,
    finalSale: product.badges.includes("final_sale"),
  };

  const shared = {
    product: view,
    variants,
    sizeGuide: sizeGuideFor(product.department, product.sizeType),
    breadcrumbs: (
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: departmentLabel, href: `/${product.department}` },
          { label: categoryName, href: categoryHref },
          { label: product.name, href: `/product/${product.slug}` },
        ]}
      />
    ),
    details: (
      <DetailsAccordion
        sections={[
          {
            id: "description",
            title: "Description",
            content: <p className="max-w-prose">{product.description}</p>,
          },
          {
            id: "fit",
            title: "Fit & sizing",
            content: (
              <ul className="flex flex-col gap-2">
                {product.details.fitNotes && <li>{product.details.fitNotes}</li>}
                {product.details.modelInfo && <li>{product.details.modelInfo}</li>}
                <li>
                  Available in{" "}
                  {product.fitFamilies
                    .map((f) => f.charAt(0).toUpperCase() + f.slice(1))
                    .join(", ")}
                  .
                </li>
              </ul>
            ),
          },
          {
            id: "fabric",
            title: "Fabric & care",
            content: (
              <ul className="flex list-disc flex-col gap-1 pl-5">
                {product.details.fabricCare.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ),
          },
          {
            id: "shipping",
            title: "Shipping & returns",
            content: (
              <p className="max-w-prose">
                Free standard shipping on orders over $150. Free returns within 30 days by mail or
                in store.
                {product.badges.includes("final_sale") &&
                  " This item is final sale and can't be returned or exchanged."}
              </p>
            ),
          },
        ]}
      />
    ),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(productJsonLd(data)).replace(/</g, "\\u003c"),
        }}
      />
      <div className="container-page pt-6 pb-16 lg:pt-10">
        <Suspense fallback={<ProductDetail {...shared} initialColor={defaultColor} />}>
          <ProductDetailFromParams {...shared} defaultColor={defaultColor} />
        </Suspense>
      </div>
      <CompleteTheLook ids={product.completeTheLook} />
      <YouMayAlsoLike productId={product.id} categoryKey={product.categoryPath.join("/")} />
      <Reviews
        productId={product.id}
        productName={product.name}
        reviews={reviews}
        summary={summary}
        fitFamilies={product.fitFamilies}
      />
      <RecentlyViewed excludeId={product.id} />
    </>
  );
}
