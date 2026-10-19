// Server env for integration tests. Emulator hosts come from `firebase emulators:exec`.
export const INTEGRATION_PROJECT_ID = "demo-texora-it";

process.env.FIREBASE_PROJECT_ID = INTEGRATION_PROJECT_ID;
process.env.FIREBASE_STORAGE_BUCKET = `${INTEGRATION_PROJECT_ID}.appspot.com`;
process.env.USE_FIREBASE_EMULATORS = "true";
process.env.LOG_LEVEL = "error";
