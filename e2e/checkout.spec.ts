import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { generateSeed } from "../tests/fixtures/seed/generate";
import { asReturningVisitor, gotoReady } from "./support/helpers";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

// Deterministic seed: pick in-stock, full-price items (so WELCOME15 applies) once.
const seed = generateSeed();
const live = new Set(
  seed.products.filter((p) => p.status === "live" && !p.badges.includes("sale")).map((p) => p.id),
);
const variants = seed.variants.filter(
  (v) => live.has(v.productId) && (v.stockByLocation.online ?? 0) >= 30,
);

/** Puts items in the persisted bag before the page loads. */
async function withBag(
  page: Page,
  lines: Array<{ sku: string; productId: string; quantity: number }>,
) {
  await page.addInitScript((bagLines) => {
    // Init scripts run on every navigation: seed once, so the app's own changes stick.
    if (window.sessionStorage.getItem("e2e-bag-seeded")) return;
    window.sessionStorage.setItem("e2e-bag-seeded", "1");
    window.localStorage.setItem(
      "texora-bag",
      JSON.stringify({
        state: {
          lines: bagLines.map((l) => ({ ...l, addedAt: Date.now() })),
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

const line = (i: number, quantity = 1) => {
  const v = variants[i];
  if (!v) throw new Error("Not enough seed variants");
  return { sku: v.sku, productId: v.productId, quantity };
};

const address = async (page: Page) => {
  const field = (name: string) => page.getByRole("textbox", { name, exact: true });
  await field("First name").fill("Ada");
  await field("Last name").fill("Lovelace");
  await field("Address").fill("118 Greene Street");
  await page.getByRole("combobox", { name: "City or district" }).fill("Zamalek");
  await page.getByRole("combobox", { name: "Governorate", exact: true }).selectOption("C");
  await field("Postal code (optional)").fill("11211");
  await field("Phone").fill("010 1234 5678");
};

test.beforeEach(async ({ context, baseURL }) => {
  await asReturningVisitor(context, baseURL);
});

test("guest checkout with a promo code, paying on delivery", async ({ page }) => {
  await withBag(page, [line(0, 2), line(1)]);
  await gotoReady(page, "/bag");
  await expect(page.getByRole("heading", { level: 1, name: "Your bag" })).toBeVisible();
  const total = page
    .getByRole("region", { name: "Order summary" })
    .getByText(/^EGP.[\d,]+(\.\d{2})?$/)
    .last();
  await expect(total).toBeVisible();

  // Promo code: a bad code is explained, a good one applies.
  await page.getByLabel("Promo code").fill("NOTACODE");
  await page.getByRole("button", { name: "Apply" }).first().click();
  await expect(page.getByText("We don't recognise that code")).toBeVisible();
  await page.getByRole("button", { name: "Remove code NOTACODE" }).click();
  await page.getByLabel("Promo code").fill("welcome15");
  await page.getByRole("button", { name: "Apply" }).first().click();
  await expect(page.getByText("15% off your first order", { exact: false }).first()).toBeVisible();

  await page.getByRole("link", { name: "Checkout" }).first().click();
  await expect(page).toHaveURL(/\/checkout$/);
  await page.waitForSelector("html[data-hydrated]", { state: "attached" });
  await page.getByRole("textbox", { name: "Email", exact: true }).fill("ada@example.com");
  await page.getByRole("button", { name: "Continue to shipping" }).click();

  await expect(page).toHaveURL(/\/checkout\/shipping$/);
  // Validation runs inline, using the server's schema.
  await page.getByRole("button", { name: "Continue to delivery" }).click();
  await expect(page.getByText("Enter a first name")).toBeVisible();
  await address(page);
  // Address check: an area from another governorate, or its postal code, is caught.
  const city = page.getByRole("combobox", { name: "City or district" });
  await city.fill("Smouha");
  await page.getByRole("textbox", { name: "Postal code (optional)", exact: true }).fill("21500");
  await page.getByRole("button", { name: "Continue to delivery" }).click();
  await expect(
    page.getByText("Smouha is in Alexandria, not Cairo. Check the city or choose Alexandria."),
  ).toBeVisible();
  await expect(
    page.getByText("21500 is a postal code for Alexandria. Check it, or leave it empty."),
  ).toBeVisible();
  await city.fill("Zamalek");
  await page.getByRole("textbox", { name: "Postal code (optional)", exact: true }).fill("11211");
  await page.getByRole("button", { name: "Continue to delivery" }).click();

  await expect(page).toHaveURL(/\/checkout\/delivery$/);
  await page.getByText("Express", { exact: true }).click();
  await page.getByText("Standard", { exact: true }).click();
  await page.getByRole("button", { name: "Continue to payment" }).click();

  await expect(page).toHaveURL(/\/checkout\/payment$/);
  await page.getByText("Pay on delivery", { exact: true }).click();
  await page.getByRole("button", { name: "Review order" }).click();

  await expect(page).toHaveURL(/\/checkout\/review$/);
  await expect(page.getByText("ada@example.com")).toBeVisible();
  await page.getByRole("button", { name: "Place order" }).click();

  await expect(page).toHaveURL(/\/order-confirmation\/[^?]+\?t=/);
  await expect(page.getByRole("heading", { level: 1, name: "Thank you, Ada" })).toBeVisible();
  await expect(page.getByText(/Your order number is TX-\d{6}/)).toBeVisible();
  await expect(page.getByText("Discounts")).toBeVisible();
  // The bag is emptied after a successful order.
  await gotoReady(page, "/bag");
  await expect(page.getByRole("heading", { name: "Your bag is empty" })).toBeVisible();
});

test("changing quantity re-prices the bag", async ({ page }) => {
  await withBag(page, [line(2)]);
  await gotoReady(page, "/bag");
  const summary = page.getByRole("region", { name: "Order summary" });
  await expect(summary.getByText("Subtotal (1 item)")).toBeVisible();
  await page.getByRole("button", { name: "Increase quantity" }).first().click();
  await expect(summary.getByText("Subtotal (2 items)")).toBeVisible();
});

test("save for later moves an item out of the bag", async ({ page }) => {
  await withBag(page, [line(3), line(4)]);
  await gotoReady(page, "/bag");
  await page.getByRole("button", { name: "Save for later" }).first().click();
  await expect(page.getByRole("heading", { name: "Saved for later (1)" })).toBeVisible();
  await page.getByRole("button", { name: "Move to bag" }).click();
  await expect(page.getByRole("heading", { name: /Saved for later/ })).toBeHidden();
});

test("checkout steps guard against skipping ahead", async ({ page }) => {
  await withBag(page, [line(5)]);
  await gotoReady(page, "/checkout/review");
  await expect(page).toHaveURL(/\/checkout$/);
});

test("checkout redirects an empty bag to the bag page", async ({ page }) => {
  await gotoReady(page, "/checkout/shipping");
  await expect(page).toHaveURL(/\/bag$/);
});

test("a confirmation page without its access token is not found", async ({ page }) => {
  const response = await page.goto("/order-confirmation/not-a-real-order?t=forged");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("We can't find that page");
  expect([200, 404]).toContain(response?.status());
});

test.describe("accessibility", () => {
  for (const path of ["/bag", "/checkout", "/checkout/shipping"]) {
    test(`${path} has no axe violations`, async ({ page }) => {
      await withBag(page, [line(6)]);
      if (path === "/checkout/shipping") {
        await page.addInitScript(() =>
          window.sessionStorage.setItem(
            "texora-checkout",
            JSON.stringify({
              state: {
                email: "a@example.com",
                shippingAddress: null,
                delivery: null,
                billingSameAsShipping: true,
                billingAddress: null,
                paymentMethod: null,
                marketingOptIn: false,
                idempotencyKey: "chk-axe-0000000000000",
              },
              version: 1,
            }),
          ),
        );
      }
      await gotoReady(page, path);
      // Stripe keeps background requests open, so "networkidle" isn't reliable here.
      await page.waitForLoadState("load");
      const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
      expect(results.violations).toEqual([]);
    });
  }
});
