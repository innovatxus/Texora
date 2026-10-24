/**
 * Adds categories that exist in the code but not yet in the live project
 * (e.g. new accessory and fashion categories), so merchants can sell in them
 * and shoppers can browse them. Existing categories are never changed.
 *
 *   npm run migrate:categories            shows what would be added (no writes)
 *   npm run migrate:categories -- --apply adds them
 *
 * Uses FIREBASE_SERVICE_ACCOUNT from .env.local.
 */
import { loadEnvConfig } from "@next/env";
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { buildCategories } from "./store/structure";

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
  const db = getFirestore();
  const apply = process.argv.includes("--apply");
  console.log(`Project: ${account.project_id}${apply ? "" : " (dry run)"}`);

  const existing = new Set((await db.collection("categories").listDocuments()).map((d) => d.id));
  const missing = buildCategories().filter((c) => !existing.has(c.id));
  if (missing.length === 0) {
    console.log("Every category is already there.");
    return;
  }
  for (const c of missing) console.log(`  add ${c.path.join("/")} — ${c.name}`);
  if (!apply) {
    console.log(`\n${missing.length} to add. Add -- --apply to write.`);
    return;
  }
  const batch = db.batch();
  for (const { id, ...data } of missing) batch.create(db.collection("categories").doc(id), data);
  await batch.commit();
  console.log(`\n✓ Added ${missing.length} categories.`);
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
