import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage, type Storage } from "firebase-admin/storage";
import { serverEnv } from "@/lib/env/server";

export interface FirebaseAdmin {
  app: App;
  auth: Auth;
  db: Firestore;
  storage: Storage;
}

const globalForFirebase = globalThis as typeof globalThis & {
  __texoraFirebaseAdmin?: FirebaseAdmin;
};

/**
 * Firebase Admin SDK, initialised once per server process.
 * With emulators on, the SDK picks up FIRESTORE_EMULATOR_HOST,
 * FIREBASE_AUTH_EMULATOR_HOST and FIREBASE_STORAGE_EMULATOR_HOST itself,
 * so only the project ID is needed.
 */
export function getFirebaseAdmin(): FirebaseAdmin {
  const cached = globalForFirebase.__texoraFirebaseAdmin;
  if (cached) return cached;

  const account = serverEnv.FIREBASE_SERVICE_ACCOUNT;
  const app =
    getApps()[0] ??
    initializeApp({
      projectId: serverEnv.FIREBASE_PROJECT_ID,
      storageBucket: serverEnv.FIREBASE_STORAGE_BUCKET,
      ...(account && !serverEnv.USE_FIREBASE_EMULATORS
        ? {
            credential: cert({
              projectId: account.project_id,
              clientEmail: account.client_email,
              privateKey: account.private_key,
            }),
          }
        : {}),
    });

  const admin: FirebaseAdmin = {
    app,
    auth: getAuth(app),
    db: getFirestore(app),
    storage: getStorage(app),
  };

  globalForFirebase.__texoraFirebaseAdmin = admin;
  return admin;
}
