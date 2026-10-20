import "server-only";
import type { DocumentSnapshot } from "firebase-admin/firestore";
import { createElement } from "react";
import { brand } from "@/config/brand";
import { sendEmail } from "@/lib/email/send";
import { ProductAlertEmail } from "@/lib/email/templates/ProductAlert";
import { clientEnv } from "@/lib/env/client";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { logger } from "@/lib/observability/logger";
import { signToken } from "@/lib/orders/token";
import { ONLINE_LOCATION } from "@/lib/validation";

const BATCH = 200;

/** Signed link that lets an email address stop its product alerts. */
export function unsubscribeUrl(email: string): string {
  const url = new URL("/notifications/unsubscribe", clientEnv.NEXT_PUBLIC_SITE_URL);
  url.searchParams.set("email", email);
  url.searchParams.set("t", signToken("unsubscribe", email));
  return url.toString();
}

function absolute(path: string): string {
  return new URL(path, clientEnv.NEXT_PUBLIC_SITE_URL).toString();
}

interface ProductInfo {
  live: boolean;
  name: string;
  slug: string;
  image?: string;
  minPrice: number;
}

function productInfo(snap: DocumentSnapshot): ProductInfo | null {
  if (!snap.exists) return null;
  const colors = (snap.get("colors") as Array<{ images: Array<{ url: string }> }>) ?? [];
  const image = colors[0]?.images[0]?.url;
  return {
    live: snap.get("status") === "live",
    name: String(snap.get("name")),
    slug: String(snap.get("slug")),
    ...(image ? { image: absolute(image) } : {}),
    minPrice: Number(snap.get("priceRange.min")),
  };
}

export interface AlertRun {
  checked: number;
  sent: number;
  failed: number;
}

/**
 * Sends pending back-in-stock and price-drop alerts whose condition is now
 * met, once each. Runs on a schedule (see /api/cron/notifications).
 */
export async function processAlerts(): Promise<AlertRun> {
  const { db } = getFirebaseAdmin();
  const pending = await db
    .collection("notifications")
    .where("status", "==", "pending")
    .limit(BATCH)
    .get();
  const run: AlertRun = { checked: pending.size, sent: 0, failed: 0 };
  if (pending.empty) return run;

  const productIds = [...new Set(pending.docs.map((d) => String(d.get("productId"))))];
  const skus = [
    ...new Set(
      pending.docs
        .filter((d) => d.get("type") === "back_in_stock")
        .map((d) => String(d.get("sku"))),
    ),
  ];
  const [productSnaps, variantSnaps] = await Promise.all([
    db.getAll(...productIds.map((id) => db.collection("products").doc(id))),
    skus.length > 0
      ? db.getAll(...skus.map((sku) => db.collection("variants").doc(sku)))
      : Promise.resolve([]),
  ]);
  const products = new Map(productSnaps.map((s) => [s.id, productInfo(s)]));
  const variants = new Map(variantSnaps.map((s) => [s.id, s]));

  for (const alert of pending.docs) {
    const product = products.get(String(alert.get("productId")));
    if (!product?.live) continue;
    const email = String(alert.get("email"));
    const kind = alert.get("type") as "back_in_stock" | "price_drop";

    let size: string | undefined;
    if (kind === "back_in_stock") {
      const variant = variants.get(String(alert.get("sku")));
      const stock = Number(variant?.get(`stockByLocation.${ONLINE_LOCATION}`) ?? 0);
      if (!variant?.exists || stock <= 0) continue;
      size = String(variant.get("size")).replace("x", " × ");
    } else if (product.minPrice >= Number(alert.get("priceAtSubscribe"))) {
      continue;
    }

    try {
      await sendEmail({
        to: email,
        subject:
          kind === "back_in_stock"
            ? `Back in stock: ${product.name}`
            : `Price drop: ${product.name}`,
        kind,
        ref: alert.id,
        template: createElement(ProductAlertEmail, {
          brandName: brand.name,
          kind,
          productName: product.name,
          productUrl: absolute(`/product/${product.slug}`),
          ...(product.image ? { imageUrl: product.image } : {}),
          ...(size ? { size } : {}),
          ...(kind === "price_drop"
            ? { oldPrice: Number(alert.get("priceAtSubscribe")), newPrice: product.minPrice }
            : {}),
          unsubscribeUrl: unsubscribeUrl(email),
        }),
      });
      await alert.ref.update({ status: "sent", sentAt: new Date() });
      run.sent += 1;
    } catch (error) {
      run.failed += 1;
      logger.error("alerts.send_failed", { id: alert.id, kind, error });
    }
  }
  return run;
}

/** Removes every pending alert for an email address. */
export async function cancelAlerts(email: string): Promise<number> {
  const { db } = getFirebaseAdmin();
  const snapshot = await db
    .collection("notifications")
    .where("email", "==", email)
    .where("status", "==", "pending")
    .get();
  const batch = db.batch();
  snapshot.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  return snapshot.size;
}
