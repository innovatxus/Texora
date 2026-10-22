import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { generateSeed } from "../tests/fixtures/seed/generate";
import { asReturningVisitor, gotoReady } from "./support/helpers";
import { asSeparateVisitor } from "./support/merchant";
import { latestEmail, linkIn } from "./support/outbox";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const PASSWORD = "harbour-violet-lantern-31";
const PRODUCT = "/product/linen-camp-collar-shirt-men";

// Deterministic seed: well-stocked, full-price items for the bag.
const seed = generateSeed();
const live = new Set(
  seed.products.filter((p) => p.status === "live" && !p.badges.includes("sale")).map((p) => p.id),
);
const stocked = seed.variants.filter(
  (v) => live.has(v.productId) && (v.stockByLocation.online ?? 0) >= 30,
);
const shirt = seed.products.find((p) => p.slug === "linen-camp-collar-shirt-men");

test.beforeEach(async ({ context, baseURL }) => {
  await asReturningVisitor(context, baseURL);
  await asSeparateVisitor(context);
});

function newShopper(testInfo: { project: { name: string } }) {
  const tag = `${testInfo.project.name.slice(0, 3)}${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
  return { email: `shopper-${tag}@example.com`, firstName: "Ada", lastName: "Lovelace" };
}

async function register(
  page: Page,
  shopper: { email: string; firstName: string; lastName: string },
  { rewards = true } = {},
) {
  await gotoReady(page, "/auth/register");
  await page.getByRole("textbox", { name: "First name" }).fill(shopper.firstName);
  await page.getByRole("textbox", { name: "Last name" }).fill(shopper.lastName);
  await page.getByRole("textbox", { name: "Email", exact: true }).fill(shopper.email);
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(PASSWORD);
  if (!rewards) await page.getByRole("checkbox", { name: "Join rewards" }).uncheck();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL((u) => u.pathname === "/account", { timeout: 30_000 });
  await page.waitForSelector("html[data-hydrated]", { state: "attached" });
}

async function signIn(page: Page, email: string, password = PASSWORD, next = "/account") {
  await gotoReady(page, `/auth/signin?next=${encodeURIComponent(next)}`);
  await page.getByRole("textbox", { name: "Email", exact: true }).fill(email);
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL((u) => u.pathname === next, { timeout: 30_000 });
  await page.waitForSelector("html[data-hydrated]", { state: "attached" });
}

async function newVisitor(browser: Browser, baseURL: string | undefined): Promise<Page> {
  const context = await browser.newContext();
  await asReturningVisitor(context, baseURL);
  await asSeparateVisitor(context);
  return context.newPage();
}

/** Puts items in the persisted bag before the page loads (once per tab). */
async function withBag(page: Page, lines: Array<{ sku: string; productId: string }>) {
  await page.addInitScript((bagLines) => {
    if (window.sessionStorage.getItem("e2e-bag-seeded")) return;
    window.sessionStorage.setItem("e2e-bag-seeded", "1");
    window.localStorage.setItem(
      "texora-bag",
      JSON.stringify({
        state: {
          lines: bagLines.map((l) => ({ ...l, quantity: 1, addedAt: Date.now() })),
          savedForLater: [],
          promoCodes: [],
          giftCardCode: null,
          rewardsValue: 0,
        },
        version: 2,
      }),
    );
  }, lines);
}

const line = (i: number) => {
  const v = stocked[i];
  if (!v) throw new Error("Not enough seed variants");
  return { sku: v.sku, productId: v.productId };
};

test.describe("customer accounts", () => {
  test.setTimeout(180_000);

  test("registers into the account, and every account page passes axe", async ({
    page,
  }, testInfo) => {
    const shopper = newShopper(testInfo);
    await register(page, shopper);
    await expect(page.getByText("Hello, Ada")).toBeVisible();
    await expect(page.getByText("Core", { exact: true })).toBeVisible();

    for (const path of [
      "/account",
      "/account/orders",
      "/account/returns",
      "/account/rewards",
      "/account/wishlist",
      "/account/addresses",
      "/account/payment-methods",
      "/account/preferences",
      "/account/security",
      "/auth/register",
      "/auth/forgot-password",
    ]) {
      await gotoReady(page, path);
      await page.waitForLoadState("networkidle");
      const { violations } = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
      expect(
        violations.map((v) => `${path}: ${v.id}`),
        path,
      ).toEqual([]);
    }
  });

  test("the wishlist and bag follow the shopper to another device", async ({
    page,
    browser,
    baseURL,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Sync doesn't depend on the viewport");
    const shopper = newShopper(testInfo);

    // As a guest: save a product and put something in the bag.
    await withBag(page, [line(0)]);
    await gotoReady(page, PRODUCT);
    await page.waitForSelector("[data-interactive]", { state: "attached" });
    await page
      .getByRole("button", { name: "Save Linen Camp-Collar Shirt to wishlist" })
      .first()
      .click();
    await register(page, shopper);
    await gotoReady(page, "/account/wishlist");
    await expect(page.getByText("synced to your account")).toBeVisible({ timeout: 20_000 });

    // Another device: both are there after signing in.
    const other = await newVisitor(browser, baseURL);
    await signIn(other, shopper.email, PASSWORD, "/account/wishlist");
    await expect(other.getByRole("link", { name: /Linen Camp-Collar Shirt/ }).first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(async () => {
      await gotoReady(other, "/bag");
      await expect(other.getByRole("heading", { level: 1, name: "Your bag" })).toBeVisible();
      await expect(other.getByText("Your bag is empty")).toHaveCount(0);
    }).toPass({ timeout: 30_000 });
  });

  test("checks out with a saved address, then finds the order, its invoice and buys it again", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "One full purchase on desktop");
    const shopper = newShopper(testInfo);
    await register(page, shopper);

    await gotoReady(page, "/account/addresses");
    const field = (name: string) => page.getByRole("textbox", { name, exact: true });
    await field("First name").fill("Ada");
    await field("Last name").fill("Lovelace");
    await field("Address").fill("118 Greene Street");
    await field("City").fill("New York");
    await page.getByRole("combobox", { name: "State", exact: true }).selectOption("NY");
    await field("ZIP code").fill("10012");
    await field("Phone").fill("212 555 0100");
    await page.getByRole("textbox", { name: "Label (optional)" }).fill("Home");
    await page.getByRole("button", { name: "Add address" }).click();
    await expect(page.getByText("Address added.")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Default shipping")).toBeVisible();

    await withBag(page, [line(1)]);
    await gotoReady(page, "/checkout");
    await expect(page.getByRole("textbox", { name: "Email", exact: true })).toHaveValue(
      shopper.email,
    );
    await page.getByRole("button", { name: "Continue to shipping" }).click();
    await expect(page.getByRole("radio", { name: /Home · Default/ })).toBeChecked();
    await page.getByRole("button", { name: "Continue to delivery" }).click();
    await page.getByRole("button", { name: "Continue to payment" }).click();
    await page.getByText("Pay on delivery", { exact: true }).click();
    await page.getByRole("button", { name: "Review order" }).click();
    await page.getByRole("button", { name: "Place order" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Thank you, Ada" })).toBeVisible({
      timeout: 30_000,
    });
    const number = (
      (await page.getByText(/Your order number is TX-\d{6}/).textContent()) ?? ""
    ).match(/TX-\d{6}/)?.[0];
    expect(number).toBeTruthy();

    await gotoReady(page, "/account/orders");
    await page.getByRole("link", { name: `View order ${number}` }).click();
    await expect(page).toHaveURL(/\/orders\/[^/]+$/);
    await page.waitForSelector("html[data-hydrated]", { state: "attached" });
    await page.getByRole("link", { name: "Invoice" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Invoice" })).toBeVisible();
    // Earlier pages stay mounted (hidden) for back navigation; look inside the invoice.
    await expect(page.getByRole("definition").filter({ hasText: number ?? "" })).toBeVisible();
    await page.goBack();
    await page.waitForSelector("html[data-hydrated]", { state: "attached" });
    await page.getByRole("button", { name: "Buy it again" }).click();
    await expect(page).toHaveURL(/\/bag$/);
    await expect(page.getByText("Your bag is empty")).toHaveCount(0);
  });

  test("a saved size is pre-selected on product pages", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Preference logic doesn't depend on viewport");
    test.skip(!shirt, "The seeded shirt is needed");
    const shopper = newShopper(testInfo);
    await register(page, shopper);
    await gotoReady(page, "/account/preferences");
    await page.getByRole("combobox", { name: /Tops, sweaters/ }).selectOption("M");
    await page.getByRole("button", { name: "Save sizes" }).click();
    await expect(page.getByText("Saved. We'll pre-select these")).toBeVisible();

    await gotoReady(page, PRODUCT);
    await page.waitForSelector("[data-interactive]", { state: "attached" });
    await expect(
      page.getByRole("group", { name: /^Size/ }).getByRole("radio", { name: /^M\b/ }),
    ).toBeChecked();
  });

  test("a customer joins rewards from the account", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "One run is enough");
    const shopper = newShopper(testInfo);
    await register(page, shopper, { rewards: false });
    await gotoReady(page, "/account/rewards");
    await page.getByRole("button", { name: "Join rewards" }).click();
    await expect(page.getByText("Core", { exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "Points history" })).toBeVisible();
  });

  test("changes the password, resets it by email, then deletes the account", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "One run is enough");
    const shopper = newShopper(testInfo);
    await register(page, shopper);

    await gotoReady(page, "/account/security");
    const pw = (name: string) => page.getByRole("textbox", { name, exact: true });
    await pw("Current password").fill(PASSWORD);
    await pw("New password").fill("silver-orchard-kite-52");
    await pw("Confirm new password").fill("silver-orchard-kite-52");
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByText(/Password changed/)).toBeVisible({ timeout: 20_000 });

    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page).toHaveURL((u) => u.pathname === "/", { timeout: 20_000 });

    await gotoReady(page, "/auth/forgot-password");
    await page.getByRole("textbox", { name: "Email", exact: true }).fill(shopper.email);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByText(/a reset link is on its way/)).toBeVisible();
    const mail = await latestEmail(shopper.email, "customer_password_reset");
    await gotoReady(page, linkIn(mail.html, "/auth/reset-password"));
    await pw("New password").fill("copper-meadow-lantern-77");
    await pw("Confirm new password").fill("copper-meadow-lantern-77");
    await page.getByRole("button", { name: "Set new password" }).click();
    await expect(page.getByText("Password changed. Sign in with your new password.")).toBeVisible({
      timeout: 20_000,
    });
    await signIn(page, shopper.email, "copper-meadow-lantern-77", "/account/security");

    await pw("Password").fill("copper-meadow-lantern-77");
    await page.getByRole("textbox", { name: "Type DELETE to confirm" }).fill("DELETE");
    await page.getByRole("button", { name: "Delete my account" }).click();
    await expect(page).toHaveURL((u) => u.pathname === "/", { timeout: 20_000 });

    await gotoReady(page, "/auth/signin");
    await page.getByRole("textbox", { name: "Email", exact: true }).fill(shopper.email);
    await pw("Password").fill("copper-meadow-lantern-77");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("That email and password don't match")).toBeVisible();
  });
});
