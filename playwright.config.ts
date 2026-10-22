import { readFileSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// E2E creates accounts, shops and orders, so it always runs against the local
// emulators with tests/emulator.env (overriding .env.local, which holds the
// live project). Run it with `npm run test:e2e`, which starts and seeds them.
for (const line of readFileSync("tests/emulator.env", "utf8").split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match?.[1]) process.env[match[1]] = match[2] ?? "";
}
if (
  process.env.USE_FIREBASE_EMULATORS !== "true" ||
  !process.env.FIREBASE_PROJECT_ID?.startsWith("demo-")
) {
  throw new Error(
    "Refusing to run E2E against a real Firebase project. Point your env at the emulators " +
      "(copy .env.example, or export its values) before running Playwright.",
  );
}

const PORT = Number(process.env.PORT ?? 3000);
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  // Leave CPU for the server and hydration; unbounded workers starve both locally.
  workers: process.env.CI ? 2 : "50%",
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  // Baselines differ by OS font rendering, so each platform keeps its own set.
  snapshotPathTemplate:
    "{testDir}/__screenshots__/{platform}/{projectName}/{testFilePath}/{arg}{ext}",
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.001, animations: "disabled" },
  },
  projects: [
    {
      name: "mobile",
      use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 812 } },
    },
    {
      name: "tablet",
      use: { ...devices["Desktop Chrome"], viewport: { width: 768, height: 1024 } },
    },
    {
      name: "laptop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1024, height: 768 } },
    },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: {
    // E2E always runs against a production build (prefetching does not run in dev).
    command: `npm run start -- --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
