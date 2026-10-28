/**
 * Renders a sample of every email with made-up data, to check how they look.
 * Always writes HTML previews to .email-previews/ (open index.html in a
 * browser). With an address and RESEND_API_KEY set, it also sends each one
 * through Resend so you can see them in a real inbox. Nothing is written to
 * Firestore.
 *
 *   npm run email:samples                     previews only
 *   npm run email:samples -- you@example.com  previews, and send to that inbox
 *
 * Uses RESEND_API_KEY, EMAIL_FROM and NEXT_PUBLIC_SITE_URL from .env.local.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadEnvConfig } from "@next/env";
import type { ReactElement } from "react";

async function main() {
  loadEnvConfig(process.cwd());
  const to = process.argv[2]?.trim();
  if (to && !to.includes("@")) throw new Error("Usage: npm run email:samples -- you@example.com");

  // Imported after the env is loaded: the templates read the site URL.
  const { render } = await import("@react-email/render");
  const { Resend } = await import("resend");
  const t = {
    ...(await import("../src/lib/email/templates/CustomerAccount")),
    ...(await import("../src/lib/email/templates/GiftCard")),
    ...(await import("../src/lib/email/templates/MerchantAccount")),
    ...(await import("../src/lib/email/templates/MerchantOrder")),
    ...(await import("../src/lib/email/templates/MerchantProduct")),
    ...(await import("../src/lib/email/templates/MerchantShop")),
    ...(await import("../src/lib/email/templates/OrderConfirmation")),
    ...(await import("../src/lib/email/templates/ProductAlert")),
    ...(await import("../src/lib/email/templates/ReturnInstructions")),
    ...(await import("../src/lib/email/templates/StaffInvite")),
  };

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const url = (path: string) => new URL(path, site).toString();
  const brandName = "Texora";
  const image = url("/media/hero/texora-hero-walk-poster.jpg");

  const samples: Array<[string, string, ReactElement]> = [
    [
      "order-confirmation",
      "Thank you for your order TX-10482",
      t.OrderConfirmationEmail({
        brandName,
        orderNumber: "TX-10482",
        firstName: "Nour",
        orderUrl: url("/account/orders"),
        lines: [
          { name: "Linen overshirt", detail: "Olive · M", quantity: 1, lineTotal: 189_000 },
          { name: "Pleated wide trousers", detail: "Sand · 32", quantity: 1, lineTotal: 145_000 },
        ],
        totals: {
          subtotal: 334_000,
          discount: 0,
          shipping: 0,
          tax: 41_018,
          giftCard: 0,
          rewards: 0,
          total: 334_000,
        },
        delivery: "Standard delivery to Zamalek, Cairo · 2–4 business days",
        paymentNote: "Card ending 4242",
      }),
    ],
    [
      "welcome",
      "Welcome to Texora",
      t.CustomerWelcomeEmail({ brandName, firstName: "Nour", rewards: true, link: url("/") }),
    ],
    [
      "password-reset",
      "Reset your Texora password",
      t.CustomerPasswordResetEmail({ brandName, link: url("/auth/signin") }),
    ],
    [
      "shipped",
      "Part of your order is on the way",
      t.MerchantShippedEmail({
        brandName,
        orderNumber: "TX-10482",
        carrier: "Bosta",
        trackingNumber: "BST-889201",
        link: url("/orders/lookup"),
      }),
    ],
    [
      "gift-card",
      "Karim sent you a Texora gift card",
      t.GiftCardEmail({
        brandName,
        recipientName: "Nour",
        senderName: "Karim",
        message: "Happy birthday. Something considered, for you.",
        amount: 100_000,
        code: "TXGC-4F7Q-9KD2",
        expiresOn: "27 October 2031",
        shopUrl: url("/"),
      }),
    ],
    [
      "gift-card-receipt",
      "Your gift card is on its way",
      t.GiftCardReceiptEmail({
        brandName,
        amount: 100_000,
        recipientName: "Nour",
        recipientEmail: "nour@example.com",
        deliverOn: "1 November 2026",
        statusUrl: url("/account"),
      }),
    ],
    [
      "back-in-stock",
      "Back in stock: Linen overshirt",
      t.ProductAlertEmail({
        brandName,
        kind: "back_in_stock",
        productName: "Linen overshirt",
        productUrl: url("/"),
        imageUrl: image,
        size: "M",
        unsubscribeUrl: url("/account"),
      }),
    ],
    [
      "price-drop",
      "Price drop: Pleated wide trousers",
      t.ProductAlertEmail({
        brandName,
        kind: "price_drop",
        productName: "Pleated wide trousers",
        productUrl: url("/"),
        imageUrl: image,
        oldPrice: 145_000,
        newPrice: 116_000,
        unsubscribeUrl: url("/account"),
      }),
    ],
    [
      "return-instructions",
      "Your return RT-2201",
      t.ReturnInstructionsEmail({
        brandName,
        returnNumber: "RT-2201",
        orderNumber: "TX-10482",
        returnUrl: url("/account/orders"),
        method: "mail",
        qrImageUrl: url("/apple-icon.png"),
        lines: [{ name: "Linen overshirt", detail: "Olive · M", quantity: 1 }],
        refundEstimate: 189_000,
        refundTo: "original",
        deadline: "26 November 2026",
      }),
    ],
    [
      "merchant-verify",
      "Confirm your email",
      t.MerchantVerifyEmail({ brandName, username: "atelier-nour", link: url("/merchant") }),
    ],
    [
      "merchant-password-reset",
      "Reset your merchant password",
      t.MerchantPasswordResetEmail({ brandName, link: url("/merchant/sign-in") }),
    ],
    [
      "merchant-new-order",
      "New order TX-10482",
      t.MerchantNewOrderEmail({
        brandName,
        orderNumber: "TX-10482",
        lines: [{ name: "Linen overshirt", detail: "Olive · M · Qty 1" }],
        link: url("/merchant"),
      }),
    ],
    [
      "merchant-shop-submitted",
      "We received your shop",
      t.ShopSubmittedEmail({ brandName, shopName: "Atelier Nour", link: url("/merchant") }),
    ],
    [
      "merchant-shop-approved",
      "Your shop is approved",
      t.ShopDecisionEmail({
        brandName,
        shopName: "Atelier Nour",
        decision: "approved",
        reasons: [],
        link: url("/merchant"),
      }),
    ],
    [
      "merchant-product-changes",
      "Changes needed: Linen overshirt",
      t.ProductDecisionEmail({
        brandName,
        productName: "Linen overshirt",
        decision: "changes_requested",
        reasons: ["Add a photo of the back", "Fabric composition is missing"],
        link: url("/merchant"),
      }),
    ],
    [
      "staff-shop-review",
      "Shop waiting for review",
      t.ShopReviewRequestEmail({
        brandName,
        shopName: "Atelier Nour",
        merchantEmail: "merchant@example.com",
        link: url("/admin/merchants"),
      }),
    ],
    [
      "staff-product-review",
      "Product waiting for review",
      t.ProductReviewRequestEmail({
        brandName,
        productName: "Linen overshirt",
        shopName: "Atelier Nour",
        link: url("/admin/merchants"),
      }),
    ],
    [
      "staff-invite",
      "You are invited to the Texora back office",
      t.StaffInviteEmail({
        brandName,
        name: "Nour",
        role: "Customer service",
        link: url("/admin/sign-in"),
      }),
    ],
  ];

  const dir = join(process.cwd(), ".email-previews");
  mkdirSync(dir, { recursive: true });
  const key = process.env.RESEND_API_KEY;
  const resend = to && key ? new Resend(key) : null;
  const from = process.env.EMAIL_FROM ?? "Texora <onboarding@resend.dev>";
  if (to && !key) console.log("RESEND_API_KEY is not set in .env.local: writing previews only.");

  const index: string[] = [];
  for (const [name, subject, template] of samples) {
    const [html, text] = await Promise.all([
      render(template),
      render(template, { plainText: true }),
    ]);
    writeFileSync(join(dir, `${name}.html`), html);
    index.push(`<li><a href="${name}.html">${subject}</a></li>`);
    if (!resend || !to) continue;
    const { error } = await resend.emails.send({
      from,
      to,
      subject: `[Sample] ${subject}`,
      html,
      text,
    });
    console.log(error ? `  ✗ ${name}: ${error.message}` : `  ✓ sent ${name}`);
    // Resend allows a few requests a second.
    await new Promise((r) => setTimeout(r, 600));
  }
  writeFileSync(
    join(dir, "index.html"),
    `<!doctype html><meta charset="utf-8"><title>Email samples</title><ul>${index.join("")}</ul>`,
  );
  console.log(`\n${samples.length} previews in ${join(dir, "index.html")}`);
  if (resend) console.log(`Sent to ${to} from ${from}.`);
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
