import { expect, test, type Page } from "@playwright/test";
import { hasPermission, ROUTE_PERMISSIONS, type Role } from "../src/lib/auth/rbac";
import { generateSeed } from "../tests/fixtures/seed/generate";
import { asReturningVisitor, gotoReady } from "./support/helpers";

const PASSWORD = "Texora-demo-1";
const seed = generateSeed();

test.beforeEach(async ({ context, baseURL }) => {
  await asReturningVisitor(context, baseURL);
});

async function signIn(page: Page, email: string, next: string) {
  await gotoReady(page, `/auth/signin?next=${encodeURIComponent(next)}`);
  await page.getByRole("textbox", { name: "Email", exact: true }).fill(email);
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL((u) => u.pathname === next, { timeout: 30_000 });
  await page.waitForSelector("html[data-hydrated]", { state: "attached" });
}

/** Seeded accounts are `<role>@texora.test`, underscores as hyphens. */
const emailFor = (role: Role) => `${role.replace(/_/g, "-")}@texora.test`;

test.describe("phase 9 flows", () => {
  test.setTimeout(180_000);
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1440, "Flows run once, on desktop");

  test("a rewards member spends points at checkout", async ({ page }) => {
    const live = new Set(
      seed.products
        .filter((p) => p.status === "live" && !p.badges.includes("sale"))
        .map((p) => p.id),
    );
    const variant = seed.variants.find(
      (v) => live.has(v.productId) && (v.stockByLocation.online ?? 0) >= 30 && v.price >= 3000,
    );
    if (!variant) throw new Error("No suitable seed variant");
    await page.addInitScript(
      (line) => {
        if (window.sessionStorage.getItem("e2e-bag-seeded")) return;
        window.sessionStorage.setItem("e2e-bag-seeded", "1");
        window.localStorage.setItem(
          "texora-bag",
          JSON.stringify({
            state: {
              lines: [{ ...line, quantity: 1, addedAt: Date.now() }],
              savedForLater: [],
              promoCodes: [],
              giftCardCode: null,
              rewardsValue: 0,
            },
            version: 2,
          }),
        );
      },
      { sku: variant.sku, productId: variant.productId },
    );

    await signIn(page, emailFor("loyalty_member"), "/account");
    await gotoReady(page, "/checkout");
    // The form fills in the member's email once checkout options load.
    await expect(page.getByRole("textbox", { name: "Email", exact: true })).toHaveValue(
      emailFor("loyalty_member"),
    );
    await page.getByRole("button", { name: "Continue to shipping" }).click();
    // Members may have saved addresses (the default is picked); otherwise fill one in.
    const newAddress = page.getByRole("radio", { name: "Use a new address" });
    await expect(page.getByRole("button", { name: "Continue to delivery" })).toBeVisible();
    if ((await newAddress.count()) === 0) {
      const field = (name: string) => page.getByRole("textbox", { name, exact: true });
      await field("First name").fill("Morgan");
      await field("Last name").fill("Member");
      await field("Address").fill("118 Greene Street");
      await field("City").fill("New York");
      await page.getByRole("combobox", { name: "State", exact: true }).selectOption("NY");
      await field("ZIP code").fill("10012");
      await field("Phone").fill("212 555 0100");
    } else if ((await page.getByRole("textbox", { name: "Phone", exact: true }).count()) > 0) {
      await page.getByRole("textbox", { name: "Phone", exact: true }).fill("212 555 0100");
    }
    await page.getByRole("button", { name: "Continue to delivery" }).click();
    await page.getByRole("button", { name: "Continue to payment" }).click();
    await page.getByText("Pay on delivery", { exact: true }).click();
    await page.getByRole("combobox", { name: /Use rewards/ }).selectOption("500");
    await page.getByRole("button", { name: "Review order" }).click();
    await expect(page.getByRole("definition").filter({ hasText: "−$5.00" })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole("button", { name: "Place order" }).click();
    await expect(page.getByRole("heading", { level: 1, name: /^Thank you/ })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole("term").filter({ hasText: "Rewards" }).first()).toBeVisible();
  });

  test("customer service refunds within their limit", async ({ page }) => {
    // The signed-in customer's delivered order: guest-flow tests use the guest's ones.
    const order = seed.orders.find(
      (o) =>
        o.status === "delivered" &&
        o.email === "customer@texora.test" &&
        o.payments.some((p) => p.status === "captured") &&
        o.totals.total >= 2000,
    );
    if (!order) throw new Error("No refundable seed order");
    await signIn(page, emailFor("customer_service"), "/admin");
    await gotoReady(page, `/admin/orders/${order.id}`);
    page.on("dialog", (d) => void d.accept());
    await page.getByRole("spinbutton", { name: "Amount ($)" }).fill("10");
    await page.getByRole("textbox", { name: "Reason" }).first().fill("Missing button");
    await page.getByRole("button", { name: "Refund", exact: true }).click();
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: /Refund/ })
        .first(),
    ).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(/Refunds above/)).toHaveCount(0);
  });

  test("a merchandiser publishes a draft product, which then goes live", async ({ page }) => {
    const draft = seed.products.find((p) => p.status === "draft");
    if (!draft) throw new Error("No draft seed product");
    await signIn(page, emailFor("merchandiser"), "/admin");
    await gotoReady(page, `/admin/catalog/${draft.id}`);
    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByRole("link", { name: /View on site/ })).toBeVisible({ timeout: 20_000 });
    // Put it back, so other tests see the seed as it was.
    page.on("dialog", (d) => void d.accept());
    await page.getByRole("button", { name: "Unpublish" }).click();
    await expect(page.getByRole("button", { name: "Publish" })).toBeVisible({ timeout: 20_000 });
  });
});

const ROLES_TO_CHECK: Role[] = [
  "customer",
  "loyalty_member",
  "customer_service",
  "merchandiser",
  "pricing_manager",
  "inventory_manager",
  "fulfillment",
  "vendor",
  "admin",
  "super_admin",
];
const ADMIN_ROUTES = ROUTE_PERMISSIONS.filter((r) => r.prefix.startsWith("/admin"));

test.describe("role-based access on every restricted route", () => {
  test.setTimeout(120_000);
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1440, "Access doesn't depend on viewport");

  for (const role of ROLES_TO_CHECK) {
    test(`${role}: allowed exactly where its permissions say`, async ({ page }) => {
      // Land on the home page: every role can open it.
      await signIn(page, emailFor(role), "/");
      for (const { prefix, permission } of ADMIN_ROUTES) {
        const response = await page.request.get(prefix, { maxRedirects: 0 });
        const allowed = hasPermission(role, "admin.access") && hasPermission(role, permission);
        if (allowed) {
          expect(response.status(), `${role} ${prefix}`).not.toBe(403);
          expect(response.status(), `${role} ${prefix}`).toBeLessThan(500);
        } else {
          expect(response.status(), `${role} ${prefix}`).toBe(403);
        }
      }
    });
  }
});
