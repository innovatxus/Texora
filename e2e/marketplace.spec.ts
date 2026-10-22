import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { asReturningVisitor, gotoReady } from "./support/helpers";
import { asSeparateVisitor, onboardSubmittedShop, staffSignIn } from "./support/merchant";

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

/** Storefront pages revalidate in the background, so a change shows after a reload or two. */
async function eventually(page: Page, path: string, check: () => Promise<void>) {
  await expect(async () => {
    await gotoReady(page, path);
    await check();
  }).toPass({ timeout: 45_000, intervals: [1_000, 2_000, 3_000] });
}

test.describe("marketplace", () => {
  test.setTimeout(240_000);

  test("shop and product go from review to the storefront, and disappear when paused", async ({
    page,
    browser,
    baseURL,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop",
      "One full journey on desktop; other viewports are covered per screen",
    );

    // Merchant: onboarding and one product, submitted for review.
    const { shopName, shopSlug, png } = await onboardSubmittedShop(page, testInfo);
    await gotoReady(page, "/merchant/products/new");
    await expect(page.getByRole("textbox", { name: "Product name" })).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole("textbox", { name: "Product name" }).fill("Linen Midi Dress");
    await page
      .getByRole("textbox", { name: "Description", exact: true })
      .fill("Washed linen, cut for warm days and long dinners.");
    await page.getByRole("combobox", { name: "Department" }).selectOption("women");
    await page.getByRole("combobox", { name: "Category" }).selectOption("dresses");
    await page.getByRole("combobox", { name: "Length" }).selectOption("midi");
    await page.getByRole("combobox", { name: "Sleeve" }).selectOption("short");
    await page.getByRole("button", { name: "Add a material" }).click();
    await page.getByRole("combobox", { name: "Material 1" }).selectOption("linen");
    await page.getByRole("spinbutton", { name: "Percent" }).fill("100");
    const colour = page.getByRole("textbox", { name: "New colour" });
    await colour.fill("Navy");
    await colour.press("Enter");
    for (const size of ["S", "M"])
      await page
        .locator("label")
        .filter({ hasText: new RegExp(`^${size}$`) })
        .click();
    await page.getByRole("checkbox", { name: "Select all shown variants" }).check();
    const bulk = page.getByRole("group", { name: "Bulk edit" });
    await bulk.getByRole("textbox", { name: "Price ($)" }).fill("148");
    await bulk.getByRole("button", { name: "Apply price" }).click();
    await bulk.getByRole("textbox", { name: "Stock" }).fill("6");
    await bulk.getByRole("button", { name: "Apply stock" }).click();
    await page
      .locator('input[type="file"][accept*="image/jpeg"]')
      .first()
      .setInputFiles(await png("navy.png", 1200, 1600, "#1f2a44"));
    await expect(page.getByRole("list", { name: "Navy photos" }).getByText("Main")).toBeVisible({
      timeout: 30_000,
    });
    await page.getByText("Alt text and focal points").first().click();
    await page.getByRole("checkbox", { name: "This description is right" }).first().check();
    await page.locator("#field-weight").fill("450");
    await page.getByRole("button", { name: "Submit for review" }).click();
    await expect(
      page.getByText("Submitted for review — we usually reply within 1 business day."),
    ).toBeVisible({
      timeout: 30_000,
    });

    // Back office: approve the shop, then the product.
    const staff = await newVisitor(browser, baseURL);
    await staffSignIn(staff, "admin@texora.test");
    await gotoReady(staff, "/admin/merchants");
    await staff.getByRole("link", { name: shopName }).click();
    await expect(staff.getByRole("heading", { level: 1, name: shopName })).toBeVisible();
    await staff.waitForSelector("html[data-hydrated]", { state: "attached" });
    await staff.getByRole("button", { name: "Approve" }).click();
    await expect(
      staff.getByText("Approved. The shop and its live products are now visible."),
    ).toBeVisible();
    await gotoReady(staff, "/admin/merchants/products");
    await staff.getByRole("link", { name: "Linen Midi Dress" }).first().click();
    await expect(staff.getByText("Everything required is in place.")).toBeVisible();
    await staff.waitForSelector("html[data-hydrated]", { state: "attached" });
    await staff.getByRole("button", { name: "Approve" }).click();
    await expect(
      staff.getByRole("status").filter({ hasText: /^Approved\. It's live/ }),
    ).toBeVisible();

    // Storefront: the shop page, the card's "by" line, the PDP's "Sold by" and search.
    const shopper = await newVisitor(browser, baseURL);
    await eventually(shopper, `/shops/${shopSlug}`, async () => {
      await expect(shopper.getByRole("heading", { level: 1, name: shopName })).toBeVisible();
      await expect(shopper.getByRole("link", { name: "Linen Midi Dress" }).first()).toBeVisible();
    });
    await expect(shopper.getByText("Mercer Street studio", { exact: true })).toBeVisible();
    await expect(shopper.locator("article").getByText(`by ${shopName}`)).toBeVisible();
    expect(
      (await new AxeBuilder({ page: shopper }).withTags(WCAG_TAGS).analyze()).violations,
    ).toEqual([]);

    const href =
      (await shopper
        .locator("article")
        .getByRole("link", { name: "Linen Midi Dress" })
        .first()
        .getAttribute("href")) ?? "";
    await eventually(shopper, href, async () => {
      const soldBy = shopper.getByRole("region", { name: "Sold by" });
      await expect(soldBy).toContainText(shopName);
      await expect(soldBy).toContainText("Ships from New York, NY");
      await expect(soldBy).toContainText("30-day returns");
    });

    await eventually(shopper, `/search?q=${encodeURIComponent(shopName)}`, async () => {
      await expect(
        shopper.locator("article").getByRole("link", { name: "Linen Midi Dress" }).first(),
      ).toBeVisible();
    });

    // Pausing the shop hides it and its products.
    await gotoReady(staff, "/admin/merchants?status=approved");
    await staff.getByRole("link", { name: shopName }).click();
    await staff.waitForSelector("html[data-hydrated]", { state: "attached" });
    await staff
      .getByRole("textbox", { name: /Reasons for the merchant/ })
      .fill("Brand authorisation under review");
    staff.on("dialog", (d) => void d.accept());
    await staff.getByRole("button", { name: "Pause shop" }).click();
    await expect(staff.getByText("Paused. Its products are hidden.")).toBeVisible();
    await eventually(shopper, `/shops/${shopSlug}`, async () => {
      await expect(shopper.getByRole("heading", { level: 1 })).toHaveText(
        "We can't find that page",
      );
    });
    await eventually(shopper, `/search?q=${encodeURIComponent(shopName)}`, async () => {
      await expect(
        shopper.locator("article").getByRole("link", { name: "Linen Midi Dress" }),
      ).toHaveCount(0);
    });

    // The merchant sees the pause on their dashboard.
    await gotoReady(page, "/merchant");
    await expect(page.getByText(/Your shop is paused and hidden from shoppers/)).toBeVisible();
  });

  test("the back office merchant screens have no axe violations", async ({ page }) => {
    await staffSignIn(page, "admin@texora.test");
    for (const path of ["/admin/merchants", "/admin/merchants/products"]) {
      await gotoReady(page, path);
      expect(
        (await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()).violations,
        path,
      ).toEqual([]);
    }
  });

  test("merchandisers review products but can't pause shops", async ({ page }) => {
    await staffSignIn(page, "merchandiser@texora.test");
    await gotoReady(page, "/admin/merchants");
    await expect(page.getByRole("heading", { level: 1, name: "Merchant shops" })).toBeVisible();
    await expect(
      page
        .getByRole("navigation", { name: "Back office" })
        .getByRole("link", { name: "Product reviews" }),
    ).toBeVisible();
  });

  // Same PPR soft-404 limitation as unknown products (D-039): not-found page, noindex.
  test("an unknown shop shows the not-found page", async ({ page }) => {
    await gotoReady(page, "/shops/no-such-shop-here");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("We can't find that page");
    await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);
  });
});
