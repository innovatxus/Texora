import "server-only";
import { forbidden } from "next/navigation";
import { cache } from "react";
import { requirePagePermission } from "@/lib/auth/guard";
import type { Session } from "@/lib/auth/session";
import type { Merchant, Shop } from "@/lib/validation/merchant";
import { syncEmailVerified } from "./account-service";
import { getMerchant } from "./repositories/merchants";
import { listShopsForVendor } from "./repositories/shops";

export interface MerchantContext {
  session: Session & { vendorId: string };
  merchant: Merchant;
  shops: Shop[];
}

/**
 * The signed-in merchant, their account and shops, for portal pages. Loaded
 * once per request (React `cache`), re-checked against the live session, and
 * derived only from the session's vendorId, never from the URL.
 */
export const getMerchantContext = cache(async (): Promise<MerchantContext> => {
  const session = await requirePagePermission("vendor.catalog.write");
  const vendorId = session.vendorId;
  if (!vendorId) forbidden();

  const merchant = await getMerchant(vendorId);
  if (!merchant || merchant.ownerUid !== session.uid) forbidden();

  // A link opened on another device verifies in Firebase Auth first.
  const emailVerified = merchant.emailVerified || (await syncEmailVerified(session.uid, vendorId));
  const shops = await listShopsForVendor(vendorId);
  return { session: { ...session, vendorId }, merchant: { ...merchant, emailVerified }, shops };
});
