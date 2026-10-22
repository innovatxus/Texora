import { expect, type BrowserContext, type Page } from "@playwright/test";
import { gotoReady } from "./helpers";
import { latestEmail, linkIn } from "./outbox";

export const MERCHANT_PASSWORD = "violet-harbour-stitch-42";

/** Each test is its own visitor behind the hosting proxy, so per-IP limits don't collide. */
export async function asSeparateVisitor(context: BrowserContext) {
  const octet = () => Math.floor(Math.random() * 254) + 1;
  await context.setExtraHTTPHeaders({ "x-forwarded-for": `198.51.${octet()}.${octet()}` });
}

/** A unique merchant per test and viewport (fixed length, for stable screenshots). */
export function newMerchant(testInfo: { project: { name: string } }) {
  const tag = `${testInfo.project.name.slice(0, 3)}${Date.now().toString(36)}${String(Math.floor(Math.random() * 1e4)).padStart(4, "0")}`;
  return { email: `m-${tag}@example.com`, username: `m${tag}` };
}

/** Registers through the UI and waits for the portal. */
export async function registerMerchant(
  page: Page,
  email: string,
  username: string,
  password = MERCHANT_PASSWORD,
) {
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

/** Opens the emailed verification link. */
export async function verifyEmail(page: Page, email: string) {
  const mail = await latestEmail(email, "merchant_verify_email");
  await gotoReady(page, linkIn(mail.html, "/merchant/verify-email"));
  await expect(page.getByText("Email verified. You can now submit your shop.")).toBeVisible();
}

/**
 * Registers a merchant and sets up the minimum shop through the UI (basics
 * and one ship-from location), returning the shop name.
 */
export async function merchantWithShop(page: Page, testInfo: { project: { name: string } }) {
  const { email, username } = newMerchant(testInfo);
  await registerMerchant(page, email, username);
  await gotoReady(page, "/merchant/onboarding/basics");
  const shopName = `Shop ${username}`;
  await page.getByRole("textbox", { name: "Shop name" }).fill(shopName);
  await expect(page.getByText("Available", { exact: true })).toBeVisible();
  await page.getByRole("checkbox", { name: "Women" }).check();
  await page.getByRole("checkbox", { name: "Dresses" }).check();
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(page).toHaveURL((u) => u.pathname === "/merchant/onboarding/branding", {
    timeout: 30_000,
  });
  await gotoReady(page, "/merchant/onboarding/locations");
  await page.getByRole("textbox", { name: "Location name" }).fill("Warehouse");
  await page.getByRole("textbox", { name: "Street address" }).fill("1 Dock Rd");
  await page.getByRole("textbox", { name: "City" }).fill("Portland");
  await page.getByRole("combobox", { name: "State" }).selectOption("OR");
  await page.getByRole("textbox", { name: "ZIP code" }).fill("97201");
  await page.getByRole("button", { name: "Add location" }).click();
  await expect(page.getByText("Location added.")).toBeVisible({ timeout: 30_000 });
  return { email, username, shopName };
}

async function png(name: string, width: number, height: number, colour: string) {
  const { default: sharp } = await import("sharp");
  const buffer = await sharp({ create: { width, height, channels: 3, background: colour } })
    .png()
    .toBuffer();
  return { name, mimeType: "image/png", buffer };
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

/**
 * The whole merchant onboarding through the UI: register, verify, basics,
 * branding (real uploads), a retail + ship-from location, submit for review.
 */
export async function onboardSubmittedShop(page: Page, testInfo: { project: { name: string } }) {
  const { email, username } = newMerchant(testInfo);
  await registerMerchant(page, email, username);
  await verifyEmail(page, email);
  const shopName = `Atelier ${username}`;
  await gotoReady(page, "/merchant/onboarding/basics");
  await page.getByRole("textbox", { name: "Shop name" }).fill(shopName);
  await expect(page.getByText("Available", { exact: true })).toBeVisible();
  await page.getByRole("textbox", { name: "Tagline" }).fill("Linen for warm days");
  await page.getByRole("checkbox", { name: "Women" }).check();
  await page.getByRole("checkbox", { name: "Dresses" }).check();
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(page).toHaveURL((u) => u.pathname === "/merchant/onboarding/branding", {
    timeout: 30_000,
  });
  await page.waitForSelector("html[data-hydrated]", { state: "attached" });
  await uploadAndCrop(page, 0, await png("logo.png", 800, 800, "#1f2a44"), "Crop your logo");
  await expect(page.getByText("Avatar")).toBeVisible({ timeout: 30_000 });
  await uploadAndCrop(page, 1, await png("banner.png", 2700, 900, "#3d5a3a"), "Crop your banner");
  await expect(page.getByText("Desktop", { exact: true })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(page).toHaveURL((u) => u.pathname === "/merchant/onboarding/contact", {
    timeout: 30_000,
  });
  await page.waitForSelector("html[data-hydrated]", { state: "attached" });
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(page).toHaveURL((u) => u.pathname === "/merchant/onboarding/locations", {
    timeout: 30_000,
  });
  await page.waitForSelector("html[data-hydrated]", { state: "attached" });
  await page.getByRole("textbox", { name: "Location name" }).fill("Mercer Street studio");
  await page.getByRole("checkbox", { name: /Retail store/ }).check();
  await page.getByRole("textbox", { name: "Street address" }).fill("12 Mercer St");
  await page.getByRole("textbox", { name: "City" }).fill("New York");
  await page.getByRole("combobox", { name: "State" }).selectOption("NY");
  await page.getByRole("textbox", { name: "ZIP code" }).fill("10013");
  await page.getByRole("checkbox", { name: "Monday" }).check();
  await page.getByRole("button", { name: "Copy Monday to all days" }).click();
  await page.getByRole("button", { name: "Add location" }).click();
  await expect(page.getByText("Location added.")).toBeVisible({ timeout: 30_000 });
  await gotoReady(page, "/merchant/onboarding/review");
  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(page).toHaveURL((u) => u.pathname === "/merchant", { timeout: 30_000 });
  const shopSlug = shopName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return { email, username, shopName, shopSlug, png };
}

/** Signs in to the back office as a seeded staff account (separate browser context). */
export async function staffSignIn(page: Page, email: string) {
  await gotoReady(page, "/auth/signin?next=%2Fadmin");
  await page.getByRole("textbox", { name: "Email", exact: true }).fill(email);
  await page.getByLabel("Password", { exact: false }).fill("Texora-demo-1");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL((u) => u.pathname === "/admin", { timeout: 30_000 });
  await page.waitForSelector("html[data-hydrated]", { state: "attached" });
}
