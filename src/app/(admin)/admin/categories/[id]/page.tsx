import type { Metadata } from "next";
import NextLink from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AdminLoading } from "@/components/admin/AdminLoading";
import { CategoryEditor } from "@/components/admin/CategoryEditor";
import { AdminPageHeader, Panel } from "@/components/admin/ui";
import { listAllCategories, listAllProducts } from "@/lib/admin/catalog-service";
import { requirePagePermission } from "@/lib/auth/guard";

/** Category editor title. */
export const metadata: Metadata = { title: "Category" };

async function EditCategory({ params }: PageProps<"/admin/categories/[id]">) {
  await requirePagePermission("merch.write");
  const { id } = await params;
  const [categories, products] = await Promise.all([listAllCategories(), listAllProducts()]);
  const category = categories.find((c) => c.id === id);
  if (!category) notFound();
  const key = category.path.join("/");
  const inCategory = products
    .filter((p) => p.categoryKeys.includes(key) && p.status !== "archived")
    .map((p) => ({ id: p.id, name: p.name, status: p.status }));

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader
        eyebrow={
          <NextLink href="/admin/categories" className="underline">
            Categories
          </NextLink>
        }
        title={category.name}
        description={`/${key} · ${inCategory.length} products`}
        actions={
          category.status === "live" && (
            <NextLink href={`/${key}`} target="_blank" className="text-sm underline">
              View on site<span className="sr-only"> (opens in a new tab)</span>
            </NextLink>
          )
        }
      />
      <Panel>
        <CategoryEditor
          category={{
            id: category.id,
            name: category.name,
            sortOrder: category.sortOrder,
            status: category.status,
            merchRules: category.merchRules,
          }}
          products={inCategory}
        />
      </Panel>
    </div>
  );
}

/** One category: details and merchandising rules. */
export default function Page(props: PageProps<"/admin/categories/[id]">) {
  return (
    <Suspense fallback={<AdminLoading />}>
      <EditCategory {...props} />
    </Suspense>
  );
}
