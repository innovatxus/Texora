import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";
import { asReturningVisitor, gotoReady } from "./support/helpers";
import { asSeparateVisitor, merchantWithShop } from "./support/merchant";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

test.beforeEach(async ({ context, baseURL }) => {
  await asReturningVisitor(context, baseURL);
  await asSeparateVisitor(context);
});

async function startProduct(page: Page) {
  await gotoReady(page, "/merchant/products");
  await expect(page.getByText("You haven't added any products yet.")).toBeVisible();
  await page.getByRole("link", { name: "Add your first product" }).click();
  await expect(page).toHaveURL((u) => /^\/merchant\/products\/[A-Za-z0-9]+$/.test(u.pathname), {
    timeout: 30_000,
  });
  await page.waitForSelector("html[data-hydrated]", { state: "attached" });
  await expect(page.getByRole("textbox", { name: "Product name" })).toBeVisible({
    timeout: 30_000,
  });
}

async function addColour(page: Page, name: string) {
  const input = page.getByRole("textbox", { name: "New colour" });
  await input.fill(name);
  await input.press("Enter");
  await expect(page.getByRole("textbox", { name: "Colour name" }).last()).toHaveValue(name);
}

test.describe("product editor", () => {
  test.setTimeout(180_000);

  test("builds a 3 × 2 × 6 matrix, bulk edits, uploads a photo and autosaves", async ({
    page,
  }, testInfo) => {
    test.skip(
      ["mobile", "tablet"].includes(testInfo.project.name),
      "Desktop layout; phones have their own test",
    );
    await merchantWithShop(page, testInfo);
    await startProduct(page);

    await page.getByRole("textbox", { name: "Product name" }).fill("Linen Midi Dress");
    await page
      .getByRole("textbox", { name: "Description", exact: true })
      .fill("Washed linen, cut for warm days.");
    await page.getByRole("combobox", { name: "Department" }).selectOption("women");
    await page.getByRole("combobox", { name: "Category" }).selectOption("dresses");
    await expect(page.getByRole("textbox", { name: "Style ID" })).not.toHaveValue("");

    await page.getByRole("combobox", { name: "Length" }).selectOption("midi");
    await page.getByRole("combobox", { name: "Sleeve" }).selectOption("short");

    for (const colour of ["Navy", "Sand", "Black"]) await addColour(page, colour);
    await page.getByRole("checkbox", { name: "Petite" }).check();
    for (const size of ["XS", "S", "M", "L", "XL", "XXL"]) {
      await page
        .locator("label")
        .filter({ hasText: new RegExp(`^${size}$`) })
        .click();
    }
    await expect(page.getByText("36 of 36 variants")).toBeVisible();

    await page.getByRole("checkbox", { name: "Select all shown variants" }).check();
    const bulk = page.getByRole("group", { name: "Bulk edit" });
    await bulk.getByRole("textbox", { name: "Price ($)" }).fill("148");
    await bulk.getByRole("button", { name: "Apply price" }).click();
    await expect(bulk.getByText("Applied to 36 selected rows.")).toBeVisible();
    await bulk.getByRole("textbox", { name: "Stock" }).fill("5");
    await bulk.getByRole("button", { name: "Apply stock" }).click();
    await expect(page.getByRole("textbox", { name: "Price ($), Navy, Regular, XS" })).toHaveValue(
      "148.00",
    );

    // One cell edited by keyboard: type, Enter moves down.
    const cell = page.getByRole("textbox", { name: "Price ($), Navy, Regular, XS" });
    await cell.fill("158");
    await cell.press("Enter");
    await expect(page.getByRole("textbox", { name: "Price ($), Navy, Regular, S" })).toBeFocused();

    // A photo for Navy through the real pipeline, then confirm its alt text.
    const photo = await sharp({
      create: { width: 1200, height: 1600, channels: 3, background: "#1f2a44" },
    })
      .png()
      .toBuffer();
    await page
      .locator('input[type="file"][accept*="image/jpeg"]')
      .first()
      .setInputFiles({ name: "navy.png", mimeType: "image/png", buffer: photo });
    await expect(page.getByRole("list", { name: "Navy photos" }).getByText("Main")).toBeVisible({
      timeout: 30_000,
    });
    await page.getByText("Alt text and focal points").first().click();
    await page.getByRole("checkbox", { name: "This description is right" }).first().check();

    await expect(page.getByRole("status").filter({ hasText: /^Saved / })).toBeVisible({
      timeout: 20_000,
    });

    await page.reload();
    await page.waitForSelector("html[data-hydrated]", { state: "attached" });
    await expect(page.getByRole("textbox", { name: "Product name" })).toHaveValue(
      "Linen Midi Dress",
      {
        timeout: 30_000,
      },
    );
    await expect(page.getByText("36 of 36 variants")).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Price ($), Navy, Regular, XS" })).toHaveValue(
      "158.00",
    );

    // Preview renders the real PDP with the draft.
    const previewHref = await page.getByRole("link", { name: /Preview/ }).getAttribute("href");
    await gotoReady(page, previewHref ?? "");
    await expect(page.getByRole("heading", { level: 1, name: "Linen Midi Dress" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Preview — not for sale yet" })).toBeDisabled();

    // The list shows it; duplicate, then archive the copy.
    await gotoReady(page, "/merchant/products");
    const row = page.getByRole("row", { name: /Linen Midi Dress/ });
    await expect(row.getByText("Draft")).toBeVisible();
    await page.getByRole("checkbox", { name: "Select Linen Midi Dress" }).check();
    await page.getByRole("button", { name: "Duplicate" }).click();
    await expect(page.getByText("1 product duplicated")).toBeVisible();
    await page.getByRole("checkbox", { name: "Select Linen Midi Dress (copy)" }).check();
    await page.getByRole("button", { name: "Archive" }).click();
    await expect(page.getByText("1 product archived")).toBeVisible();
    await expect(page.getByRole("link", { name: "Linen Midi Dress (copy)" })).toHaveCount(0);
  });

  test("works on a phone: sections as accordions and variants as cards", async ({
    page,
  }, testInfo) => {
    test.skip(!["mobile"].includes(testInfo.project.name), "Phone layout");
    await merchantWithShop(page, testInfo);
    await startProduct(page);
    await page.getByRole("textbox", { name: "Product name" }).fill("Poplin Shirt Dress");
    await page.getByRole("combobox", { name: "Department" }).selectOption("women");
    await page.getByRole("combobox", { name: "Category" }).selectOption("dresses");
    await page.getByRole("button", { name: "Options" }).click();
    await addColour(page, "White");
    await page.locator("label").filter({ hasText: /^M$/ }).click();
    await expect(page.getByRole("region", { name: "White" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Price ($), White, Regular, M" })).toBeVisible();
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByRole("status").filter({ hasText: /^Saved / })).toBeVisible({
      timeout: 20_000,
    });
  });

  test("the product pages have no axe violations", async ({ page }, testInfo) => {
    await merchantWithShop(page, testInfo);
    await gotoReady(page, "/merchant/products");
    expect((await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()).violations).toEqual([]);
    await page.getByRole("link", { name: "Add your first product" }).click();
    await expect(page.getByRole("textbox", { name: "Product name" })).toBeVisible({
      timeout: 30_000,
    });
    expect((await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()).violations).toEqual([]);
  });
});
