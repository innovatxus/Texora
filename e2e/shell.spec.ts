import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

const isMobile = (page: Page) => (page.viewportSize()?.width ?? 1440) < 1024;

async function acceptCookies(page: Page) {
  await page
    .getByRole("region", { name: "Cookie consent" })
    .getByRole("button", { name: "Accept all" })
    .click();
  await expect(page.getByRole("region", { name: "Cookie consent" })).toBeHidden();
}

test.describe("global shell", () => {
  test("has no axe violations, including the consent banner", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("region", { name: "Cookie consent" })).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    expect(results.violations).toEqual([]);
  });

  test("skip link moves focus to the main content", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to content" });
    await expect(skip).toBeFocused();
    await skip.press("Enter");
    await expect(page).toHaveURL(/#main$/);
  });

  test("consent choice is remembered across visits", async ({ page }) => {
    await page.goto("/");
    await acceptCookies(page);
    const consent = (await page.context().cookies()).find((c) => c.name === "tx_consent");
    expect(decodeURIComponent(consent?.value ?? "")).toContain('"analytics":true');
    await page.reload();
    await expect(page.getByRole("region", { name: "Cookie consent" })).toBeHidden();
  });

  test("search shows live results and returns focus on close", async ({ page }) => {
    await page.goto("/");
    await acceptCookies(page);
    const trigger = page.getByRole("button", { name: "Search" }).first();
    await trigger.click();
    const input = page.getByLabel("Search products");
    await expect(input).toBeFocused();
    await input.fill("linen");
    await expect(page.getByRole("link", { name: /Linen Camp-Collar Shirt/ })).toBeVisible();
    await expect(page.getByText(/See all \d+ results for “linen”/)).toBeVisible();

    await input.fill("qqqqzzzz");
    await expect(page.getByText("No results for “qqqqzzzz”")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(input).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("the 404 page is branded and offers a way back", async ({ page }) => {
    const response = await page.goto("/this-page-does-not-exist");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("We can't find that page");
    await expect(page.getByRole("link", { name: "Go to the homepage" })).toBeVisible();
  });
});

test.describe("desktop mega menu", () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, "Desktop navigation only");

  test("opens by keyboard and closes with Escape, returning focus", async ({ page }) => {
    await page.goto("/");
    await acceptCookies(page);
    const toggle = page.getByRole("button", { name: "Women menu", exact: true });
    await toggle.focus();
    await toggle.press("Enter");
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("link", { name: "Dresses" }).first()).toBeVisible();

    await page.getByRole("link", { name: "Dresses" }).first().focus();
    await page.keyboard.press("Escape");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(toggle).toBeFocused();
  });

  test("opens on hover after the intent delay", async ({ page }) => {
    await page.goto("/");
    await acceptCookies(page);
    await page.getByRole("link", { name: "Men", exact: true }).hover();
    await expect(page.getByRole("button", { name: "Men menu", exact: true })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await expect(page.getByText("Coats made for the long season")).toBeVisible();
  });
});

test.describe("mobile navigation", () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) >= 1024, "Mobile navigation only");

  test("drills into a department and back", async ({ page }) => {
    await page.goto("/");
    await acceptCookies(page);
    expect(isMobile(page)).toBe(true);
    await page.getByRole("button", { name: "Open menu" }).click();
    const drawer = page.getByRole("dialog", { name: "Menu" });
    await expect(drawer).toBeVisible();

    await drawer.getByRole("button", { name: "Women, open submenu" }).click();
    await expect(drawer.getByRole("link", { name: "Dresses" })).toBeVisible();
    await expect(drawer.getByRole("button", { name: "All departments" })).toBeFocused();

    await drawer.getByRole("button", { name: "All departments" }).click();
    await expect(drawer.getByRole("button", { name: "Women, open submenu" })).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
  });
});
