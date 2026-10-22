import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { asReturningVisitor, gotoReady } from "./support/helpers";
import {
  asSeparateVisitor,
  MERCHANT_PASSWORD,
  merchantWithShop,
  verifyEmail,
} from "./support/merchant";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

test.beforeEach(async ({ context, baseURL }) => {
  await asReturningVisitor(context, baseURL);
  await asSeparateVisitor(context);
});

async function newVisitor(browser: Browser, baseURL: string | undefined): Promise<Page> {
  const context = await browser.newContext();
  await asReturningVisitor(context, baseURL);
  await asSeparateVisitor(context);
  return context.newPage();
}

/** Starts a product draft from the empty list and returns its id. */
async function startProduct(page: Page): Promise<string> {
  await gotoReady(page, "/merchant/products");
  await page.getByRole("link", { name: "Add your first product" }).click();
  await expect(page).toHaveURL((u) => /^\/merchant\/products\/[A-Za-z0-9]+$/.test(u.pathname), {
    timeout: 30_000,
  });
  await expect(page.getByRole("textbox", { name: "Product name" })).toBeVisible({
    timeout: 30_000,
  });
  return new URL(page.url()).pathname.split("/").pop() ?? "";
}

async function expectNoAxeViolations(page: Page, path: string) {
  await gotoReady(page, path);
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  expect(
    violations.map((v) => `${path}: ${v.id} (${v.nodes.length})`),
    `axe on ${path}`,
  ).toEqual([]);
}

test.describe("merchant portal hardening", () => {
  test.setTimeout(240_000);

  test("every portal route has no axe violations", async ({ page, browser, baseURL }) => {
    // Signed out: the auth screens.
    const visitor = await newVisitor(browser, baseURL);
    for (const path of [
      "/merchants",
      "/merchant/sign-in",
      "/merchant/register",
      "/merchant/forgot-password",
    ])
      await expectNoAxeViolations(visitor, path);

    // Signed in with a shop: every portal screen.
    await merchantWithShop(page, test.info());
    const id = await startProduct(page);
    for (const path of [
      "/merchant",
      "/merchant/onboarding/basics",
      "/merchant/onboarding/branding",
      "/merchant/onboarding/contact",
      "/merchant/onboarding/locations",
      "/merchant/onboarding/review",
      "/merchant/products",
      `/merchant/products/${id}`,
      `/merchant/products/${id}/preview`,
      "/merchant/orders",
      "/merchant/shop/profile",
      "/merchant/shop/branding",
      "/merchant/shop/locations",
      "/merchant/shop/policies",
      "/merchant/settings/account",
      "/merchant/settings/security",
      "/merchant/settings/notifications",
    ])
      await expectNoAxeViolations(page, path);
  });

  test("another merchant's product, preview and orders are not found", async ({
    page,
    browser,
    baseURL,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Access rules don't depend on the viewport");
    await merchantWithShop(page, testInfo);
    const id = await startProduct(page);
    await page.getByRole("textbox", { name: "Product name" }).fill("Private Draft Dress");

    const rival = await newVisitor(browser, baseURL);
    await merchantWithShop(rival, testInfo);
    for (const path of [
      `/merchant/products/${id}`,
      `/merchant/products/${id}/preview`,
      "/merchant/orders/not-an-order-of-yours",
    ]) {
      await gotoReady(rival, path);
      await expect(rival.getByRole("heading", { level: 1 }), path).toHaveText(
        "We can't find that page",
      );
      await expect(rival.getByText("Private Draft Dress")).toHaveCount(0);
    }
    // The rival's own list doesn't show it either.
    await gotoReady(rival, "/merchant/products");
    await expect(rival.getByText("You haven't added any products yet.")).toBeVisible();
  });

  test("settings: account, password and notifications", async ({ page }, testInfo) => {
    const { username } = await merchantWithShop(page, testInfo);

    // The header's username opens settings (it's how phones get there).
    await gotoReady(page, "/merchant");
    await page.getByRole("link", { name: `Settings for @${username}` }).click();
    await expect(page).toHaveURL((u) => u.pathname === "/merchant/settings/account");
    await page.waitForSelector("html[data-hydrated]", { state: "attached" });

    const displayName = page.getByRole("textbox", { name: "Display name" });
    await displayName.fill("Ada Lovelace");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Saved.", { exact: true })).toBeVisible({ timeout: 30_000 });
    await page.reload();
    await expect(page.getByRole("textbox", { name: "Display name" })).toHaveValue("Ada Lovelace");

    // Wrong current password stays on the field.
    await gotoReady(page, "/merchant/settings/security");
    await page
      .getByRole("textbox", { name: "Current password", exact: true })
      .fill("not-my-password-at-all");
    await page
      .getByRole("textbox", { name: "New password", exact: true })
      .fill("copper-lantern-meadow-19");
    await page
      .getByRole("textbox", { name: "Confirm new password", exact: true })
      .fill("copper-lantern-meadow-19");
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByText("Your current password isn't right.").first()).toBeVisible({
      timeout: 30_000,
    });
    await page
      .getByRole("textbox", { name: "Current password", exact: true })
      .fill(MERCHANT_PASSWORD);
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByText(/Password changed/)).toBeVisible({ timeout: 30_000 });
    // This device stays signed in.
    await gotoReady(page, "/merchant/orders");
    await expect(page.getByRole("heading", { level: 1, name: "Orders" })).toBeVisible();

    await gotoReady(page, "/merchant/settings/notifications");
    // The streamed form must hydrate first, or registering resets the box to its default.
    await page.waitForLoadState("networkidle");
    await page.getByRole("checkbox", { name: "A shopper orders one of my products" }).uncheck();
    await expect(page.getByRole("checkbox", { name: /My shop is approved/ })).toBeDisabled();
    await page.getByRole("button", { name: "Save preferences" }).click();
    await expect(page.getByText("Saved.", { exact: true })).toBeVisible({ timeout: 30_000 });
    await page.reload();
    await expect(
      page.getByRole("checkbox", { name: "A shopper orders one of my products" }),
    ).not.toBeChecked();
  });

  test("portal screens match their baselines @visual", async ({
    page,
    browser,
    baseURL,
  }, testInfo) => {
    test.skip(testInfo.project.name === "laptop", "Baselines at 375, 768 and 1440");
    const shot = async (target: Page, path: string, name: string) => {
      await gotoReady(target, path);
      await target.waitForLoadState("networkidle");
      // Names, emails and field values differ per run; the layout is what's compared.
      const mask = [
        target.locator("header"),
        target.locator("h1"),
        target.locator('input:not([type="checkbox"]):not([type="radio"]), textarea'),
        target.getByText(/@example\.com/),
      ];
      await expect(target).toHaveScreenshot(`${name}.png`, { mask, fullPage: false });
    };

    const visitor = await newVisitor(browser, baseURL);
    await shot(visitor, "/merchant/sign-in", "sign-in");
    await shot(visitor, "/merchant/register", "register");

    // Verified, so the verification banner (with a per-run address) isn't in the shots.
    const { email } = await merchantWithShop(page, testInfo);
    await verifyEmail(page, email);
    await shot(page, "/merchant/products", "products-empty");
    await shot(page, "/merchant/orders", "orders-empty");
    await shot(page, "/merchant/shop/locations", "shop-locations");
    await shot(page, "/merchant/settings/account", "settings-account");
    await shot(page, "/merchant/settings/notifications", "settings-notifications");
  });
});
