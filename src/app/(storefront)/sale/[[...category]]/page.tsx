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
import { getLivePage } from "@/lib/cms/pages";
import { DEPARTMENTS, type Department } from "@/lib/validation";

const LABELS: Record<Department, string> = { women: "Women's sale", men: "Men's sale" };

/** Prerenders the sale page for everything and for each department. */
export function generateStaticParams() {
  return [{ category: [] }, ...DEPARTMENTS.map((d) => ({ category: [d] }))];
}

function parse(category: string[] | undefined): { department?: Department; valid: boolean } {
  const [first, ...rest] = category ?? [];
  if (!first) return { valid: true };
  if (rest.length > 0 || !(DEPARTMENTS as readonly string[]).includes(first))
    return { valid: false };
  return { department: first as Department, valid: true };
}

/** Title and canonical URL for a sale listing. */
export async function generateMetadata({
  params,
}: PageProps<"/sale/[[...category]]">): Promise<Metadata> {
  const { department } = parse((await params).category);
  return {
    title: department ? LABELS[department] : "Sale",
    description: "Selected styles, reduced.",
    alternates: { canonical: department ? `/sale/${department}` : "/sale" },
  };
}

async function SaleContent({ params, searchParams }: PageProps<"/sale/[[...category]]">) {
  const { department, valid } = parse((await params).category);
  if (!valid) notFound();
  const page = department ? null : await getLivePage("sale");
  const basePath = department ? `/sale/${department}` : "/sale";

  return (
    <>
      {page && <ModuleRenderer modules={page.modules} />}
      <div className="container-page section-y">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Sale", href: "/sale" },
            ...(department ? [{ label: LABELS[department], href: basePath }] : []),
          ]}
        />
        {page ? (
          <h2 className="mt-4 mb-8 font-display text-4xl">Shop the sale</h2>
        ) : (
          <h1 className="mt-4 mb-8 font-display text-5xl">
            {department ? LABELS[department] : "Sale"}
          </h1>
        )}
        <Suspense fallback={<ListingSkeleton />}>
          <ProductListing
            scope={{ sale: true, ...(department ? { department } : {}) }}
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

/** Sale listing, optionally limited to a department. */
export default async function Page(props: PageProps<"/sale/[[...category]]">) {
  if (!parse((await props.params).category).valid) notFound();
  return (
    <Suspense fallback={<ListingPageSkeleton />}>
      <SaleContent {...props} />
    </Suspense>
  );
}
