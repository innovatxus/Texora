import type { BrowserContext, Page } from "@playwright/test";

/** Navigate and wait until React has hydrated, so clicks reach event handlers. */
export async function gotoReady(page: Page, path: string) {
  const response = await page.goto(path);
  await page.waitForSelector("html[data-hydrated]", { state: "attached" });
  return response;
}

/** A returning visitor: cookie choice made, newsletter popup already seen. */
export async function asReturningVisitor(context: BrowserContext, baseURL: string | undefined) {
  await context.addInitScript(() =>
    window.localStorage.setItem("texora-signup-seen", String(Date.now())),
  );
  await context.addCookies([
    {
      name: "tx_consent",
      value: encodeURIComponent(
        JSON.stringify({ version: 1, analytics: false, marketing: false, decidedAt: Date.now() }),
      ),
      url: baseURL ?? "http://localhost:3000",
    },
  ]);
}
