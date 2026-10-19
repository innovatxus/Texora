import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { asReturningVisitor, gotoReady as gotoHydrated } from "./support/helpers";

/** The buy box is its own Suspense boundary and hydrates after the root. */
async function gotoReady(page: Page, path: string) {
  const response = await gotoHydrated(page, path);
  if (path.startsWith("/product/"))
    await page.waitForSelector("[data-interactive]", { state: "attached" });
  return response;
}

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const PRODUCT = "/product/linen-camp-collar-shirt-men";

test.beforeEach(async ({ context, baseURL }) => {
  await asReturningVisitor(context, baseURL);
});

const sizeGroup = (page: Page) => page.getByRole("group", { name: /^Size/ });

test("product page has no axe violations", async ({ page }) => {
  await gotoReady(page, PRODUCT);
  await expect(
    page.getByRole("heading", { level: 1, name: "Linen Camp-Collar Shirt" }),
  ).toBeVisible();
  await page.waitForLoadState("networkidle");
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  expect(results.violations).toEqual([]);
});

test("publishes Product structured data", async ({ page }) => {
  await gotoReady(page, PRODUCT);
  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
  const product = blocks
    .map((b) => JSON.parse(b) as { "@type": string })
    .find((b) => b["@type"] === "Product") as
    { name: string; offers: { "@type": string; lowPrice: string } } | undefined;
  expect(product?.name).toBe("Linen Camp-Collar Shirt");
  expect(product?.offers["@type"]).toBe("AggregateOffer");
  expect(Number(product?.offers.lowPrice)).toBeGreaterThan(0);
});

test("choosing a colour updates the URL and selection", async ({ page }) => {
  await gotoReady(page, PRODUCT);
  await page
    .getByRole("group", { name: /^Colour/ })
    .locator("label")
    .nth(1)
    .click();
  await expect(page).toHaveURL(/\?color=/);
  const code = new URL(page.url()).searchParams.get("color");
  await page.reload();
  await expect(
    page
      .getByRole("group", { name: /^Colour/ })
      .getByRole("radio")
      .nth(1),
  ).toBeChecked();
  expect(code).toBeTruthy();
});

test("add to bag asks for a size, then adds and opens the bag", async ({ page }) => {
  await gotoReady(page, PRODUCT);
  await page.getByRole("button", { name: "Add to bag", exact: true }).first().click();
  await expect(sizeGroup(page).getByRole("alert")).toHaveText(
    "Select a size to add this to your bag",
  );

  await sizeGroup(page).locator("label").filter({ hasNotText: "out of stock" }).first().click();
  await page.getByRole("button", { name: "Add to bag", exact: true }).first().click();
  await expect(
    page.getByRole("dialog", { name: /^Bag/ }).getByText("Added to your bag"),
  ).toBeVisible();
});

test("an out-of-stock size offers a back-in-stock alert", async ({ page }) => {
  await gotoReady(page, "/women");
  // Find a product and colour with a sold-out size.
  const links = await page
    .getByRole("article")
    .getByRole("link")
    .evaluateAll((els) =>
      [...new Set(els.map((e) => (e as HTMLAnchorElement).pathname))].filter((p) =>
        p.startsWith("/product/"),
      ),
    );
  for (const path of links) {
    await gotoReady(page, path);
    const colours = page.getByRole("group", { name: /^Colour/ }).locator("label");
    const count = await colours.count();
    for (let i = 0; i < count; i++) {
      await colours.nth(i).click();
      const soldOut = sizeGroup(page).locator("label").filter({ hasText: "out of stock" });
      if ((await soldOut.count()) > 0) {
        await soldOut.first().click();
        await expect(page.getByRole("button", { name: "Out of stock" }).first()).toBeDisabled();
        const form = page.locator("form", { has: page.getByRole("button", { name: "Notify me" }) });
        await form.getByLabel("Email address").fill("shopper@example.com");
        await form.getByRole("button", { name: "Notify me" }).click();
        await expect(page.getByText(/We'll email you when size/)).toBeVisible();
        return;
      }
    }
  }
  throw new Error("No sold-out size found in the women's catalogue");
});

test("size guide opens with measurements", async ({ page }) => {
  await gotoReady(page, PRODUCT);
  await page.getByRole("button", { name: "Size guide" }).click();
  const dialog = page.getByRole("dialog", { name: "Size guide" });
  await expect(dialog.getByRole("table")).toBeVisible();
  await expect(dialog.getByRole("rowheader", { name: "M" })).toBeVisible();
});

test("zoom viewer pages with arrow keys and returns focus", async ({ page }) => {
  await gotoReady(page, PRODUCT);
  const trigger = page.getByRole("button", { name: /^Zoom image 1 of/ }).locator("visible=true");
  await trigger.click();
  const viewer = page.getByRole("dialog");
  await expect(viewer).toContainText("1 / 3");
  await page.keyboard.press("ArrowRight");
  await expect(viewer).toContainText("2 / 3");
  await page.keyboard.press("Escape");
  await expect(viewer).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("reviews filter by rating and accept a helpful vote", async ({ page }) => {
  await gotoReady(page, PRODUCT);
  const reviews = page.locator("#reviews");
  const total = page.locator("#reviews").getByText(/^\d+ reviews?$/);
  const before = Number((await total.textContent())?.split(" ")[0]);
  await reviews.getByRole("button", { name: /^5 star/ }).click();
  const after = Number((await total.textContent())?.split(" ")[0]);
  expect(after).toBeLessThan(before);

  const helpful = reviews.getByRole("button", { name: /^Helpful\?/ }).first();
  const votes = Number((await helpful.textContent())?.match(/\((\d+)\)/)?.[1]);
  await helpful.click();
  await expect(
    reviews.getByRole("button", { name: /^Thanks for your feedback/ }).first(),
  ).toContainText(`(${votes + 1})`);
});

test("guests are asked to sign in to write a review", async ({ page }) => {
  await gotoReady(page, PRODUCT);
  await page.getByRole("button", { name: "Write a review" }).click();
  const dialog = page.getByRole("dialog", { name: "Write a review" });
  await dialog.locator("label").filter({ hasText: "5 stars" }).click();
  await dialog.getByLabel("Title").fill("Lovely shirt");
  await dialog.getByLabel("Review").fill("Soft linen that keeps its shape after washing.");
  await dialog.getByRole("button", { name: "Submit review" }).click();
  await expect(dialog.getByRole("link", { name: "Sign in to write a review" })).toBeVisible();
});

test("an unknown product shows the not-found page and is not indexed", async ({ page }) => {
  await gotoHydrated(page, "/product/does-not-exist");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("We can't find that page");
  await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);
});
