/**
 * One-off: moves the live store settings from the original US defaults to
 * Egypt (EGP, two delivery zones, EGP thresholds). Only `settings/store` is
 * touched; feature switches and everything else stay as they are.
 *
 *   npm run migrate:egypt            shows the change (no writes)
 *   npm run migrate:egypt -- --apply writes it
 *
 * Uses FIREBASE_SERVICE_ACCOUNT from .env.local.
 */
import { loadEnvConfig } from "@next/env";
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

async function main() {
  loadEnvConfig(process.cwd());
  const encoded = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!encoded) throw new Error("FIREBASE_SERVICE_ACCOUNT is not set in .env.local");
  const account = JSON.parse(Buffer.from(encoded, "base64").toString("utf8")) as {
    project_id: string;
    client_email: string;
    private_key: string;
  };
  initializeApp({
    credential: cert({
      projectId: account.project_id,
      clientEmail: account.client_email,
      privateKey: account.private_key,
    }),
    projectId: account.project_id,
  });

  const ref = getFirestore().collection("settings").doc("store");
  const before = (await ref.get()).data();
  if (!before) throw new Error("settings/store doesn't exist. Run `npm run bootstrap` first.");

  const egp = (pounds: number) => pounds * 100;
  const change = {
    currency: "EGP",
    freeShippingThreshold: egp(2_500),
    shippingRates: {
      greater_cairo: { standard: egp(60), express: egp(120) },
      rest_of_egypt: { standard: egp(95), express: egp(180) },
    },
    "refundLimits.customer_service": egp(10_000),
    "loyalty.pointsPerCurrencyUnit": 1,
    "loyalty.tierThresholds": { enthusiast: egp(25_000), icon: egp(75_000) },
    updatedAt: new Date(),
  };

  console.log(`Project: ${account.project_id}`);
  console.log(`Current currency: ${String(before.currency)}`);
  console.log("New values:", JSON.stringify(change, null, 2));
  if (!process.argv.includes("--apply")) {
    console.log("\nDry run: nothing written. Add -- --apply to write.");
    return;
  }
  await ref.update(change);
  console.log("\n✓ settings/store updated to Egypt.");
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
