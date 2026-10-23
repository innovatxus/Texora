import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const desktop = (page: Page) => (page.viewportSize()?.width ?? 0) >= 1024;

test.beforeEach(async ({ context, baseURL }) => {
  // A returning visitor: the newsletter popup was already seen.
  await context.addInitScript(() =>
    window.localStorage.setItem("texora-signup-seen", String(Date.now())),
  );
  // Skip the cookie banner; consent behaviour is covered in shell.spec.ts.
  await context.addCookies([
    {
      name: "tx_consent",
      value: encodeURIComponent(
        JSON.stringify({ version: 1, analytics: false, marketing: false, decidedAt: Date.now() }),
      ),
      url: baseURL ?? "http://localhost:3900",
    },
  ]);
});

test.describe("templates are accessible", () => {
  for (const path of [
    "/",
    "/women",
    "/women/dresses",
    "/sale",
    "/collections/the-linen-edit",
    "/search?q=linen",
  ]) {
    test(`${path} has no axe violations`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator("main")).toBeVisible();
      await page.waitForLoadState("networkidle");
      const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
      expect(results.violations).toEqual([]);
    });
  }
});

test("home renders CMS modules with live products", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: "Made to be worn, season after season" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "New arrivals" })).toBeVisible();
  await expect(
    page.getByRole("list", { name: "New arrivals" }).getByRole("article").first(),
  ).toBeVisible();
});

test("category filters live in the URL and can be removed", async ({ page }) => {
  await page.goto("/women/dresses");
  const count = page.getByText(/^\d+ products?$/);
  const before = Number((await count.textContent())?.split(" ")[0]);

  if (desktop(page)) {
    await page
      .getByRole("complementary", { name: "Filters" })
      .getByRole("button", { name: /^Size M,/ })
      .click();
  } else {
    await page.getByRole("button", { name: /^Filter/ }).click();
    const drawer = page.getByRole("dialog", { name: "Filter" });
    await drawer.getByRole("button", { name: /^Size M,/ }).click();
    await expect(drawer.getByRole("button", { name: /^Show \d+ results$/ })).toBeVisible();
    await drawer.getByRole("button", { name: /^Show \d+ results$/ }).click();
  }

  await expect(page).toHaveURL(/size=M/);
  await expect(page.getByRole("link", { name: "Remove filter M" })).toBeVisible();
  const after = Number((await count.textContent())?.split(" ")[0]);
  expect(after).toBeLessThanOrEqual(before);

  await page.getByRole("link", { name: "Remove filter M" }).click();
  await expect(page).not.toHaveURL(/size=M/);
});

test("a filtered URL is shareable and canonicalises to the category", async ({ page }) => {
  await page.goto("/women/dresses?color=blue&sort=price_asc");
  await expect(page.getByRole("link", { name: "Remove filter Blue" })).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/women\/dresses$/);
  await expect(page.getByLabel("Sort by")).toHaveValue("price_asc");
});

test("sorting updates the URL", async ({ page }) => {
  await page.goto("/men/shirts");
  await page.getByLabel("Sort by").selectOption("price_desc");
  await expect(page).toHaveURL(/sort=price_desc/);
});

test("load more shows the next page and reports progress", async ({ page }) => {
  await page.goto("/women");
  await expect(page.getByText(/^Showing 24 of \d+$/)).toBeVisible();
  await page.getByRole("link", { name: "Load more" }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByText(/^Showing 48 of \d+$/)).toBeVisible();
});

test("sale page only lists marked-down products", async ({ page }) => {
  await page.goto("/sale/women");
  const cards = page.getByRole("article");
  // The grid streams in after the static shell.
  await expect(cards.first()).toBeVisible();
  const total = await cards.count();
  expect(total).toBeGreaterThan(0);
  await expect(page.locator("article s")).toHaveCount(total);
});

test("search results page lists matches", async ({ page }) => {
  await page.goto("/search?q=cashmere");
  await expect(page.getByRole("heading", { level: 1, name: "“cashmere”" })).toBeVisible();
  await expect(page.getByRole("article").first()).toContainText(/Cashmere/i);
});

test("quick add puts the item in the bag and opens the drawer", async ({ page }) => {
  test.skip(!desktop(page), "Quick add appears on hover devices");
  await page.goto("/men/shirts");
  const card = page.getByRole("article").first();
  await card.hover();
  await card
    .getByRole("button", { name: /^Add .* to bag$/ })
    .first()
    .click();
  const drawer = page.getByRole("dialog", { name: /^Bag/ });
  await expect(drawer.getByText("Added to your bag")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("link", { name: "Bag, 1 item" })).toBeVisible();
});

test("wishlist toggles optimistically", async ({ page }) => {
  await page.goto("/women/sweaters");
  const heart = page.getByRole("button", { name: /^Save .* to wishlist$/ }).first();
  const name = (await heart.getAttribute("aria-label"))?.replace(/^Save | to wishlist$/g, "") ?? "";
  await heart.click();
  await expect(page.getByRole("button", { name: `Remove ${name} from wishlist` })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("unknown departments are 404s", async ({ page }) => {
  const response = await page.goto("/kids");
  expect(response?.status()).toBe(404);
});
