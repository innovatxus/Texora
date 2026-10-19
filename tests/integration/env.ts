// Server env for integration tests. Emulator hosts come from `firebase emulators:exec`.
export const INTEGRATION_PROJECT_ID = "demo-texora-it";

process.env.FIREBASE_PROJECT_ID = INTEGRATION_PROJECT_ID;
process.env.FIREBASE_STORAGE_BUCKET = `${INTEGRATION_PROJECT_ID}.appspot.com`;
process.env.USE_FIREBASE_EMULATORS = "true";
process.env.LOG_LEVEL = "error";
process.env.ORDER_TOKEN_SECRET = "integration-order-token-secret-000000000000";
process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
process.env.NEXT_PUBLIC_FIREBASE_API_KEY = "demo-api-key";
process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = `${INTEGRATION_PROJECT_ID}.firebaseapp.com`;
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = INTEGRATION_PROJECT_ID;
process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = `${INTEGRATION_PROJECT_ID}.appspot.com`;
process.env.NEXT_PUBLIC_FIREBASE_APP_ID = "demo-app-id";
