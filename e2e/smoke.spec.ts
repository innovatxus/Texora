import { expect, test } from "@playwright/test";

test("home page renders the brand shell", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/^Texora/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en-EG");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("page has no horizontal scroll", async ({ page }) => {
  await page.goto("/");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
