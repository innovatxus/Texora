import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { generateSeed } from "../scripts/seed/generate";
import { asReturningVisitor, gotoReady } from "./support/helpers";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const seed = generateSeed();
const [delivered, shipped] = seed.orders;

test.beforeEach(async ({ context, baseURL }) => {
  await asReturningVisitor(context, baseURL);
});

async function lookUp(page: Page, number: string, email: string) {
  await gotoReady(page, "/orders/lookup");
  await page.getByRole("textbox", { name: "Order number", exact: true }).fill(number);
  await page.getByRole("textbox", { name: "Email", exact: true }).fill(email);
  await page.getByRole("button", { name: "Find my order" }).click();
}

test.describe("order lookup and tracking", () => {
  test("finds an order by number and email and shows its progress", async ({ page }) => {
    if (!shipped) throw new Error("seed has no orders");
    // Typed without the prefix: still found.
    await lookUp(page, shipped.number.replace("TX-", ""), seed.demoOrderEmail.toUpperCase());
    await expect(page).toHaveURL(new RegExp(`/orders/${shipped.id}\\?t=`));
    await expect(page.getByRole("heading", { level: 1, name: "On its way" })).toBeVisible();
    const progress = page.getByRole("region", { name: "Progress" });
    await expect(progress.locator('[aria-current="step"]')).toContainText("Shipped");
    await expect(page.getByText(/Tracking number 1Z/)).toBeVisible();
  });

  test("doesn't reveal which detail was wrong", async ({ page }) => {
    if (!delivered) throw new Error("seed has no orders");
    await lookUp(page, delivered.number, "someone@else.test");
    await expect(
      page.getByText(
        "We couldn't find an order with that number and email. Check both and try again.",
      ),
    ).toBeVisible();
  });

  test("an order page without its link is not found", async ({ page }) => {
    await page.goto(`/orders/${delivered?.id ?? "x"}?t=forged`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("We can't find that page");
  });
});

test("guest return by mail, with a QR label", async ({ page }, testInfo) => {
  // Creates data: one viewport is enough (each run starts from a fresh seed in CI).
  test.skip(testInfo.project.name !== "desktop", "Mutates the seeded order");
  if (!delivered) throw new Error("seed has no orders");
  await lookUp(page, delivered.number, seed.demoOrderEmail);
  await expect(page.getByRole("heading", { level: 1, name: "Delivered" })).toBeVisible();
  await page.getByRole("link", { name: "Start a return" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Start a return" })).toBeVisible();
  await page.waitForSelector("html[data-hydrated]", { state: "attached" });

  // Nothing chosen yet: explained inline.
  await page.getByRole("button", { name: "Confirm return" }).click();
  await expect(page.getByText("Choose at least one item to return")).toBeVisible();

  const returnable = delivered.lines.find((l) => !l.finalSale);
  if (!returnable) throw new Error("seed order has nothing returnable");
  await page.getByRole("checkbox", { name: returnable.name }).check();
  await page.getByRole("button", { name: "Confirm return" }).click();
  await expect(page.locator("p", { hasText: "Choose a reason" })).toBeVisible();
  await page.getByRole("combobox", { name: "Reason" }).selectOption("too_small");
  await expect(page.getByText("Estimated refund")).toBeVisible();
  await page.getByRole("button", { name: "Confirm return" }).click();

  await expect(page).toHaveURL(/\/returns\/.+\?t=/);
  await expect(page.getByRole("heading", { level: 1, name: /^Return TX-\d+-R\d+$/ })).toBeVisible();
  await expect(page.getByRole("img", { name: /QR code for return/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Print label" })).toBeVisible();
});

test.describe("store locator", () => {
  test("filters by service and opens a store", async ({ page }) => {
    await gotoReady(page, "/stores");
    await expect(page.getByText("3 stores")).toBeVisible();
    await page.getByRole("button", { name: "Personal styling" }).click();
    await expect(page.getByText("1 store", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: /Store details.*Texora SoHo/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Texora SoHo" })).toBeVisible();
    await expect(page.getByRole("table", { name: "Opening hours, local time" })).toBeVisible();
    // The open/closed line is computed in the browser.
    await expect(
      page
        .getByText(/^(Open until|Closed ·)/)
        .locator("visible=true")
        .first(),
    ).toBeVisible();
  });

  test("searches by city", async ({ page }) => {
    await gotoReady(page, "/stores");
    await page.getByRole("searchbox", { name: "City, state or ZIP code" }).fill("austin");
    await expect(page.getByText("1 store", { exact: true })).toBeVisible();
    await page.getByRole("searchbox", { name: "City, state or ZIP code" }).fill("Paris");
    await expect(page.getByText(/No stores match/)).toBeVisible();
  });

  // Same PPR soft-404 limitation as unknown products (D-039): not-found page, noindex.
  test("an unknown store shows the not-found page", async ({ page }) => {
    await gotoReady(page, "/stores/atlantis");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("We can't find that page");
    await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);
  });
});

test.describe("help centre", () => {
  test("search answers questions as you type", async ({ page }) => {
    await gotoReady(page, "/help");
    await page.getByRole("searchbox", { name: "Search help" }).fill("refund");
    await expect(page.getByRole("heading", { name: "When will I get my refund?" })).toBeVisible();
    await page.getByRole("searchbox", { name: "Search help" }).fill("spaceship");
    await expect(page.getByText(/No answers match/)).toBeVisible();
  });

  test("FAQ answers expand", async ({ page }) => {
    await gotoReady(page, "/help/faq");
    const question = page.getByRole("button", { name: "How do I track my order?" });
    await expect(question).toHaveAttribute("aria-expanded", "false");
    await question.click();
    await expect(question).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByText(/look your order up with its number/)).toBeVisible();
  });

  test("contact form validates, then confirms with a reference", async ({ page }) => {
    await gotoReady(page, "/help/contact");
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByText("Enter your name")).toBeVisible();
    await page.getByRole("textbox", { name: "Name", exact: true }).fill("Ada Lovelace");
    await page.getByRole("textbox", { name: "Email", exact: true }).fill("ada@example.com");
    await page.getByRole("combobox", { name: "What's it about?" }).selectOption("product");
    await page
      .getByRole("textbox", { name: "Message", exact: true })
      .fill("Does the linen shirt dress come in petite?");
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByRole("status")).toContainText("Your reference is");
  });

  test("unknown topics show the not-found page", async ({ page }) => {
    await gotoReady(page, "/help/not-a-topic");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("We can't find that page");
    await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);
  });
});

test.describe("gift cards", () => {
  test("checks a balance", async ({ page }) => {
    await gotoReady(page, "/gift-cards");
    const field = page.getByRole("textbox", { name: "Gift card number" });
    await field.fill("TXGC-NOPE-NOPE-NOPE");
    await page.getByRole("button", { name: "Check balance" }).click();
    await expect(page.getByText(/couldn't find that gift card/)).toBeVisible();
    await field.fill(seed.demoGiftCardCode.toLowerCase());
    await page.getByRole("button", { name: "Check balance" }).click();
    await expect(page.getByText("Card ending 0001")).toBeVisible();
    await expect(page.getByText("$100.00")).toBeVisible();
  });

  test("the purchase form previews the card", async ({ page }) => {
    await gotoReady(page, "/gift-cards/buy");
    await page.getByText("$100.00", { exact: true }).first().click();
    await page.getByRole("textbox", { name: "Recipient's name" }).fill("Grace");
    await expect(page.getByText("For Grace")).toBeVisible();
  });
});

test("price-drop alert from the product page", async ({ page }) => {
  const product = seed.products.find((p) => p.status === "live");
  if (!product) throw new Error("no live product");
  await gotoReady(page, `/product/${product.slug}`);
  await page.waitForSelector("[data-interactive]", { state: "attached" });
  await page.getByRole("button", { name: "Email me if the price drops" }).click();
  await page.getByRole("button", { name: "Alert me" }).click();
  await expect(page.getByText("Enter a valid email address")).toBeVisible();
  await page.getByRole("textbox", { name: "Email for price alert" }).fill("alerts@example.com");
  await page.getByRole("button", { name: "Alert me" }).click();
  await expect(page.getByText("We'll email you once if the price drops.")).toBeVisible();
});

test.describe("accessibility", () => {
  for (const path of [
    "/help",
    "/help/faq",
    "/help/contact",
    "/help/size-guides",
    "/stores",
    "/stores/soho",
    "/gift-cards",
    "/gift-cards/buy",
    "/orders/lookup",
  ]) {
    test(`${path} has no axe violations`, async ({ page }) => {
      await gotoReady(page, path);
      await page.waitForLoadState("networkidle");
      const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
      expect(results.violations).toEqual([]);
    });
  }

  test("an order page has no axe violations", async ({ page }) => {
    if (!delivered) throw new Error("seed has no orders");
    await lookUp(page, delivered.number, seed.demoOrderEmail);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.waitForLoadState("networkidle");
    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    expect(results.violations).toEqual([]);
  });
});
