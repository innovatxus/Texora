import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const SECTIONS = [
  "colour",
  "typography",
  "icons",
  "buttons",
  "links",
  "forms",
  "badges",
  "feedback",
] as const;

test.describe("styleguide", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/styleguide");
    await page.evaluate(() => document.fonts.ready);
  });

  test("has no axe violations (WCAG 2.2 AA)", async ({ page }) => {
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test("shows a visible focus ring on keyboard focus", async ({ page }) => {
    const button = page.getByRole("button", { name: "Add to bag" });
    await button.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(button).toBeFocused();
    const outline = await button.evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outline).toBe("solid");
  });

  test("toggle chips announce their state", async ({ page }) => {
    const petite = page.getByRole("button", { name: "Petite" });
    await expect(petite).toHaveAttribute("aria-pressed", "false");
    await petite.click();
    await expect(petite).toHaveAttribute("aria-pressed", "true");
  });

  test("dismissible chips remove themselves", async ({ page }) => {
    await page.getByRole("button", { name: "Remove Size: M" }).click();
    await expect(page.getByRole("button", { name: "Remove Size: M" })).toHaveCount(0);
  });

  for (const section of SECTIONS) {
    test(`visual: ${section} @visual`, async ({ page }) => {
      const region = page.getByTestId(`sg-${section}`);
      await region.scrollIntoViewIfNeeded();
      await expect(region).toHaveScreenshot(`${section}.png`);
    });
  }
});

test("styleguide is excluded from search engines", async ({ page }) => {
  await page.goto("/styleguide");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
});
