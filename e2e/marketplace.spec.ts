import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { asReturningVisitor, gotoReady } from "./support/helpers";
import { asSeparateVisitor, onboardSubmittedShop, staffSignIn } from "./support/merchant";
import { latestEmail } from "./support/outbox";

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

    // A would-be merchant finds the programme from the storefront footer.
    await gotoReady(page, "/");
    await page.getByRole("contentinfo").getByRole("link", { name: "Sell on Texora" }).click();
    await expect(page).toHaveURL((u) => u.pathname === "/merchants");
    await expect(page.locator('main a[href="/merchant/register"]').first()).toBeVisible();

    // Merchant: onboarding and one product (3 colours × 2 fits × 6 sizes), submitted for review.
    const { email, shopName, shopSlug, png } = await onboardSubmittedShop(page, testInfo);
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
    const colours = [
      ["Navy", "#1f2a44"],
      ["Sand", "#c8b48a"],
      ["Sage", "#8fa58a"],
    ] as const;
    for (const [name] of colours) {
      await colour.fill(name);
      await colour.press("Enter");
    }
    await page.getByRole("checkbox", { name: "Petite" }).check();
    for (const size of ["XS", "S", "M", "L", "XL", "XXL"])
      await page
        .locator("label")
        .filter({ hasText: new RegExp(`^${size}$`) })
        .click();
    await page.getByRole("checkbox", { name: "Select all shown variants" }).check();
    const bulk = page.getByRole("group", { name: "Bulk edit" });
    await bulk.getByRole("textbox", { name: "Price (EGP)" }).fill("148");
    await bulk.getByRole("button", { name: "Apply price" }).click();
    await bulk.getByRole("textbox", { name: "Stock" }).fill("6");
    await bulk.getByRole("button", { name: "Apply stock" }).click();
    await expect(page.getByText("36 of 36 variants")).toBeVisible();
    for (const [index, [name, hex]] of colours.entries()) {
      await page
        .locator('input[type="file"][accept*="image/jpeg"]')
        .nth(index)
        .setInputFiles(await png(`${name}.png`, 1200, 1600, hex));
      await expect(
        page.getByRole("list", { name: `${name} photos` }).getByText("Main"),
      ).toBeVisible({ timeout: 30_000 });
    }
    const altSections = page.getByText("Alt text and focal points");
    for (let i = 0; i < colours.length; i++) await altSections.nth(i).click();
    const confirms = page.getByRole("checkbox", { name: "This description is right" });
    for (let i = 0; i < colours.length; i++) await confirms.nth(i).check();
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

    // Shoppers never see the merchant: no shop page, no shop name on cards or the PDP,
    // and the shop's name doesn't find its products.
    const shopper = await newVisitor(browser, baseURL);
    await gotoReady(shopper, `/shops/${shopSlug}`);
    await expect(shopper.getByRole("heading", { level: 1 })).toHaveText("We can't find that page");

    // The merchant sees their own shop page.
    await eventually(page, `/shops/${shopSlug}`, async () => {
      await expect(page.getByRole("heading", { level: 1, name: shopName })).toBeVisible();
      await expect(page.getByRole("link", { name: "Linen Midi Dress" }).first()).toBeVisible();
    });
    await expect(page.getByText("Mercer Street studio", { exact: true })).toBeVisible();
    expect((await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()).violations).toEqual([]);

    const card = shopper
      .locator("article")
      .filter({ has: shopper.getByRole("link", { name: "Linen Midi Dress", exact: true }) })
      .first();
    await eventually(shopper, "/women/dresses?sort=newest", async () => {
      await expect(card).toBeVisible();
    });
    await expect(card).not.toContainText(shopName);
    const href =
      (await card
        .getByRole("link", { name: "Linen Midi Dress", exact: true })
        .first()
        .getAttribute("href")) ?? "";
    await gotoReady(shopper, href);
    await expect(shopper.getByRole("region", { name: "Sold by" })).toHaveCount(0);
    await expect(shopper.getByText(shopName)).toHaveCount(0);

    await gotoReady(shopper, `/search?q=${encodeURIComponent(shopName)}`);
    await expect(
      shopper.locator("article").getByRole("link", { name: "Linen Midi Dress", exact: true }),
    ).toHaveCount(0);

    // A shopper buys it (pay on delivery)...
    await gotoReady(shopper, href);
    // The buy box hydrates after the page; pick a size only once it's interactive.
    await shopper.waitForSelector("[data-interactive]", { state: "attached" });
    await shopper
      .getByRole("group", { name: /^Size/ })
      .locator("label")
      .filter({ hasNotText: "out of stock" })
      .first()
      .click();
    await shopper.getByRole("button", { name: "Add to bag", exact: true }).first().click();
    await expect(
      shopper.getByRole("dialog", { name: /^Bag/ }).getByText("Added to your bag"),
    ).toBeVisible();
    await gotoReady(shopper, "/checkout");
    await shopper.getByRole("textbox", { name: "Email", exact: true }).fill("grace@example.com");
    await shopper.getByRole("button", { name: "Continue to shipping" }).click();
    const field = (name: string) => shopper.getByRole("textbox", { name, exact: true });
    await field("First name").fill("Grace");
    await field("Last name").fill("Hopper");
    await field("Address").fill("5 Mesaha Square");
    await shopper.getByRole("combobox", { name: "City or district" }).fill("Dokki");
    await shopper.getByRole("combobox", { name: "Governorate", exact: true }).selectOption("GZ");
    await field("Postal code (optional)").fill("12311");
    await field("Phone").fill("011 1234 5678");
    await shopper.getByRole("button", { name: "Continue to delivery" }).click();
    await shopper.getByRole("button", { name: "Continue to payment" }).click();
    await shopper.getByText("Pay on delivery", { exact: true }).click();
    await shopper.getByRole("button", { name: "Review order" }).click();
    await shopper.getByRole("button", { name: "Place order" }).click();
    await expect(shopper.getByRole("heading", { level: 1, name: "Thank you, Grace" })).toBeVisible({
      timeout: 30_000,
    });
    const orderNumber = (
      (await shopper.getByText(/Your order number is TX-\d{6}/).textContent()) ?? ""
    ).match(/TX-\d{6}/)?.[0];
    expect(orderNumber).toBeTruthy();

    // ...the merchant is emailed, sees only their part of it and ships it.
    const orderMail = await latestEmail(email, "merchant_new_order");
    expect(orderMail.subject).toContain(orderNumber ?? "");
    await gotoReady(page, "/merchant/orders");
    await page.getByRole("link", { name: orderNumber ?? "" }).click();
    await expect(page.getByRole("heading", { level: 1, name: orderNumber ?? "" })).toBeVisible();
    await expect(page.getByText("Grace Hopper")).toBeVisible();
    await page.waitForSelector("html[data-hydrated]", { state: "attached" });
    await page.getByRole("combobox", { name: "Carrier" }).selectOption("UPS");
    await page.getByRole("textbox", { name: "Tracking number" }).fill("1Z999AA10123456784");
    await page.getByRole("button", { name: "Mark shipped" }).click();
    await expect(page.getByText(/All your items in this order have shipped/)).toBeVisible();
    await expect(page.getByText("UPS · 1Z999AA10123456784")).toBeVisible();

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
    await eventually(shopper, "/search?q=linen%20midi%20dress", async () => {
      await expect(
        shopper.locator("article").getByRole("link", { name: "Linen Midi Dress", exact: true }),
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
