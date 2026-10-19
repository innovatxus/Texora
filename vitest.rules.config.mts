import { defineConfig } from "vitest/config";

// Firestore rules tests: run inside `firebase emulators:exec` (see `npm run test:rules`).
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/rules/**/*.test.ts"],
    testTimeout: 15_000,
    hookTimeout: 30_000,
    // One emulator, shared fixtures: run files serially.
    fileParallelism: false,
  },
});
