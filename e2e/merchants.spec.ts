import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { asReturningVisitor, gotoReady } from "./support/helpers";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

test.beforeEach(async ({ context, baseURL }) => {
  await asReturningVisitor(context, baseURL);
});

test.describe("merchant entry point", () => {
  test("the footer links to the merchant programme", async ({ page }) => {
    await gotoReady(page, "/");
    const footer = page.getByRole("navigation", { name: "Footer" });
    await expect(footer.getByRole("heading", { name: "Merchants" })).toBeVisible();
    await expect(footer.getByRole("link", { name: "Merchant sign in" })).toHaveAttribute(
      "href",
      "/merchant/sign-in",
    );
    await expect(footer.getByRole("link", { name: "Merchant help" })).toHaveAttribute(
      "href",
      "/help/merchants",
    );
    await footer.getByRole("link", { name: "Sell on Texora" }).click();
    await expect(page).toHaveURL((u) => u.pathname === "/merchants");
    await expect(page.getByRole("heading", { level: 1, name: "Sell on Texora" })).toBeVisible();
  });

  test("the landing page explains the programme and leads to registration", async ({ page }) => {
    const response = await page.goto("/merchants");
    expect(response?.status()).toBe(200);
    await page.waitForSelector("html[data-hydrated]", { state: "attached" });

    await expect(page.getByRole("heading", { level: 2, name: "How it works" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 3, name: "Build your shop" })).toBeVisible();
    await expect(page.getByText("15%", { exact: true })).toBeVisible();

    const ctas = page.getByRole("link", { name: "Open your shop" });
    await expect(ctas).toHaveCount(2);
    for (const cta of await ctas.all()) {
      await expect(cta).toHaveAttribute("href", "/merchant/register");
    }

    const question = page.getByRole("button", { name: "How long does approval take?" });
    await question.click();
    await expect(question).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByText(/We review new shops within 1 business day/)).toBeVisible();
  });

  test("merchant help and terms are in the help centre", async ({ page }) => {
    await gotoReady(page, "/help/merchants");
    await expect(page.getByRole("heading", { level: 1, name: "Selling on Texora" })).toBeVisible();
    const nav = page.getByRole("navigation", { name: "Help topics" });
    await nav.getByRole("link", { name: "Merchant terms" }).click();
    await expect(page).toHaveURL((u) => u.pathname === "/help/merchants/terms");
    await expect(page.getByRole("heading", { level: 1, name: "Merchant terms" })).toBeVisible();
  });

  test("nested help paths that don't exist are not found", async ({ page }) => {
    await gotoReady(page, "/help/merchants/nope");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/can.t find that page/i);
  });

  for (const path of ["/merchants", "/help/merchants", "/help/merchants/terms"]) {
    test(`${path} has no axe violations`, async ({ page }) => {
      await gotoReady(page, path);
      const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
      expect(results.violations).toEqual([]);
    });
  }
});

test.describe("merchant portal protection", () => {
  test("signed-out visitors are sent to the merchant sign-in page", async ({ page }) => {
    await page.goto("/merchant/products");
    await expect(page).toHaveURL(
      (u) =>
        u.pathname === "/merchant/sign-in" && u.searchParams.get("next") === "/merchant/products",
    );
  });
});
