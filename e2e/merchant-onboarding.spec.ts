import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";
import { asReturningVisitor, gotoReady } from "./support/helpers";
import { asSeparateVisitor, newMerchant, registerMerchant, verifyEmail } from "./support/merchant";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

test.beforeEach(async ({ context, baseURL }) => {
  await asReturningVisitor(context, baseURL);
  await asSeparateVisitor(context);
});

/** A solid PNG of the given size, as a file chooser payload. */
async function png(name: string, width: number, height: number, colour: string) {
  const buffer = await sharp({ create: { width, height, channels: 3, background: colour } })
    .png()
    .toBuffer();
  return { name, mimeType: "image/png", buffer };
}

async function fillBasics(page: Page, shopName: string) {
  await page.getByRole("textbox", { name: "Shop name" }).fill(shopName);
  await expect(page.getByText("Available", { exact: true })).toBeVisible();
  await page.getByRole("textbox", { name: "Tagline" }).fill("Linen for warm days");
  await page.getByRole("checkbox", { name: "Women" }).check();
  await page.getByRole("checkbox", { name: "Dresses" }).check();
  await page.getByText("Boutique", { exact: true }).click();
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(page).toHaveURL((u) => u.pathname === "/merchant/onboarding/branding", {
    timeout: 30_000,
  });
}

async function uploadAndCrop(
  page: Page,
  input: number,
  file: Awaited<ReturnType<typeof png>>,
  title: string,
) {
  await page.locator('input[type="file"]').nth(input).setInputFiles(file);
  const dialog = page.getByRole("dialog", { name: title });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Use this crop" }).click();
  await expect(dialog).toBeHidden();
}

test.describe("shop onboarding", () => {
  test.setTimeout(120_000);

  test("a verified merchant sets up their shop and submits it for review", async ({
    page,
  }, testInfo) => {
    const { email, username } = newMerchant(testInfo);
    await registerMerchant(page, email, username);
    await verifyEmail(page, email);
    await gotoReady(page, "/merchant");
    await expect(page.getByText("Finish setting up your shop. 0 of 5 steps done.")).toBeVisible();
    await page.getByRole("link", { name: "Continue setup" }).click();
    await expect(page).toHaveURL((u) => u.pathname === "/merchant/onboarding/basics", {
      timeout: 30_000,
    });
    await page.waitForSelector("html[data-hydrated]", { state: "attached" });

    // Step 1
    await fillBasics(page, `Maison ${username}`);
    await page.waitForSelector("html[data-hydrated]", { state: "attached" });

    // Step 2: logo + banner through the real upload pipeline.
    await uploadAndCrop(page, 0, await png("logo.png", 800, 800, "#1f2a44"), "Crop your logo");
    await expect(page.getByText("Avatar")).toBeVisible({ timeout: 30_000 });
    await uploadAndCrop(page, 1, await png("banner.png", 2700, 900, "#3d5a3a"), "Crop your banner");
    await expect(page.getByText("Desktop", { exact: true })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Save and continue" }).click();
    await expect(page).toHaveURL((u) => u.pathname === "/merchant/onboarding/contact", {
      timeout: 30_000,
    });
    await page.waitForSelector("html[data-hydrated]", { state: "attached" });

    // Step 3
    await page.getByRole("textbox", { name: "Instagram (optional)" }).fill("@maison.rue");
    await page.getByText("3–5 business days").click();
    await page.getByRole("button", { name: "Save and continue" }).click();
    await expect(page).toHaveURL((u) => u.pathname === "/merchant/onboarding/locations", {
      timeout: 30_000,
    });
    await page.waitForSelector("html[data-hydrated]", { state: "attached" });

    // Step 4: the form is open because there are no locations yet.
    await page.getByRole("textbox", { name: "Location name" }).fill("Mercer Street studio");
    await page.getByRole("checkbox", { name: /Retail store/ }).check();
    await page.getByRole("textbox", { name: "Street address" }).fill("26 July Street");
    await page.getByRole("textbox", { name: "City" }).fill("Zamalek");
    await page.getByRole("combobox", { name: "Governorate" }).selectOption("C");
    await page.getByRole("textbox", { name: "Postal code (optional)" }).fill("11211");
    // A location that ships completes the step and moves straight on to review.
    await page.getByRole("button", { name: "Add location" }).click();
    await expect(page).toHaveURL((u) => u.pathname === "/merchant/onboarding/review", {
      timeout: 30_000,
    });

    // Step 5
    await expect(page.getByRole("region", { name: "Still to do" })).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 2, name: `Maison ${username}` })).toBeVisible();
    await page.waitForSelector("html[data-hydrated]", { state: "attached" });
    await page.getByRole("button", { name: "Submit for review" }).click();
    await expect(page).toHaveURL((u) => u.pathname === "/merchant", { timeout: 30_000 });
    await expect(
      page.getByText("Your shop is in review — we usually reply within 1 business day."),
    ).toBeVisible();
    await expect(page.getByText("Shop submitted for review")).toBeVisible();
  });

  test("an unverified merchant sees what blocks submission", async ({ page }, testInfo) => {
    const { email, username } = newMerchant(testInfo);
    await registerMerchant(page, email, username);
    await gotoReady(page, "/merchant/onboarding/basics");
    await fillBasics(page, `Atelier ${username}`);
    await gotoReady(page, "/merchant/onboarding/review");
    const todo = page.getByRole("region", { name: "Still to do" });
    for (const item of [
      "Verify your email",
      "Add a logo",
      "Add a banner",
      "Add a ship-from location",
    ]) {
      await expect(todo.getByRole("link", { name: item })).toBeVisible();
    }
    await expect(page.getByRole("button", { name: "Submit for review" })).toBeDisabled();
  });

  test("step 1 explains what's missing", async ({ page }, testInfo) => {
    const { email, username } = newMerchant(testInfo);
    await registerMerchant(page, email, username);
    await gotoReady(page, "/merchant/onboarding/basics");
    await page.getByRole("button", { name: "Save and continue" }).click();
    const summary = page.getByRole("alert").filter({ hasText: "Check the highlighted fields" });
    await expect(summary.getByRole("link", { name: "Use 2 to 60 characters" })).toBeVisible();
    await expect(
      summary.getByRole("link", { name: "Choose at least one department" }),
    ).toBeVisible();
    await expect(summary.getByRole("link", { name: "Choose at least one category" })).toBeVisible();
  });

  test("onboarding steps have no axe violations", async ({ page }, testInfo) => {
    const { email, username } = newMerchant(testInfo);
    await registerMerchant(page, email, username);
    await gotoReady(page, "/merchant/onboarding/basics");
    expect((await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()).violations).toEqual([]);
    await fillBasics(page, `Studio ${username}`);
    for (const step of ["branding", "contact", "locations", "review"]) {
      await gotoReady(page, `/merchant/onboarding/${step}`);
      const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
      expect(results.violations, step).toEqual([]);
    }
    await gotoReady(page, "/merchant");
    expect((await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()).violations).toEqual([]);
  });
});
