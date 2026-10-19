import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore, type Firestore } from "firebase/firestore";
import { connectStorageEmulator, getStorage, type FirebaseStorage } from "firebase/storage";
import { clientEnv } from "@/lib/env/client";

export interface FirebaseClient {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  storage: FirebaseStorage;
}

export const EMULATOR_PORTS = {
  auth: 9099,
  firestore: 8080,
  storage: 9199,
} as const;

// Survives module re-evaluation during Fast Refresh, where connecting an
// emulator a second time would throw.
const globalForFirebase = globalThis as typeof globalThis & {
  __texoraFirebaseClient?: FirebaseClient;
};

/**
 * Browser Firebase SDK, initialised once. Only repositories in `lib/data`
 * should call this; components never touch Firebase directly.
 */
export function getFirebaseClient(): FirebaseClient {
  const cached = globalForFirebase.__texoraFirebaseClient;
  if (cached) return cached;

  const app =
    getApps()[0] ??
    initializeApp({
      apiKey: clientEnv.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: clientEnv.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: clientEnv.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: clientEnv.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      appId: clientEnv.NEXT_PUBLIC_FIREBASE_APP_ID,
    });

  const client: FirebaseClient = {
    app,
    auth: getAuth(app),
    db: getFirestore(app),
    storage: getStorage(app),
  };

  if (clientEnv.NEXT_PUBLIC_USE_FIREBASE_EMULATORS) {
    const host = clientEnv.NEXT_PUBLIC_FIREBASE_EMULATOR_HOST;
    connectAuthEmulator(client.auth, `http://${host}:${EMULATOR_PORTS.auth}`, {
      disableWarnings: true,
    });
    connectFirestoreEmulator(client.db, host, EMULATOR_PORTS.firestore);
    connectStorageEmulator(client.storage, host, EMULATOR_PORTS.storage);
  }

  globalForFirebase.__texoraFirebaseClient = client;
  return client;
}
