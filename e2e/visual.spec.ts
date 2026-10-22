import { expect, test, type Page } from "@playwright/test";
import { generateSeed } from "../tests/fixtures/seed/generate";
import { asReturningVisitor, gotoReady } from "./support/helpers";

// Visual baselines for every storefront and back-office template at 375, 768,
// 1024 and 1440 (spec Phase 10). Run with `npm run e2e:visual`; refresh with
// `npm run e2e:visual:update` after an intended design change.

const seed = generateSeed();
const product = seed.products.find((p) => p.slug === "linen-camp-collar-shirt-men");
// An order no other test changes (refunds, returns and notes use the others).
const order = seed.orders.find((o) => o.status === "placed");

test.beforeEach(async ({ context, baseURL }) => {
  await asReturningVisitor(context, baseURL);
});

/** Masks for anything that changes between runs: dates, counts, live chrome. */
function masks(page: Page) {
  return [
    page.locator("time"),
    page.locator("[data-dynamic]"),
    page.getByRole("region", { name: /announcement/i }),
    // Seeded dates are relative to the day the suite runs.
    page.getByText(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2}/),
  ];
}

async function shot(
  page: Page,
  path: string,
  name: string,
  { waitFor, timestamps = false }: { waitFor?: string; timestamps?: boolean } = {},
) {
  await gotoReady(page, path);
  if (waitFor) await page.waitForSelector(waitFor, { state: "attached" });
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveScreenshot(`${name}.png`, {
    mask: masks(page),
    fullPage: false,
    // Seeded times of day vary per run, so masked timestamps change width slightly.
    ...(timestamps ? { maxDiffPixelRatio: 0.005 } : {}),
  });
}

const TEMPLATES: Array<{ name: string; path: () => string; waitFor?: string }> = [
  { name: "home", path: () => "/" },
  { name: "department", path: () => "/women" },
  { name: "category", path: () => "/women/dresses" },
  { name: "collection", path: () => "/collections/the-linen-edit" },
  { name: "sale", path: () => "/sale" },
  { name: "search", path: () => "/search?q=linen" },
  {
    name: "product",
    path: () => `/product/${product?.slug ?? ""}`,
    waitFor: "[data-interactive]",
  },
  { name: "bag-empty", path: () => "/bag" },
  { name: "stores", path: () => "/stores" },
  { name: "help", path: () => "/help" },
  { name: "gift-cards", path: () => "/gift-cards" },
  { name: "order-lookup", path: () => "/orders/lookup" },
  { name: "merchants", path: () => "/merchants" },
  { name: "sign-in", path: () => "/auth/signin" },
  { name: "register", path: () => "/auth/register" },
  { name: "wishlist-empty", path: () => "/account/wishlist" },
  { name: "not-found", path: () => "/this-page-does-not-exist" },
];

test.describe("storefront templates", () => {
  for (const t of TEMPLATES) {
    test(`${t.name} @visual`, async ({ page }) => {
      await shot(page, t.path(), t.name, t.waitFor ? { waitFor: t.waitFor } : {});
    });
  }
});

test.describe("signed-in templates", () => {
  async function signIn(page: Page, email: string, next: string) {
    await gotoReady(page, `/auth/signin?next=${encodeURIComponent(next)}`);
    await page.getByRole("textbox", { name: "Email", exact: true }).fill(email);
    await page.getByRole("textbox", { name: "Password", exact: true }).fill("Texora-demo-1");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL((u) => u.pathname === next, { timeout: 30_000 });
  }

  test("account overview @visual", async ({ page }) => {
    await signIn(page, "loyalty-member@texora.test", "/account");
    await shot(page, "/account/rewards", "account-rewards", { timestamps: true });
  });

  test("back office @visual", async ({ page }) => {
    test.skip(!order, "Seed has orders");
    await signIn(page, "admin@texora.test", "/admin");
    await shot(page, "/admin/catalog", "admin-catalog", { timestamps: true });
    await shot(page, `/admin/orders/${order?.id ?? ""}`, "admin-order", { timestamps: true });
  });
});
