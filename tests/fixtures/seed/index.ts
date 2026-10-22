// Seeds the Firebase emulators with the demo catalogue for the browser tests.
// Run by tests/e2e-run.ts (`npm run test:e2e`), never by hand; refuses to run
// against anything but the emulators with a demo- project.
import { loadEnvConfig } from "@next/env";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { generateSeed, SEED_PASSWORD } from "./generate";
import { clearEmulators, writeSeed } from "./write";

loadEnvConfig(process.cwd());

async function main() {
  const projectId = process.env.FIREBASE_PROJECT_ID ?? "";
  const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST;
  const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;

  if (!firestoreHost || !authHost || !projectId.startsWith("demo-")) {
    console.error(
      "Refusing to seed: FIRESTORE_EMULATOR_HOST and FIREBASE_AUTH_EMULATOR_HOST must be set " +
        "and FIREBASE_PROJECT_ID must be a demo- project (see tests/emulator.env).",
    );
    process.exit(1);
  }

  const started = Date.now();
  const app = initializeApp({ projectId }, "seed");
  const auth = getAuth(app);
  const db = getFirestore(app);

  console.log(`Seeding ${projectId} (Firestore ${firestoreHost}, Auth ${authHost})…`);
  await clearEmulators(projectId, firestoreHost, authHost);

  const data = generateSeed();
  await writeSeed(db, auth, data);

  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`
Done in ${seconds}s.
  ${data.products.length} products · ${data.variants.length} variants · ${data.categories.length} categories
  ${data.reviews.length} reviews · ${data.stores.length} stores · ${data.promotions.length} promotions
  ${data.authUsers.length} accounts (password for all: ${SEED_PASSWORD})

Sign in as any role with <role>@texora.test, e.g.
  customer@texora.test · loyalty-member@texora.test · customer-service@texora.test
  merchandiser@texora.test · pricing-manager@texora.test · admin@texora.test · super-admin@texora.test

Merchants (sign in at /merchant/sign-in, same password):
  ${data.merchants.summary.join("\n  ")}

Promo codes: WELCOME15, SPEND200 (EXPIRED10 is inactive)
Gift card:   ${data.demoGiftCardCode}
Orders:      ${data.orders
    .slice(0, 3)
    .map((o) => o.number)
    .join(", ")} (look up with ${data.demoOrderEmail})
`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
