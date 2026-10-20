import type { Metadata } from "next";
import NextLink from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { AdminLoading } from "@/components/admin/AdminLoading";
import { CsvImportForm } from "@/components/admin/CsvImportForm";
import { ProductBulkTable, type ProductRow } from "@/components/admin/ProductBulkTable";
import { AdminField, AdminPageHeader, adminControl, FilterBar, Panel } from "@/components/admin/ui";
import { listAllProducts } from "@/lib/admin/catalog-service";
import { requirePagePermission } from "@/lib/auth/guard";
import { hasPermission } from "@/lib/auth/rbac";
import { formatMoney } from "@/lib/format/money";
import { DEPARTMENTS } from "@/lib/validation";

/** Products list title. */
export const metadata: Metadata = { title: "Products" };

const param = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
const PAGE_SIZE = 50;

async function Catalog({ searchParams }: PageProps<"/admin/catalog">) {
  await connection();
  const session = await requirePagePermission("catalog.read_drafts");
  const sp = await searchParams;
  const q = param(sp.q)?.trim().toLowerCase() ?? "";
  const status = param(sp.status);
  const department = param(sp.department);
  const page = Math.max(1, Number(param(sp.page) ?? 1) || 1);

  const matches = (await listAllProducts()).filter(
    (p) =>
      (!q || p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)) &&
      (!status || p.status === status) &&
      (!department || p.department === department),
  );
  const shown = matches.slice(0, page * PAGE_SIZE);
  const rows: ProductRow[] = shown.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    status: p.status,
    category: p.categoryPath.join(" / "),
    colors: p.colors.length,
    price:
      p.priceRange.min === p.priceRange.max
        ? formatMoney(p.priceRange.min)
        : `${formatMoney(p.priceRange.min)} – ${formatMoney(p.priceRange.max)}`,
  }));
  const more = new URLSearchParams(
    Object.entries({ q, status, department, page: String(page + 1) }).filter(
      (e): e is [string, string] => Boolean(e[1]),
    ),
  );

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader
        title="Products"
        description={`${matches.length} products`}
        actions={
          // A GET form, not a link: it downloads a file and must never be prefetched.
          <form action="/api/admin/catalog/export" method="get">
            <button
              type="submit"
              className="inline-flex h-10 items-center border border-ink px-4 text-label hover:bg-ink hover:text-surface"
            >
              Export CSV
            </button>
          </form>
        }
      />
      <FilterBar action="/admin/catalog">
        <AdminField label="Name or id">
          <input name="q" defaultValue={q} className={`${adminControl} w-56`} />
        </AdminField>
        <AdminField label="Status">
          <select name="status" defaultValue={status ?? ""} className={adminControl}>
            <option value="">All</option>
            {["draft", "scheduled", "live", "archived"].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </AdminField>
        <AdminField label="Department">
          <select name="department" defaultValue={department ?? ""} className={adminControl}>
            <option value="">All</option>
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </AdminField>
      </FilterBar>
      <ProductBulkTable rows={rows} canPublish={hasPermission(session.role, "catalog.publish")} />
      {shown.length < matches.length && (
        <NextLink href={`/admin/catalog?${more}`} className="self-center text-sm underline">
          Show more ({matches.length - shown.length} left)
        </NextLink>
      )}
      {hasPermission(session.role, "catalog.write") && (
        <Panel title="Import from CSV">
          <CsvImportForm />
        </Panel>
      )}
    </div>
  );
}

/** Products: search, filters, bulk status changes and CSV import/export. */
export default function Page(props: PageProps<"/admin/catalog">) {
  return (
    <Suspense fallback={<AdminLoading />}>
      <Catalog {...props} />
    </Suspense>
  );
}
