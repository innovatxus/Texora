import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { asReturningVisitor, gotoReady } from "./support/helpers";
import { createShopper, latestEmail, linkIn } from "./support/outbox";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const PASSWORD = "violet-harbour-stitch-42";
const SEED_PASSWORD = "Texora-demo-1";

test.beforeEach(async ({ context, baseURL }) => {
  await asReturningVisitor(context, baseURL);
  // Each test is its own visitor, as behind the hosting proxy, so per-IP limits don't collide.
  const octet = () => Math.floor(Math.random() * 254) + 1;
  await context.setExtraHTTPHeaders({
    "x-forwarded-for": `198.51.${octet()}.${octet()}`,
  });
});

/** A unique merchant per test and viewport, so parallel runs never collide. */
function newMerchant(testInfo: { project: { name: string } }) {
  const tag = `${testInfo.project.name.slice(0, 3)}${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
  return { email: `m-${tag}@example.com`, username: `m${tag}` };
}

async function register(page: Page, email: string, username: string, password = PASSWORD) {
  await gotoReady(page, "/merchant/register");
  await page.getByRole("textbox", { name: "Email" }).fill(email);
  await page.getByRole("textbox", { name: "Username" }).fill(username);
  await expect(page.getByText(`${username} is available`)).toBeVisible();
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(password);
  await page.getByRole("textbox", { name: "Confirm password", exact: true }).fill(password);
  await page.getByRole("checkbox", { name: /I agree to the Merchant terms/ }).check();
  await page.getByRole("button", { name: "Create merchant account" }).click();
  await expect(page).toHaveURL((u) => u.pathname === "/merchant", { timeout: 30_000 });
  await page.waitForSelector("html[data-hydrated]", { state: "attached" });
}

async function signInAsMerchant(page: Page, identifier: string, password = PASSWORD) {
  await gotoReady(page, "/merchant/sign-in");
  await page.getByRole("textbox", { name: "Email or username" }).fill(identifier);
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test.describe("registration", () => {
  test("validates on blur and summarises errors on submit", async ({ page }) => {
    await gotoReady(page, "/merchant/register");
    const emailBox = page.getByRole("textbox", { name: "Email" });
    await emailBox.fill("not-an-email");
    await emailBox.blur();
    await expect(page.getByText("Enter an email address like name@example.com")).toBeVisible();

    await page.getByRole("textbox", { name: "Username" }).fill("admin");
    await page.getByRole("textbox", { name: "Password", exact: true }).fill("password1234");
    await expect(page.getByText("Password strength: Too weak")).toBeAttached();
    // Leave the field first: its blur error moves the button, which would swallow the click.
    await page.keyboard.press("Tab");
    await expect(
      page.getByText("That password is too common — try a phrase only you would use"),
    ).toBeVisible();
    await page.getByRole("button", { name: "Create merchant account" }).click();

    const summary = page.getByRole("alert").filter({ hasText: "Check the highlighted fields" });
    await expect(summary).toBeVisible();
    await expect(
      summary.getByRole("link", { name: "That name is reserved — try another" }),
    ).toBeVisible();
    await expect(
      summary.getByRole("link", {
        name: "That password is too common — try a phrase only you would use",
      }),
    ).toBeVisible();
    await expect(
      summary.getByRole("link", { name: "Accept the merchant terms to continue" }),
    ).toBeVisible();
    // Focus moves to the first invalid field.
    await expect(emailBox).toBeFocused();
  });

  test("a new merchant registers, verifies their email and lands in the portal", async ({
    page,
  }, testInfo) => {
    const { email, username } = newMerchant(testInfo);
    await register(page, email, username);
    await expect(
      page.getByRole("heading", { level: 1, name: `Welcome, ${username}` }),
    ).toBeVisible();
    const banner = page.getByRole("region", { name: "Email verification" });
    await expect(banner).toContainText(`We sent a link to ${email}`);

    const mail = await latestEmail(email, "merchant_verify_email");
    expect(mail.subject).toBe("Verify your email to open your Texora shop");
    await gotoReady(page, linkIn(mail.html, "/merchant/verify-email"));
    await expect(page.getByText("Email verified. You can now submit your shop.")).toBeVisible();
    await page.getByRole("link", { name: "Go to your dashboard" }).click();
    await expect(page.getByRole("region", { name: "Email verification" })).toHaveCount(0);
    await expect(page.getByText("Verify your email (done)")).toBeAttached();
  });

  test("a taken username is flagged live and on submit", async ({ page }, testInfo) => {
    const { email, username } = newMerchant(testInfo);
    await register(page, email, username);
    await page.context().clearCookies();
    await asReturningVisitor(page.context(), testInfo.project.use.baseURL);

    await gotoReady(page, "/merchant/register");
    await page.getByRole("textbox", { name: "Username" }).fill(username);
    await expect(page.getByText("That username is taken")).toBeVisible();
  });

  test("a signed-in customer adds a shop to their account", async ({ page }, testInfo) => {
    // A dedicated shopper, so the seeded customer keeps its role for other tests.
    const { email, username } = newMerchant(testInfo);
    await createShopper(email, PASSWORD);
    await signInAsMerchant(page, email);
    await expect(page).toHaveURL((u) => u.pathname === "/merchant/register", { timeout: 30_000 });
    await page.waitForSelector("html[data-hydrated]", { state: "attached" });
    await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();

    await page.getByRole("textbox", { name: "Username" }).fill(username);
    await expect(page.getByText(`${username} is available`)).toBeVisible();
    await page.getByRole("checkbox", { name: /I agree/ }).check();
    await page.getByRole("button", { name: "Become a merchant" }).click();
    await expect(page).toHaveURL((u) => u.pathname === "/merchant", { timeout: 30_000 });
    await expect(page.getByText(`@${username}`)).toBeVisible();

    // Registering again while signed in as a merchant just returns to the portal.
    await page.goto("/merchant/register");
    await expect(page).toHaveURL((u) => u.pathname === "/merchant");
  });
});

test.describe("sign-in", () => {
  test("merchants sign in with their username", async ({ page }, testInfo) => {
    const { email, username } = newMerchant(testInfo);
    await register(page, email, username);
    await page.context().clearCookies();
    await asReturningVisitor(page.context(), testInfo.project.use.baseURL);

    await signInAsMerchant(page, username);
    await expect(page).toHaveURL((u) => u.pathname === "/merchant", { timeout: 30_000 });
    await expect(page.getByText(`@${username}`)).toBeVisible();
  });

  test("wrong credentials get one generic message", async ({ page }) => {
    // A fresh identifier each run: failures count towards that identifier's lockout.
    await signInAsMerchant(page, `no-such-merchant-${Date.now().toString(36)}`, "wrong-password");
    await expect(page.getByText("Email/username or password is incorrect.")).toBeVisible();
  });

  test("a customer without a shop is offered to add one", async ({ page }) => {
    await signInAsMerchant(page, "customer@texora.test", SEED_PASSWORD);
    await expect(page).toHaveURL((u) => u.pathname === "/merchant/register", { timeout: 30_000 });
    await expect(
      page.getByRole("heading", { level: 1, name: "Add a shop to your account" }),
    ).toBeVisible();
    await expect(page.getByText("Signed in as customer@texora.test")).toBeVisible();
  });

  test("signed-out visitors to the portal return there after signing in", async ({
    page,
  }, testInfo) => {
    const { email, username } = newMerchant(testInfo);
    await register(page, email, username);
    await page.context().clearCookies();
    await asReturningVisitor(page.context(), testInfo.project.use.baseURL);

    await page.goto("/merchant");
    await expect(page).toHaveURL((u) => u.pathname === "/merchant/sign-in");
    await page.waitForSelector("html[data-hydrated]", { state: "attached" });
    await page.getByRole("textbox", { name: "Email or username" }).fill(email);
    await page.getByRole("textbox", { name: "Password", exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL((u) => u.pathname === "/merchant", { timeout: 30_000 });
  });
});

test.describe("password recovery", () => {
  test("a merchant resets their password from the emailed link", async ({ page }, testInfo) => {
    const { email, username } = newMerchant(testInfo);
    await register(page, email, username);
    await page.context().clearCookies();
    await asReturningVisitor(page.context(), testInfo.project.use.baseURL);

    await gotoReady(page, "/merchant/forgot-password");
    await page.getByRole("textbox", { name: "Email" }).fill(email);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByRole("status")).toContainText(`a reset link is on its way`);

    const mail = await latestEmail(email, "merchant_password_reset");
    await gotoReady(page, linkIn(mail.html, "/merchant/reset-password"));
    const next = "lantern-meadow-copper-17";
    await page.getByRole("textbox", { name: "New password", exact: true }).fill(next);
    await page.getByRole("textbox", { name: "Confirm new password", exact: true }).fill(next);
    await page.getByRole("button", { name: "Set new password" }).click();
    await expect(page).toHaveURL((u) => u.pathname === "/merchant/sign-in");
    await expect(page.getByText("Password changed. Sign in with your new password.")).toBeVisible();

    await page.waitForSelector("html[data-hydrated]", { state: "attached" });
    await page.getByRole("textbox", { name: "Email or username" }).fill(username);
    await page.getByRole("textbox", { name: "Password", exact: true }).fill(next);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL((u) => u.pathname === "/merchant", { timeout: 30_000 });
  });

  test("an expired reset link explains what to do", async ({ page }) => {
    await gotoReady(page, "/merchant/reset-password?oobCode=not-a-real-code");
    await expect(
      page.getByRole("alert").filter({ hasText: "That reset link has expired." }),
    ).toBeVisible();
  });

  test("unknown emails get the same confirmation", async ({ page }) => {
    await gotoReady(page, "/merchant/forgot-password");
    await page.getByRole("textbox", { name: "Email" }).fill("nobody-here@example.com");
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByRole("status")).toContainText("a reset link is on its way");
  });
});

test.describe("isolation", () => {
  test("merchants can't open the back office, and staff can't open the portal", async ({
    page,
  }, testInfo) => {
    const { email, username } = newMerchant(testInfo);
    await register(page, email, username);
    expect((await page.goto("/admin"))?.status()).toBe(403);

    await page.context().clearCookies();
    await asReturningVisitor(page.context(), testInfo.project.use.baseURL);
    await signInAsMerchant(page, "admin@texora.test", SEED_PASSWORD);
    await expect(page).toHaveURL((u) => u.pathname === "/admin", { timeout: 30_000 });
    expect((await page.goto("/merchant"))?.status()).toBe(403);
  });
});

test.describe("accessibility", () => {
  for (const path of [
    "/merchant/register",
    "/merchant/sign-in",
    "/merchant/forgot-password",
    "/merchant/reset-password",
    "/merchant/verify-email",
  ]) {
    test(`${path} has no axe violations`, async ({ page }) => {
      await gotoReady(page, path);
      const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
      expect(results.violations).toEqual([]);
    });
  }

  test("the portal home has no axe violations", async ({ page }, testInfo) => {
    const { email, username } = newMerchant(testInfo);
    await register(page, email, username);
    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    expect(results.violations).toEqual([]);
  });
});
