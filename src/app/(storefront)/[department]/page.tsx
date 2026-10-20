import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ModuleRenderer } from "@/components/editorial/ModuleRenderer";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import {
  ListingPageSkeleton,
  ListingSkeleton,
  ProductListing,
} from "@/components/plp/ProductListing";
import { GRID_TILES } from "@/config/merchandising";
import { getLivePage } from "@/lib/cms/pages";
import { DEPARTMENTS, type Department } from "@/lib/validation";

const LABELS: Record<Department, string> = { women: "Women", men: "Men" };

function asDepartment(value: string): Department | null {
  return (DEPARTMENTS as readonly string[]).includes(value) ? (value as Department) : null;
}

/** Prerenders the Women and Men landing pages. */
export function generateStaticParams() {
  return DEPARTMENTS.map((department) => ({ department }));
}

/** Title, description and canonical URL for a department landing page. */
export async function generateMetadata({ params }: PageProps<"/[department]">): Promise<Metadata> {
  const department = asDepartment((await params).department);
  if (!department) return {};
  const page = await getLivePage(department);
  return {
    title: page?.seo.title ?? LABELS[department],
    description: page?.seo.description,
    // Filtered views canonicalise to the unfiltered department.
    alternates: { canonical: `/${department}` },
  };
}

async function DepartmentContent({ params, searchParams }: PageProps<"/[department]">) {
  const department = asDepartment((await params).department);
  if (!department) notFound();
  const page = await getLivePage(department);
  const label = LABELS[department];

  return (
    <>
      {page && <ModuleRenderer modules={page.modules} />}
      <section
        id="shop"
        aria-labelledby="shop-all"
        className="container-page scroll-mt-24 section-y"
      >
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label, href: `/${department}` },
          ]}
        />
        <h2 id="shop-all" className="mt-4 mb-8 font-display text-4xl">
          Shop all {label.toLowerCase()}
        </h2>
        <Suspense fallback={<ListingSkeleton />}>
          <ProductListing
            scope={{ department }}
            searchParams={searchParams}
            basePath={`/${department}`}
            tiles={GRID_TILES[department] ?? []}
          />
        </Suspense>
      </section>
    </>
  );
}

/**
 * Unknown URLs must answer with a real 404 status, which is only possible
 * before streaming starts, so the route validates its params up front.
 * Every known URL is prerendered; the listing still streams behind Suspense.
 */
export const instant = false;

/** Department landing page: CMS modules followed by the full department listing. */
export default async function Page(props: PageProps<"/[department]">) {
  if (!asDepartment((await props.params).department)) notFound();
  return (
    <Suspense fallback={<ListingPageSkeleton />}>
      <DepartmentContent {...props} />
    </Suspense>
  );
}
