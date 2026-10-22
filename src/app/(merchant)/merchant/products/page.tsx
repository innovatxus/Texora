import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ProductList } from "@/components/merchant/products/ProductList";
import { ButtonLink } from "@/components/primitives";
import { PRODUCT_STATUS_LABELS } from "@/lib/catalog/product-status";
import { getMerchantContext } from "@/lib/merchant/context";
import { listShopDrafts, type DraftListFilter } from "@/lib/merchant/product-service";
import { listLocations } from "@/lib/merchant/repositories/locations";
import { PRODUCT_STATUSES, type ProductStatus } from "@/lib/validation/catalog";

export const metadata: Metadata = { title: "Products" };

const PAGE_SIZE = 25;

const one = (value: string | string[] | undefined) =>
  typeof value === "string" ? value : undefined;

/** The merchant's products with search, filters, sort and paging in the URL (journey §8). */
export default async function Page({ searchParams }: PageProps<"/merchant/products">) {
  const { session, shop } = await getMerchantContext();
  if (!shop) redirect("/merchant/onboarding/basics");
  const params = await searchParams;
  const statusParam = one(params.status);
  const status =
    statusParam === "low_stock" ||
    (PRODUCT_STATUSES as readonly string[]).includes(statusParam ?? "")
      ? (statusParam as ProductStatus | "low_stock")
      : undefined;
  const stockParam = one(params.stock);
  const sortParam = one(params.sort);
  const pages = Math.max(1, Math.min(40, Number(one(params.pages)) || 1));
  const filter: DraftListFilter = {
    shopId: shop.id,
    status,
    q: one(params.q),
    category: one(params.category),
    stock:
      stockParam === "in" || stockParam === "low" || stockParam === "out" ? stockParam : undefined,
    sort: sortParam === "name" || sortParam === "price" ? sortParam : "updated",
    offset: 0,
    limit: PAGE_SIZE * pages,
  };
  const [list, locations] = await Promise.all([
    listShopDrafts({ session, vendorId: session.vendorId }, filter),
    listLocations(shop.id),
  ]);

  const nextParams = new URLSearchParams(
    Object.entries(params).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : [])),
  );
  nextParams.set("pages", String(pages + 1));
  const filtered = Boolean(filter.q || filter.category || filter.stock || status);

  return (
    <div className="flex max-w-6xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-4xl">Products</h1>
        <ButtonLink href="/merchant/products/new">Add a product</ButtonLink>
      </div>

      <form
        method="get"
        className="flex flex-wrap items-end gap-3"
        role="search"
        aria-label="Filter products"
      >
        <label className="flex flex-col gap-1 text-sm">
          Search
          <input
            name="q"
            defaultValue={filter.q ?? ""}
            placeholder="Search by name or SKU"
            className="h-11 w-64 border border-ink-subtle bg-surface px-3"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Status
          <select
            name="status"
            defaultValue={statusParam ?? ""}
            className="h-11 border border-ink-subtle bg-surface px-2"
          >
            <option value="">All (not archived)</option>
            {PRODUCT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {PRODUCT_STATUS_LABELS[s]}
              </option>
            ))}
            <option value="low_stock">Low stock</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Category
          <select
            name="category"
            defaultValue={filter.category ?? ""}
            className="h-11 border border-ink-subtle bg-surface px-2"
          >
            <option value="">All</option>
            {shop.categoryKeys.map((key) => (
              <option key={key} value={key}>
                {key.replace("/", " › ")}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Stock
          <select
            name="stock"
            defaultValue={stockParam ?? ""}
            className="h-11 border border-ink-subtle bg-surface px-2"
          >
            <option value="">Any</option>
            <option value="in">In stock</option>
            <option value="low">Low</option>
            <option value="out">Out</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Sort
          <select
            name="sort"
            defaultValue={filter.sort}
            className="h-11 border border-ink-subtle bg-surface px-2"
          >
            <option value="updated">Recently updated</option>
            <option value="name">Name</option>
            <option value="price">Price</option>
          </select>
        </label>
        <button type="submit" className="h-11 border border-ink px-4 text-sm">
          Apply
        </button>
      </form>

      {list.total === 0 ? (
        filtered ? (
          <div className="flex flex-col items-start gap-3">
            <p>No products match these filters.</p>
            <ButtonLink href="/merchant/products" variant="secondary">
              Clear filters
            </ButtonLink>
          </div>
        ) : (
          <div className="flex flex-col items-start gap-4 border border-line bg-surface p-8">
            <p className="text-lg">You haven&apos;t added any products yet.</p>
            <ButtonLink href="/merchant/products/new">Add your first product</ButtonLink>
          </div>
        )
      ) : (
        <ProductList
          items={list.items}
          total={list.total}
          nextHref={list.nextOffset !== null ? `/merchant/products?${nextParams.toString()}` : null}
          locations={locations.map((l) => ({ id: l.id, name: l.name }))}
          showingArchived={status === "archived"}
        />
      )}
    </div>
  );
}
