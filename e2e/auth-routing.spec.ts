import { expect, test } from "@playwright/test";

const PROTECTED = ["/account", "/account/orders", "/admin", "/admin/audit"] as const;

test.describe("protected routes (signed out)", () => {
  for (const path of PROTECTED) {
    test(`${path} redirects to sign-in with a return path`, async ({ request }) => {
      const response = await request.get(`${path}?tab=1`, { maxRedirects: 0 });
      expect(response.status()).toBe(307);
      const location = new URL(response.headers()["location"] ?? "", "http://localhost");
      expect(location.pathname).toBe("/auth/signin");
      expect(location.searchParams.get("next")).toBe(`${path}?tab=1`);
    });
  }

  test("public routes are not gated", async ({ request }) => {
    const response = await request.get("/", { maxRedirects: 0 });
    expect(response.status()).toBe(200);
  });
});

test("a forged session cookie is rejected and cleared", async ({ request, baseURL }) => {
  const response = await request.get("/admin", {
    maxRedirects: 0,
    headers: { cookie: "__session=forged.token.value" },
  });
  expect(response.status()).toBe(307);
  expect(new URL(response.headers()["location"] ?? "", baseURL).pathname).toBe("/auth/signin");
  expect(response.headers()["set-cookie"] ?? "").toMatch(/__session=;/);
});

test("the access-denied page is a branded 403 template", async ({ page }) => {
  await page.goto("/access-denied");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "You don't have access to this page",
  );
  const response = await page.goto("/access-denied");
  expect(response?.status()).toBe(403);
  await expect(page.locator('meta[name="robots"]')).toHaveCount(1);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});
