import "server-only";
import { createElement } from "react";
import { brand } from "@/config/brand";
import { ActionError } from "@/lib/actions/run-action";
import { invalidate } from "@/lib/admin/revalidate";
import { writeAuditLog, type AuditEntry } from "@/lib/audit/log";
import { sendEmail } from "@/lib/email/send";
import { ShopDecisionEmail } from "@/lib/email/templates/MerchantShop";
import { clientEnv } from "@/lib/env/client";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { logger } from "@/lib/observability/logger";
import type { ShopStatus, TrustLevel } from "@/lib/validation/merchant";
import { syncShopProducts } from "./publishing/publish";
import { getMerchant } from "./repositories/merchants";
import { getShop } from "./repositories/shops";
import { assertShopTransition, TransitionError } from "./status";

type Reviewer = AuditEntry["actor"];
export type ShopDecision = "approve" | "changes" | "reject" | "suspend" | "reinstate";

const TARGET: Record<ShopDecision, ShopStatus> = {
  approve: "approved",
  changes: "changes_requested",
  reject: "draft",
  suspend: "suspended",
  reinstate: "approved",
};

const NOTE: Record<
  ShopDecision,
  "approved" | "changes_requested" | "rejected" | "suspended" | "reinstated"
> = {
  approve: "approved",
  changes: "changes_requested",
  reject: "rejected",
  suspend: "suspended",
  reinstate: "reinstated",
};

/**
 * A reviewer's decision on a shop. Approving or reinstating makes the shop
 * and its live products visible; suspending hides them within one
 * revalidation. Reasons are required for anything but approval and
 * reinstatement, and are shown to the merchant. Audited and emailed.
 */
export async function decideShop(
  reviewer: Reviewer,
  shopId: string,
  decision: ShopDecision,
  reasons: readonly string[],
  now = new Date(),
): Promise<ShopStatus> {
  const shop = await getShop(shopId);
  if (!shop) throw new ActionError("not_found", "We couldn't find that shop.");
  const to = TARGET[decision];
  try {
    assertShopTransition(shop.status, to, "admin");
  } catch (error) {
    if (error instanceof TransitionError) {
      throw new ActionError(
        "conflict",
        `This shop is ${shop.status.replace("_", " ")}, so that isn't possible.`,
      );
    }
    throw error;
  }
  const needsReason = decision === "changes" || decision === "reject" || decision === "suspend";
  const cleaned = reasons.map((r) => r.trim()).filter(Boolean);
  if (needsReason && cleaned.length === 0) {
    throw new ActionError("conflict", "Give the merchant a reason.", "reasons");
  }

  await getFirebaseAdmin()
    .db.collection("shops")
    .doc(shop.id)
    .update({
      status: to,
      ...(decision === "approve" ? { approvedAt: now } : {}),
      ...(cleaned.length ? { statusReason: cleaned.join(" ") } : {}),
      reviewNotes: [
        ...shop.reviewNotes,
        { at: now, byUid: reviewer.uid, decision: NOTE[decision], reasons: cleaned },
      ],
      updatedAt: now,
    });
  await writeAuditLog({
    actor: reviewer,
    action: `shops.${{ approve: "approve", changes: "request_changes", reject: "reject", suspend: "suspend", reinstate: "reinstate" }[decision]}`,
    target: { type: "shop", id: shop.id },
    before: { status: shop.status },
    after: { status: to, ...(cleaned.length ? { reasons: cleaned } : {}) },
  });

  invalidate("shops", `shop:${shop.slug}`);
  if (decision === "approve" || decision === "suspend" || decision === "reinstate") {
    await syncShopProducts(shop.id, now);
    invalidate("products");
  }

  const merchant = await getMerchant(shop.vendorId);
  if (merchant) {
    try {
      await sendEmail({
        to: merchant.email,
        subject: {
          approve: `Your shop is live on ${brand.name}`,
          changes: "A few changes before your shop goes live",
          reject: "We can't approve your shop yet",
          suspend: `Your ${brand.name} shop has been paused`,
          reinstate: "Your shop is live again",
        }[decision],
        template: createElement(ShopDecisionEmail, {
          brandName: brand.name,
          shopName: shop.name,
          decision: NOTE[decision],
          reasons: cleaned,
          link: new URL("/merchant", clientEnv.NEXT_PUBLIC_SITE_URL).toString(),
        }),
        kind: "merchant_shop_decision",
        ref: shop.id,
      });
    } catch (error) {
      logger.error("merchant.shop_decision_email_failed", { shopId, error });
    }
  }
  return to;
}

/** Trusted merchants publish without product review. */
export async function setTrustLevel(
  reviewer: Reviewer,
  vendorId: string,
  trustLevel: TrustLevel,
  now = new Date(),
): Promise<void> {
  const merchant = await getMerchant(vendorId);
  if (!merchant) throw new ActionError("not_found", "We couldn't find that merchant.");
  if (merchant.trustLevel === trustLevel) return;
  await getFirebaseAdmin()
    .db.collection("merchants")
    .doc(vendorId)
    .update({ trustLevel, updatedAt: now });
  await writeAuditLog({
    actor: reviewer,
    action: "merchants.set_trust",
    target: { type: "merchant", id: vendorId },
    before: { trustLevel: merchant.trustLevel },
    after: { trustLevel },
  });
}
