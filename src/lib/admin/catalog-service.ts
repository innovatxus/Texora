import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { ActionError } from "@/lib/actions/run-action";
import { writeAuditLog } from "@/lib/audit/log";
import type { Session } from "@/lib/auth/session";
import { parseSnapshot } from "@/lib/data/firestore";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import {
  categorySchema,
  PRODUCT_BADGES,
  productSchema,
  variantSchema,
  type Category,
  type Product,
  type ProductBadge,
  type PublishStatus,
  type Variant,
} from "@/lib/validation";
import { parseCsvRecords } from "./csv";
import { priceRangeFor } from "./pricing";
import { invalidate } from "./revalidate";

const db = () => getFirebaseAdmin().db;

async function loadProduct(productId: string): Promise<Product> {
  const product = parseSnapshot(
    productSchema,
    await db().collection("products").doc(productId).get(),
  );
  if (!product) throw new ActionError("not_found", "Product not found");
  return product;
}

/** Every product, drafts included, for the back office (a few hundred documents). */
export async function listAllProducts(): Promise<Product[]> {
  const snap = await db().collection("products").get();
  return snap.docs
    .map((d) => parseSnapshot(productSchema, d))
    .filter((p): p is Product => p !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** A product with its variants, drafts included. */
export async function getProductForEdit(
  productId: string,
): Promise<{ product: Product; variants: Variant[] } | null> {
  const product = parseSnapshot(
    productSchema,
    await db().collection("products").doc(productId).get(),
  );
  if (!product) return null;
  const snap = await db().collection("variants").where("productId", "==", productId).get();
  const variants = snap.docs
    .map((d) => parseSnapshot(variantSchema, d, "sku"))
    .filter((v): v is Variant => v !== null);
  return { product, variants };
}

export interface ProductEdit {
  name: string;
  description: string;
  badges: ProductBadge[];
  seoTitle?: string | undefined;
  seoDescription?: string | undefined;
  publishAt?: Date | null | undefined;
}

/** Saves a product's content. Status changes go through {@link setProductStatus}. */
export async function updateProduct(
  actor: Session,
  productId: string,
  edit: ProductEdit,
): Promise<void> {
  const before = await loadProduct(productId);
  const after = {
    name: edit.name,
    description: edit.description,
    badges: edit.badges,
    seo: {
      ...(edit.seoTitle ? { title: edit.seoTitle } : {}),
      ...(edit.seoDescription ? { description: edit.seoDescription } : {}),
    },
    ...(edit.publishAt ? { publishAt: edit.publishAt } : {}),
  };
  await db()
    .collection("products")
    .doc(productId)
    .update({
      ...after,
      ...(edit.publishAt === null ? { publishAt: FieldValue.delete() } : {}),
      updatedAt: new Date(),
    });
  await writeAuditLog({
    actor,
    action: "catalog.update_product",
    target: { type: "product", id: productId },
    before: {
      name: before.name,
      description: before.description,
      badges: before.badges,
      seo: before.seo,
    },
    after,
  });
  invalidate("products", `product:${before.slug}`);
}

/** Publishes, schedules, unpublishes or archives products in bulk. */
export async function setProductStatus(
  actor: Session,
  productIds: readonly string[],
  status: PublishStatus,
): Promise<number> {
  const refs = productIds.map((id) => db().collection("products").doc(id));
  const snaps = await db().getAll(...refs);
  const batch = db().batch();
  let changed = 0;
  const slugs: string[] = [];
  for (const snap of snaps) {
    if (!snap.exists || snap.get("status") === status) continue;
    batch.update(snap.ref, { status, updatedAt: new Date() });
    slugs.push(String(snap.get("slug")));
    changed += 1;
  }
  await batch.commit();
  await writeAuditLog({
    actor,
    action: "catalog.set_status",
    target: { type: "products", id: productIds.slice(0, 20).join(",") },
    after: { status, count: changed },
  });
  invalidate("products", ...slugs.map((s) => `product:${s}`));
  return changed;
}

/** Moves one image of a colour to a new position (drag-and-drop or up/down buttons). */
export async function moveProductImage(
  actor: Session,
  productId: string,
  color: string,
  from: number,
  to: number,
): Promise<void> {
  const product = await loadProduct(productId);
  const colors = product.colors.map((c) => {
    if (c.code !== color) return c;
    if (from < 0 || from >= c.images.length || to < 0 || to >= c.images.length) {
      throw new ActionError("conflict", "That image position doesn't exist");
    }
    const images = [...c.images];
    const [moved] = images.splice(from, 1);
    if (moved) images.splice(to, 0, moved);
    return { ...c, images };
  });
  await db().collection("products").doc(productId).update({ colors, updatedAt: new Date() });
  await writeAuditLog({
    actor,
    action: "catalog.reorder_images",
    target: { type: "product", id: productId },
    after: { color, from, to },
  });
  invalidate("products", `product:${product.slug}`);
}

/**
 * Sets a SKU's price immediately (pricing managers) and recalculates the
 * product's price range and sale badge in the same transaction.
 */
export async function setVariantPrice(
  actor: Session,
  sku: string,
  price: number,
  compareAtPrice: number | null,
  reason: string,
): Promise<void> {
  const { db: firestore } = getFirebaseAdmin();
  let slug = "";
  await firestore.runTransaction(async (tx) => {
    const variantRef = firestore.collection("variants").doc(sku);
    const variant = parseSnapshot(variantSchema, await tx.get(variantRef), "sku");
    if (!variant) throw new ActionError("not_found", "SKU not found");
    const productRef = firestore.collection("products").doc(variant.productId);
    const siblings = await tx.get(
      firestore.collection("variants").where("productId", "==", variant.productId),
    );
    const product = await tx.get(productRef);
    slug = String(product.get("slug"));

    const updated = siblings.docs.map((d) =>
      d.id === sku
        ? { price, ...(compareAtPrice ? { compareAtPrice } : {}) }
        : {
            price: Number(d.get("price")),
            compareAtPrice: d.get("compareAtPrice") as number | undefined,
          },
    );
    const range = priceRangeFor(updated);
    const badges = new Set((product.get("badges") as ProductBadge[] | undefined) ?? []);
    if (range.compareAtMin !== undefined) badges.add("sale");
    else badges.delete("sale");

    tx.update(variantRef, {
      price,
      compareAtPrice: compareAtPrice ?? FieldValue.delete(),
      updatedAt: new Date(),
    });
    tx.update(productRef, {
      priceRange: range,
      badges: PRODUCT_BADGES.filter((b) => badges.has(b)),
      updatedAt: new Date(),
    });
    await writeAuditLog(
      {
        actor,
        action: "pricing.set_price",
        target: { type: "variant", id: sku },
        before: { price: variant.price, compareAtPrice: variant.compareAtPrice ?? null },
        after: { price, compareAtPrice, reason },
      },
      tx,
    );
  });
  invalidate("products", "inventory", `product:${slug}`);
}

/** Files a price change for a pricing manager to approve. */
export async function requestPriceChange(
  actor: Session,
  input: { sku: string; price: number; compareAtPrice: number | null; reason: string },
): Promise<string> {
  const variant = parseSnapshot(
    variantSchema,
    await db().collection("variants").doc(input.sku).get(),
    "sku",
  );
  if (!variant) throw new ActionError("not_found", "SKU not found");
  const ref = await db()
    .collection("priceChangeRequests")
    .add({
      sku: input.sku,
      productId: variant.productId,
      currentPrice: variant.price,
      proposedPrice: input.price,
      ...(input.compareAtPrice ? { proposedCompareAtPrice: input.compareAtPrice } : {}),
      reason: input.reason,
      requestedBy: actor.uid,
      status: "pending",
      createdAt: new Date(),
    });
  await writeAuditLog({
    actor,
    action: "pricing.request_change",
    target: { type: "variant", id: input.sku },
    before: { price: variant.price },
    after: { price: input.price, compareAtPrice: input.compareAtPrice, reason: input.reason },
  });
  return ref.id;
}

/** Approves (and applies) or rejects a pending price change. */
export async function decidePriceChange(
  actor: Session,
  requestId: string,
  decision: "approved" | "rejected",
): Promise<void> {
  const ref = db().collection("priceChangeRequests").doc(requestId);
  const snap = await ref.get();
  if (!snap.exists) throw new ActionError("not_found", "Request not found");
  if (snap.get("status") !== "pending") throw new ActionError("conflict", "Already decided");
  if (snap.get("requestedBy") === actor.uid) {
    throw new ActionError("forbidden", "Someone else must approve your own price change");
  }
  if (decision === "approved") {
    await setVariantPrice(
      actor,
      String(snap.get("sku")),
      Number(snap.get("proposedPrice")),
      (snap.get("proposedCompareAtPrice") as number | undefined) ?? null,
      `Approved request: ${String(snap.get("reason"))}`,
    );
  }
  await ref.update({ status: decision, decidedBy: actor.uid, decidedAt: new Date() });
  await writeAuditLog({
    actor,
    action: `pricing.${decision === "approved" ? "approve" : "reject"}_change`,
    target: { type: "price_change_request", id: requestId },
    after: { status: decision },
  });
}

export interface ImportResult {
  updated: number;
  skipped: number;
  errors: Array<{ row: number; message: string }>;
}

const IMPORT_STATUSES: readonly PublishStatus[] = ["draft", "scheduled", "live", "archived"];

/**
 * Bulk update from CSV (columns: id, plus any of name, description,
 * status, badges separated by "|"). Rows are validated one by one; valid
 * rows are applied, invalid ones reported with their row number.
 */
export async function importProductsCsv(
  actor: Session,
  csv: string,
  options: { canPublish: boolean },
): Promise<ImportResult> {
  const records = parseCsvRecords(csv);
  const result: ImportResult = { updated: 0, skipped: 0, errors: [] };
  if (records.length === 0) throw new ActionError("conflict", "The file has no rows");
  if (records.length > 500) throw new ActionError("conflict", "Import up to 500 rows at a time");
  if (!records[0] || !("id" in records[0])) {
    throw new ActionError("conflict", "The first row must be a header with an id column");
  }

  const snaps = await db().getAll(
    ...records.map((r) =>
      db()
        .collection("products")
        .doc(r.id || "_"),
    ),
  );
  const batch = db().batch();
  const slugs: string[] = [];
  records.forEach((record, i) => {
    const row = i + 2; // Header is row 1.
    const snap = snaps[i];
    if (!record.id || !snap?.exists) {
      result.errors.push({ row, message: `No product with id "${record.id}"` });
      return;
    }
    const update: Record<string, unknown> = {};
    if (record.name) {
      if (record.name.length > 120) {
        result.errors.push({ row, message: "Name is longer than 120 characters" });
        return;
      }
      update.name = record.name;
    }
    if (record.description) update.description = record.description.slice(0, 4000);
    if (record.status) {
      if (!IMPORT_STATUSES.includes(record.status as PublishStatus)) {
        result.errors.push({ row, message: `Unknown status "${record.status}"` });
        return;
      }
      if (!options.canPublish && record.status !== snap.get("status")) {
        result.errors.push({ row, message: "You can't change publish status" });
        return;
      }
      update.status = record.status;
    }
    if (record.badges !== undefined && record.badges !== "") {
      const badges = record.badges.split("|").map((b) => b.trim());
      const unknown = badges.filter((b) => !(PRODUCT_BADGES as readonly string[]).includes(b));
      if (unknown.length > 0) {
        result.errors.push({ row, message: `Unknown badge "${unknown[0]}"` });
        return;
      }
      update.badges = badges;
    }
    if (Object.keys(update).length === 0) {
      result.skipped += 1;
      return;
    }
    batch.update(snap.ref, { ...update, updatedAt: new Date() });
    slugs.push(String(snap.get("slug")));
    result.updated += 1;
  });
  if (result.updated > 0) await batch.commit();
  await writeAuditLog({
    actor,
    action: "catalog.import_csv",
    target: { type: "products", id: "csv" },
    after: { updated: result.updated, skipped: result.skipped, errors: result.errors.length },
  });
  invalidate("products", ...slugs.map((s) => `product:${s}`));
  return result;
}

// ------------------------------------------------------------ categories

/** Every category, drafts included, in tree order. */
export async function listAllCategories(): Promise<Category[]> {
  const snap = await db().collection("categories").get();
  return snap.docs
    .map((d) => parseSnapshot(categorySchema, d))
    .filter((c): c is Category => c !== null)
    .sort(
      (a, b) =>
        a.department.localeCompare(b.department) ||
        a.path.length - b.path.length ||
        a.sortOrder - b.sortOrder,
    );
}

/** Saves a category's details and merchandising rules. */
export async function updateCategory(
  actor: Session,
  categoryId: string,
  edit: Pick<Category, "name" | "sortOrder" | "status" | "merchRules">,
): Promise<void> {
  const ref = db().collection("categories").doc(categoryId);
  const before = parseSnapshot(categorySchema, await ref.get());
  if (!before) throw new ActionError("not_found", "Category not found");
  await ref.update({ ...edit });
  await writeAuditLog({
    actor,
    action: "merch.update_category",
    target: { type: "category", id: categoryId },
    before: {
      name: before.name,
      sortOrder: before.sortOrder,
      status: before.status,
      merchRules: before.merchRules,
    },
    after: edit,
  });
  invalidate("categories");
}
