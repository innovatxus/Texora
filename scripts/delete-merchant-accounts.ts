/**
 * Deletes merchant accounts completely: the login (Firebase Auth user), the
 * user profile, the merchant record, username, shops (with locations), shop
 * addresses, product drafts, uploaded media and their emails in the outbox.
 * Refuses a merchant with live products or merchant orders. The audit log is
 * kept (it is an append-only record).
 *
 *   npm run delete-merchants                      every merchant (dry run)
 *   npm run delete-merchants -- --email a@b.com   one merchant (dry run)
 *   add -- --apply to delete
 *
 * Uses FIREBASE_SERVICE_ACCOUNT from .env.local.
 */
import { loadEnvConfig } from "@next/env";
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, type DocumentReference } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

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
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  });
  const db = getFirestore();
  const auth = getAuth();
  const apply = process.argv.includes("--apply");
  const emailArg = process.argv.indexOf("--email");
  const only = emailArg > -1 ? process.argv[emailArg + 1]?.toLowerCase() : undefined;
  console.log(`Project: ${account.project_id}${apply ? "" : " (dry run)"}`);

  const merchants = (await db.collection("merchants").get()).docs.filter(
    (m) => !only || String(m.get("email") ?? "").toLowerCase() === only,
  );
  if (merchants.length === 0) {
    console.log("No merchant accounts match.");
    return;
  }

  for (const merchant of merchants) {
    const vendorId = merchant.id;
    const uid = String(merchant.get("ownerUid") ?? "");
    const email = String(merchant.get("email") ?? "");
    console.log(`\nMerchant ${email} (vendor ${vendorId}, login ${uid || "none"})`);

    const [live, orders] = await Promise.all([
      db.collection("products").where("vendorId", "==", vendorId).limit(1).get(),
      db.collection("orders").where("vendorIds", "array-contains", vendorId).limit(1).get(),
    ]);
    if (!live.empty || !orders.empty) {
      console.log("  skipped: has products on the storefront or orders. Unpublish/settle first.");
      continue;
    }

    const shops = await db.collection("shops").where("vendorId", "==", vendorId).get();
    const refs: DocumentReference[] = [merchant.ref];
    const recursive: DocumentReference[] = shops.docs.map((s) => s.ref);
    for (const s of shops.docs) {
      const slug = s.get("slug") as string | undefined;
      if (slug) refs.push(db.collection("shopSlugs").doc(slug));
    }
    const username = merchant.get("username") as string | undefined;
    if (username) refs.push(db.collection("usernames").doc(username));
    const drafts = await db.collection("productDrafts").where("vendorId", "==", vendorId).get();
    const media = await db.collection("merchantMedia").where("vendorId", "==", vendorId).get();
    const mail = email ? await db.collection("emailOutbox").where("to", "==", email).get() : null;
    refs.push(...drafts.docs.map((d) => d.ref), ...media.docs.map((d) => d.ref));
    refs.push(...(mail?.docs.map((d) => d.ref) ?? []));
    if (uid) recursive.push(db.collection("users").doc(uid));

    console.log(
      `  ${shops.size} shop(s), ${drafts.size} draft(s), ${media.size} photo record(s), ${mail?.size ?? 0} outbox email(s), username ${username ?? "—"}, profile and login`,
    );
    if (!apply) continue;

    for (const ref of recursive) await db.recursiveDelete(ref);
    const batch = db.batch();
    for (const ref of refs) batch.delete(ref);
    await batch.commit();
    // Uploaded files live under the merchant's folder in Storage.
    try {
      await getStorage()
        .bucket()
        .deleteFiles({ prefix: `merchant-media/${vendorId}/` });
    } catch (error) {
      console.log(`  photos in Storage not removed: ${(error as Error).message.slice(0, 120)}`);
    }
    if (uid) {
      try {
        await auth.deleteUser(uid);
      } catch (error) {
        if ((error as { code?: string }).code !== "auth/user-not-found") throw error;
      }
    }
    console.log("  ✓ deleted");
  }
  if (!apply) console.log("\nDry run: nothing deleted. Add -- --apply to delete.");
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
