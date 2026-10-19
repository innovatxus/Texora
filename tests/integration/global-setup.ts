import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { generateSeed } from "../../scripts/seed/generate";
import { clearEmulators, writeSeed } from "../../scripts/seed/write";
import { INTEGRATION_PROJECT_ID } from "./env";

/** Seeds the emulators once with exactly what `npm run seed` writes. */
export default async function setup() {
  const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST;
  const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  if (!firestoreHost || !authHost) {
    throw new Error("Run integration tests with `npm run test:integration` (needs the emulators).");
  }
  await clearEmulators(INTEGRATION_PROJECT_ID, firestoreHost, authHost);
  const app = initializeApp({ projectId: INTEGRATION_PROJECT_ID }, "integration-seed");
  await writeSeed(getFirestore(app), getAuth(app), generateSeed());
}
