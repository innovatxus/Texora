/**
 * One-off: brings live CMS pages in line with the campaign photography.
 * Images themselves need no change (they keep their /media/stock paths);
 * this updates each photo's description (alt text) and gives the men's hero
 * dark copy, since the new photo has a light wall where the headline sits.
 *
 *   npm run migrate:campaign            shows the changes (no writes)
 *   npm run migrate:campaign -- --apply writes them
 *
 * Uses FIREBASE_SERVICE_ACCOUNT from .env.local.
 */
import { loadEnvConfig } from "@next/env";
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { CAMPAIGN, type CampaignKey } from "./stock-catalog";

const STOCK_PATH = /\/media\/stock\/([A-Za-z]+)-(?:tile|desktop|mobile)\.jpg$/;

/** Walks any value, fixing image alts by URL and the men's hero tone. Returns the change list. */
function fix(value: unknown, changes: string[], path: string): unknown {
  if (Array.isArray(value)) return value.map((v, i) => fix(v, changes, `${path}[${i}]`));
  if (!value || typeof value !== "object") return value;
  // Leave Firestore values (Timestamps, references…) untouched; only plain maps are walked.
  if (Object.getPrototypeOf(value) !== Object.prototype) return value;
  const record = { ...(value as Record<string, unknown>) };
  for (const [key, child] of Object.entries(record))
    record[key] = fix(child, changes, `${path}.${key}`);

  const url =
    typeof record.url === "string"
      ? record.url
      : typeof (record.desktop as { url?: unknown } | undefined)?.url === "string"
        ? String((record.desktop as { url: string }).url)
        : null;
  const slot = url ? (STOCK_PATH.exec(url)?.[1] as CampaignKey | undefined) : undefined;
  if (slot && slot in CAMPAIGN && "alt" in record) {
    const alt = CAMPAIGN[slot].alt;
    if (record.alt !== alt) {
      changes.push(`${path}.alt → "${alt}"`);
      record.alt = alt;
    }
  }
  const image = record.image as { desktop?: { url?: string } } | undefined;
  if (image?.desktop?.url?.includes("/media/stock/heroMen-") && record.tone === "light") {
    changes.push(`${path}.tone → "dark"`);
    record.tone = "dark";
  }
  return record;
}

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

  let total = 0;
  for (const collection of ["pages", "site"]) {
    const snapshot = await db.collection(collection).get();
    for (const doc of snapshot.docs) {
      const changes: string[] = [];
      const data = doc.data();
      const next: Record<string, unknown> = {};
      for (const [field, value] of Object.entries(data)) {
        next[field] = fix(value, changes, field);
      }
      if (changes.length === 0) continue;
      total += changes.length;
      console.log(`\n${collection}/${doc.id}`);
      for (const change of changes) console.log(`  ${change}`);
      if (apply) {
        const updates = Object.fromEntries(
          Object.keys(next)
            .filter((field) => JSON.stringify(next[field]) !== JSON.stringify(data[field]))
            .map((field) => [field, next[field]]),
        );
        await doc.ref.update({ ...updates, updatedAt: new Date() });
      }
    }
  }
  console.log(
    total === 0
      ? "\nNothing to change."
      : apply
        ? `\n✓ ${total} change(s) written.`
        : `\n${total} change(s). Add -- --apply to write.`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
