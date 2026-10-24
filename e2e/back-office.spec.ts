import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { generateSeed } from "../tests/fixtures/seed/generate";
import { asReturningVisitor, gotoReady } from "./support/helpers";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const PASSWORD = "Texora-demo-1";
const seed = generateSeed();

test.beforeEach(async ({ context, baseURL }) => {
  await asReturningVisitor(context, baseURL);
});

async function signIn(page: Page, email: string, next = "/admin") {
  await gotoReady(page, `/auth/signin?next=${encodeURIComponent(next)}`);
  await page.getByRole("textbox", { name: "Email", exact: true }).fill(email);
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  // The session cookie is set by a Server Action, then the app navigates.
  await expect(page).toHaveURL((u) => u.pathname === next.split("?")[0], { timeout: 30_000 });
  await page.waitForSelector("html[data-hydrated]", { state: "attached" });
}

test.describe("sign-in", () => {
  test("wrong credentials get one generic message", async ({ page }) => {
    await gotoReady(page, "/auth/signin");
    // A throwaway address: failures count towards that account's lockout.
    await page
      .getByRole("textbox", { name: "Email", exact: true })
      .fill(`nobody-${Date.now().toString(36)}@example.com`);
    await page.getByRole("textbox", { name: "Password", exact: true }).fill("not-the-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(
      page.getByText("That email and password don't match. Check them and try again."),
    ).toBeVisible();
  });

  test("staff land in the back office", async ({ page }) => {
    await signIn(page, "admin@texora.test");
    await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Back office" })).toBeVisible();
  });

  test("the back office has its own sign-in, and returns to the page asked for", async ({
    page,
  }) => {
    await gotoReady(page, "/admin/orders");
    await expect(page).toHaveURL(/\/admin\/sign-in\?next=%2Fadmin%2Forders$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Back office sign in" }),
    ).toBeVisible();
    await page.getByRole("textbox", { name: "Email", exact: true }).fill("manager@texora.test");
    await page.getByRole("textbox", { name: "Password", exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL((u) => u.pathname === "/admin/orders", { timeout: 30_000 });
    await expect(page.getByRole("heading", { level: 1, name: "Orders" })).toBeVisible();
  });

  test("the back office sign-in refuses shoppers' accounts", async ({ page }) => {
    await gotoReady(page, "/admin/sign-in");
    await page.getByRole("textbox", { name: "Email", exact: true }).fill("customer@texora.test");
    await page.getByRole("textbox", { name: "Password", exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText(/This sign-in is for the Texora team/)).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/sign-in/);
  });
});

test.describe("permissions", () => {
  test("customers are refused the back office", async ({ page }) => {
    await signIn(page, "customer@texora.test", "/");
    const response = await page.goto("/admin");
    expect(response?.status()).toBe(403);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "You don't have access to this page",
    );
  });

  test("a merchandiser sees catalog screens but not orders", async ({ page }) => {
    await signIn(page, "merchandiser@texora.test");
    const nav = page.getByRole("navigation", { name: "Back office" });
    await expect(nav.getByRole("link", { name: "Products" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Orders" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "Users & roles" })).toHaveCount(0);
    const response = await page.goto("/admin/orders");
    expect(response?.status()).toBe(403);
  });

  test("customer service can see orders but not settings", async ({ page }) => {
    await signIn(page, "customer-service@texora.test");
    await gotoReady(page, "/admin/orders");
    await expect(page.getByRole("heading", { level: 1, name: "Orders" })).toBeVisible();
    const response = await page.goto("/admin/settings");
    expect(response?.status()).toBe(403);
  });
});

test.describe("orders", () => {
  test("finds an order and adds an internal note", async ({ page }) => {
    const order = seed.orders[1];
    if (!order) throw new Error("seed has no orders");
    await signIn(page, "customer-service@texora.test");
    await gotoReady(page, `/admin/orders?q=${order.number}`);
    await page.getByRole("link", { name: order.number }).click();
    await expect(page.getByRole("heading", { level: 1, name: order.number })).toBeVisible();
    await page.waitForSelector("html[data-hydrated]", { state: "attached" });
    const note = `Called the customer ${Date.now()}`;
    await page.getByRole("textbox", { name: "Internal note" }).fill(note);
    await page.getByRole("button", { name: "Add note" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Note added" })).toBeVisible();
    await expect(page.getByText(note)).toBeVisible();
  });

  test("an agent's refund over the limit is refused with a clear reason", async ({ page }) => {
    // An order worth more than the EGP 1,000 test limit, with nothing refunded yet.
    const order = seed.orders.find((o) => o.totals.total > 200_000 && o.status !== "cancelled");
    if (!order) throw new Error("No seed order above the refund limit");
    await signIn(page, "customer-service@texora.test");
    await gotoReady(page, `/admin/orders/${order.id}`);
    page.on("dialog", (d) => void d.accept());
    await page.getByRole("spinbutton", { name: "Amount (EGP)" }).fill("1500");
    await page.getByRole("textbox", { name: "Reason" }).first().fill("Damaged in transit");
    await page.getByRole("button", { name: "Refund", exact: true }).click();
    await expect(page.getByText(/Refunds above EGP.1,000 per order need an admin/)).toBeVisible();
  });
});

test.describe("accessibility", () => {
  for (const path of [
    "/admin",
    "/admin/orders",
    "/admin/returns",
    "/admin/catalog",
    "/admin/inventory",
    "/admin/promotions",
    "/admin/users",
    "/admin/settings",
    "/admin/audit",
  ]) {
    test(`${path} has no axe violations`, async ({ page }) => {
      await signIn(page, "admin@texora.test", path);
      await page.waitForLoadState("networkidle");
      // Recharts draws its SVG after layout; the chart is aria-hidden with a table fallback.
      const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
      expect(results.violations).toEqual([]);
    });
  }
});
