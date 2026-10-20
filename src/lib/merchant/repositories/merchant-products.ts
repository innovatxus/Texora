import "server-only";
import { paginate, parseSnapshot, type Page, type PageRequest } from "@/lib/data/firestore";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { productSchema, variantSchema, type Product, type Variant } from "@/lib/validation";
import { productDraftSchema, type ProductDraft } from "@/lib/validation/merchant";

const db = () => getFirebaseAdmin().db;

export interface MerchantProductFilter extends PageRequest {
  shopId: string;
  status?: Product["status"];
}

/**
 * A shop's products, most recently changed first, cursor-paginated. Callers
 * pass a shop id they have already checked the merchant owns.
 */
export async function listMerchantProducts({
  shopId,
  status,
  ...page
}: MerchantProductFilter): Promise<Page<Product>> {
  let base: FirebaseFirestore.Query = db().collection("products").where("shopId", "==", shopId);
  if (status) base = base.where("status", "==", status);
  return paginate(base, [{ field: "updatedAt", direction: "desc" }], page, (d) =>
    parseSnapshot(productSchema, d),
  );
}

/** A product the merchant owns; null when missing or someone else's. */
export async function getOwnedProduct(
  vendorId: string,
  productId: string,
): Promise<Product | null> {
  const product = parseSnapshot(
    productSchema,
    await db().collection("products").doc(productId).get(),
  );
  return product && product.vendorId === vendorId ? product : null;
}

/** All variants of a product. */
export async function getMerchantVariants(productId: string): Promise<Variant[]> {
  const snapshot = await db().collection("variants").where("productId", "==", productId).get();
  return snapshot.docs
    .map((d) => parseSnapshot(variantSchema, d, "sku"))
    .filter((v): v is Variant => v !== null);
}

/** The autosaved editor state for a product the merchant owns. */
export async function getOwnedDraft(
  vendorId: string,
  productId: string,
): Promise<ProductDraft | null> {
  const draft = parseSnapshot(
    productDraftSchema,
    await db().collection("productDrafts").doc(productId).get(),
  );
  return draft && draft.vendorId === vendorId ? draft : null;
}
