import { listAllProducts } from "@/lib/admin/catalog-service";
import { toCsv } from "@/lib/admin/csv";
import { writeAuditLog } from "@/lib/audit/log";
import { AuthorizationError, requirePermission } from "@/lib/auth/guard";

/** Downloads every product as CSV (the same columns the importer accepts, plus read-only ones). */
export async function GET() {
  let session;
  try {
    session = await requirePermission("catalog.read_drafts");
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return new Response(error.code === "unauthenticated" ? "Sign in" : "Forbidden", {
        status: error.code === "unauthenticated" ? 401 : 403,
      });
    }
    throw error;
  }
  const products = await listAllProducts();
  const csv = toCsv(
    [
      "id",
      "name",
      "description",
      "status",
      "badges",
      "slug",
      "department",
      "category",
      "price_min",
      "price_max",
    ],
    products.map((p) => [
      p.id,
      p.name,
      p.description,
      p.status,
      p.badges.join("|"),
      p.slug,
      p.department,
      p.categoryPath.join("/"),
      (p.priceRange.min / 100).toFixed(2),
      (p.priceRange.max / 100).toFixed(2),
    ]),
  );
  await writeAuditLog({
    actor: session,
    action: "catalog.export_csv",
    target: { type: "products", id: "csv" },
    after: { rows: products.length },
  });
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="products-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
