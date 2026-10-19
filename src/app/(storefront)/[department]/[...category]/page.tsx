import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ProductImage } from "@/components/commerce/ProductImage";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import {
  ListingPageSkeleton,
  ListingSkeleton,
  ProductListing,
} from "@/components/plp/ProductListing";
import { getCategory, getDepartmentCategories } from "@/lib/catalog/queries";
import { DEPARTMENTS } from "@/lib/validation";

const DEPARTMENT_LABELS: Record<string, string> = { women: "Women", men: "Men" };

export async function generateStaticParams() {
  const lists = await Promise.all(DEPARTMENTS.map((d) => getDepartmentCategories(d)));
  return lists
    .flat()
    .filter((c) => c.path.length > 1)
    .map((c) => ({ department: c.department, category: c.path.slice(1) }));
}

async function load(params: PageProps<"/[department]/[...category]">["params"]) {
  const { department, category } = await params;
  const path = [department, ...category];
  return { path, category: await getCategory(path) };
}

export async function generateMetadata({
  params,
}: PageProps<"/[department]/[...category]">): Promise<Metadata> {
  const { path, category } = await load(params);
  if (!category) return {};
  return {
    title: category.seo.title ?? category.name,
    description: category.seo.description,
    alternates: { canonical: `/${path.join("/")}` },
  };
}

async function CategoryContent({ params, searchParams }: PageProps<"/[department]/[...category]">) {
  const { path, category } = await load(params);
  if (!category) notFound();
  const basePath = `/${path.join("/")}`;
  const departmentLabel = DEPARTMENT_LABELS[category.department] ?? category.department;

  return (
    <>
      {category.banner && (
        <div className="relative aspect-[3/1] max-h-80 w-full">
          <ProductImage
            src={category.banner.image.url}
            alt={category.banner.image.alt}
            fill
            priority
            sizes="100vw"
          />
        </div>
      )}
      <div className="container-page pt-8 pb-24">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: departmentLabel, href: `/${category.department}` },
            { label: category.name, href: basePath },
          ]}
        />
        <h1 className="mt-4 mb-8 font-display text-5xl">
          <span className="sr-only">{departmentLabel}&apos;s </span>
          {category.name}
        </h1>
        <Suspense fallback={<ListingSkeleton />}>
          <ProductListing
            scope={{ categoryKey: path.join("/") }}
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

export default async function Page(props: PageProps<"/[department]/[...category]">) {
  if (!(await load(props.params)).category) notFound();
  return (
    <Suspense fallback={<ListingPageSkeleton />}>
      <CategoryContent {...props} />
    </Suspense>
  );
}
