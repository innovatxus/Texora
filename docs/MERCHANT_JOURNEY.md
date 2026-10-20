# Merchant journey

The screen-by-screen flow for Texora merchants, from the footer link to a live product and its first order. Every screen lists its states and the exact copy. The implementation follows this document. If they disagree, this document is updated first.

Conventions:

- **Voice.** Plain, specific and friendly; second person; no system-speak. Say "Merchant" in the UI, never "vendor".
- **States.** Each screen covers six:
  - **Empty:** first use, with a next action.
  - **Loading:** a skeleton that matches the final layout.
  - **Validation error:** inline on blur. On submit, a summary at the top with focus on the first error. Never a toast alone.
  - **Server error:** a retryable banner. Typed input is kept.
  - **Success:** a polite `aria-live` status.
  - **Permission denied:** a 403 page for the signed-in wrong role; signed-out visitors are redirected to sign-in.
- **Shared copy.**
  - Server error: "Something went wrong on our side. Your changes are safe — try again."
  - Rate limited: "Too many attempts. Wait a minute and try again."
  - Offline: "You're offline. We'll save when you're back."

## Flow map

```
Footer "Sell on Texora" ─▶ /merchants (landing) ─▶ "Open your shop"
                                                     │
                     ┌──── signed-in customer ───────┤
                     ▼                               ▼
         /merchant/register (upgrade)      /merchant/register (new account)
                     └───────────────┬───────────────┘
                                     ▼
                        /merchant/onboarding/basics
                        → branding → contact → locations → review
                                     │ submit (needs verified email)
                                     ▼
              /merchant (dashboard: "Your shop is in review")
                 │                                   ▲
   admin approves│   admin requests changes ─────────┘ (edit → resubmit)
                 ▼
   /merchant/products/new ─▶ editor (autosave) ─▶ submit for review / publish
                 │                                   │
                 ▼                                   ▼
   admin product queue ─▶ live ─▶ PLP · search · /shops/[slug] · PDP "Sold by"
                                     │
                                     ▼
                       shopper buys ─▶ /merchant/orders ─▶ mark shipped
```

Footer "Merchant sign in" goes to `/merchant/sign-in` and then to `/merchant`, or to the onboarding step where the merchant left off. Footer "Merchant help" goes to `/help/merchants`.

---

## 1. Landing — `/merchants` (public, static)

| Section      | Content                                                                                                                                                                                                                                                               |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hero         | **Sell on Texora.** "Reach shoppers across the US with a shop page that looks as good as your clothes." Primary CTA **Open your shop** → `/merchant/register`. Secondary text link "Already selling? Sign in"                                                         |
| How it works | 1 **Register** — "Create your merchant account in two minutes." 2 **Build your shop** — "Add your logo, banner, locations and policies." 3 **List products** — "Add colours, fits and sizes; we handle the storefront."                                               |
| What you get | Shop page with your branding · nationwide reach · listings in search and filters · sales and stock at a glance                                                                                                                                                        |
| Fees         | From `src/config/merchant.ts`: commission rate, no monthly fee, payout timing note ("Payouts are arranged with our team while self-serve payouts are being built"), requirements (US business, ships within the stated processing time, original or authorised goods) |
| FAQ          | Accordion from config: approval time, what you can sell, shipping, returns, fees, closing your shop                                                                                                                                                                   |
| Final CTA    | "Ready when you are." **Open your shop**                                                                                                                                                                                                                              |

States: static content only. No loading or error states. The CTA is the single primary button in each viewport.

## 2. Register — `/merchant/register`

**Signed out.** Fields:

| Field            | Hint                                                                                                 | Errors                                                                                                                                                                                                |
| ---------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Email            | "We'll send a verification link here."                                                               | "Enter an email address like name@example.com" · "An account with this email already exists. [Sign in](/merchant/sign-in) to add a shop to it."                                                       |
| Username         | "3–30 characters: lowercase letters, numbers, dots, dashes or underscores. You can sign in with it." | "Use 3 to 30 characters" · "Start and end with a letter or number" · "Use lowercase letters, numbers, dots, dashes or underscores" · "That name is reserved — try another" · "That username is taken" |
| Password         | "At least 12 characters. A short phrase is easiest to remember."                                     | "Use at least 12 characters" · "That password is too common — try a phrase only you would use" · "Add a few more words or characters to make it stronger"                                             |
| Confirm password | —                                                                                                    | "The passwords don't match"                                                                                                                                                                           |
| Terms checkbox   | "I agree to the [Merchant terms](/help/merchants/terms)."                                            | "Accept the merchant terms to continue"                                                                                                                                                               |

- **Availability check.** It runs 300ms after typing stops, with `aria-live="polite"`:
  - "Checking…"
  - "✓ {username} is available"
  - "That username is taken"
- **Strength meter.** Four bars with labels "Too weak" / "Weak" / "Good" / "Strong". It uses `aria-live` and is never shown by colour alone.
- **Show/hide toggle.** "Show password" / "Hide password", with `aria-pressed`.
- **Submit.** **Create merchant account**. While working: "Creating your account…".
- **Success.** Redirect to `/merchant/onboarding/basics`, where a banner says: "Account created. We sent a verification link to {email}."
- **Server error.** Shared copy. The account is rolled back, so retrying works.
- **Rate limited.** Shared copy.

**Signed in as a customer (upgrade).** The heading is "Add a shop to your account". Email is shown read-only ("Signed in as {email}"). The fields are username and terms only.

- Submit: **Become a merchant**.
- Success: "Your account can now sell on Texora." Then redirect to onboarding. The session is re-minted with the new role.

**Signed in as a merchant:** redirect to `/merchant`.
**Signed in as staff:** the page shows "Staff accounts can't open a shop. Sign out and register with a different email." with a sign-out button.

## 3. Sign in — `/merchant/sign-in`

- **Fields.**
  - **Email or username.**
  - **Password**, with a show/hide toggle.
  - Link "Forgot password?"
- **Submit.** **Sign in**. While working: "Signing in…".
- **Wrong credentials.** "Email/username or password is incorrect." This is the only error message for wrong credentials.
- **Lockout.** After 5 failures in 15 minutes: "Too many attempts. Wait 15 minutes or reset your password."
- **Signed in without the merchant role.** "This account doesn't have a shop yet. [Open your shop](/merchant/register)." The customer stays signed in.
- **Success.** Go to `next` if it is a safe `/merchant` path. Otherwise:
  - go to `/merchant` once the shop has been submitted
  - go to the saved onboarding step while it hasn't

## 4. Verify email — `/merchant/verify-email`

- **Banner (every portal page while unverified).**
  - Text: "Verify your email to submit your shop and publish products. We sent a link to {email}."
  - Button **Resend link**. During the 60-second cooldown it reads "Resend in 42s".
- **Link opened, valid.** "Email verified. You can now submit your shop." Button: **Go to your dashboard**.
- **Link expired or invalid.** "That link has expired. Send a new one from your dashboard." Button: **Send a new link** if signed in.
- **Already verified.** "Your email is already verified."

## 5. Forgot / reset password

- **`/merchant/forgot-password`.**
  - Field: email.
  - Submit: **Send reset link**.
  - Result (always the same, whether or not the account exists): "If there's a merchant account for {email}, a reset link is on its way. It expires in 1 hour."
- **`/merchant/reset-password?oobCode=…`.**
  - Fields: new password with the strength meter, and confirm.
  - Submit: **Set new password**.
  - Success: "Password changed. Sign in with your new password." Every session is signed out.
  - Invalid or expired code: "That reset link has expired. [Request a new one](/merchant/forgot-password)."

## 6. Onboarding — `/merchant/onboarding/*`

**Stepper.**

- Five steps: Basics · Branding · Contact & policies · Locations · Review.
- It is an `<ol>` with `aria-current="step"`. Completed steps are links.
- Progress is saved on every **Continue**; "Back" never discards.
- On mobile, the stepper collapses to "Step 2 of 5 — Branding".

**Footer.** **Back** (secondary), **Save and continue** (primary), and a "Saved {time}" status.

**Loading.** A skeleton of the step form.

**Permission denied.** Signed-out visitors are redirected to sign-in. Other roles get the 403 page.

### 6.1 Basics

| Field         | Rules / copy                                                                                                                                                                                                |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shop name     | 2–60. "This is how shoppers will see you."                                                                                                                                                                  |
| Shop URL      | Prefix `texora.com/shops/`. Suggested from the name until edited. Live check: "✓ Available" / "That address is taken" / "That address is reserved". Rules: "Use 3–40 lowercase letters, numbers and dashes" |
| Tagline       | ≤ 80, counter "42/80"                                                                                                                                                                                       |
| Description   | ≤ 1,500, plain text, line breaks kept, counter                                                                                                                                                              |
| Departments   | Checkboxes Women / Men, ≥ 1: "Choose at least one department"                                                                                                                                               |
| What you sell | Category checkboxes grouped by department, ≥ 1: "Choose at least one category"                                                                                                                              |
| Shop type     | Radio cards: Brand ("You design and make your own label") · Boutique ("You curate several labels") · Designer ("Independent designer, small runs") · Reseller ("Pre-owned or vintage")                      |

Empty state for a new shop: the fields start blank, with the name field focused.

### 6.2 Branding

- **Logo.**
  - Drop zone text: "Drag your logo here or **choose a file**. Square, at least 512×512 px, PNG, JPG, WebP or SVG, up to 5 MB."
  - After upload: a crop-to-square tool with an arrow-key nudge and a zoom slider.
  - Previews: 40px circle "Avatar", 96px "Shop header", 20px "Sold by line".
- **Banner.**
  - Drop zone text: "3:1, at least 2400×800 px, up to 10 MB."
  - Crop tool plus a focal-point picker: click, or move with the arrow keys.
  - Previews: "Desktop" (1440 crop) and "Mobile" (375 crop).
- **Accent.** A radio group of 8 swatches, each named ("Ink", "Moss", "Clay", "Harbour", "Plum", "Saffron", "Rose", "Slate"). The selected one shows a preview button in that accent.
- **Upload states.** Progress is announced as "Uploading logo, 40%".
  - **Cancel** and **Retry** buttons.
  - Client errors:
    - "That file type isn't supported. Use PNG, JPG, WebP or SVG."
    - "That file is 7.2 MB — the limit is 5 MB."
    - "Your logo is 300×300 px — use at least 512×512 px."
  - Server rejection: "We couldn't use that file. Try saving it again as PNG or JPG."
- **Empty state.** Logo and banner are optional to continue, but required to submit. The review step lists them as "Missing".

### 6.3 Contact & policies

- **Contact fields.**
  - Public email: defaults to the account email.
  - Phone: country selector plus number, stored as E.164. Error: "Enter a phone number like 212 555 0123".
  - Website: "Enter a full address starting with https://".
  - Instagram / TikTok / Facebook: "Enter your handle without the @".
- **Return policy.** Radio: "Use Texora's policy (30 days, unworn with tags)" or "Set your own".
  - Custom: window (No returns / 14 / 30 / 60 days) and condition notes (≤ 500).
- **Shipping.**
  - Ships from: a select of the shop's ship-from locations. With none yet: "Add a ship-from location in the next step".
  - Processing time: 1–2 / 3–5 / 5–10 business days.

### 6.4 Locations

- **Empty.** "Add where you ship from. Shoppers see retail stores on your shop page." Button: **Add a location**.
- **Fields.**
  - Name.
  - Type checkboxes: Retail store, Warehouse / ship-from.
  - Address with US autocomplete; "Enter address manually" is always available.
  - Timezone: derived and editable.
  - Weekly hours: per day, Open or Closed with up to two ranges, plus **Copy Monday to all days**. Required for retail stores.
  - Special hours: date, closed or a range, note.
  - Phone.
- **List.** Each card shows name, types, city, and today's open/closed status.
  - Buttons: Edit, Move up, Move down, Set as primary, Archive.
  - Archive needs confirmation: "Archive {name}? Its stock stays on your products but it won't be used for shipping."
- **Validation.**
  - "Add at least one ship-from location"
  - "Closing time must be after opening time"
  - "Ranges on {day} overlap"
  - "We couldn't find that address. Check the ZIP code."
- **Map preview.** A static pin when geocoded; otherwise "Map preview appears once we find the address."

### 6.5 Review & submit

- **Layout.** A summary card per step with an **Edit** link, and a live preview of the shop page (header, about, locations) rendered with the real storefront components.
- **Checklist blockers.** Each blocker links to the step that fixes it:
  - "Verify your email"
  - "Add a logo"
  - "Add a banner"
  - "Add a ship-from location"
- **Submit.** **Submit for review**. It is disabled while blockers remain, with an explanation underneath.
- **Success.** Redirect to `/merchant`. Status: "Your shop is in review — we usually reply within 1 business day. You can add products in the meantime."

## 7. Dashboard — `/merchant`

**Shell.**

- Desktop: a sidebar with Home · Products · Shop · Orders · Settings · Help.
- Mobile: a bottom tab bar with Home · Products · Add (centre) · Orders · More.
- The shop switcher appears only with more than one shop (capped at 3).

**Status card by shop status.**

| Status              | Card copy                                                                                                 | Next action         |
| ------------------- | --------------------------------------------------------------------------------------------------------- | ------------------- |
| `draft`             | "Finish setting up your shop. {n} of 5 steps done."                                                       | **Continue setup**  |
| `pending_review`    | "Your shop is in review — we usually reply within 1 business day."                                        | **Add a product**   |
| `changes_requested` | "We need a few changes before your shop goes live:" + reviewer reasons                                    | **Make changes**    |
| `approved`          | "Your shop is live." + link to the public page                                                            | **Add a product**   |
| `suspended`         | "Your shop is paused and hidden from shoppers. Reason: {reason}. Contact merchant support to resolve it." | **Contact support** |
| `closed`            | "Your shop is closed. You can reopen it until {date}."                                                    | **Reopen shop**     |

**Checklist.** Verify email · Add branding · Add a location · Add your first product · Submit your shop. Each item is a link and is ticked when done.

**Counts.** Live, drafts, in review, changes requested, low stock. Each links to the filtered product list.

**Recent activity.** The last 10 audited events for the shop, e.g. "Shop submitted for review · 10:42". Empty: "Activity from your shop appears here."

**Skeletons.** Status card, checklist and counts are skeletons until their data arrives.

## 8. Products list — `/merchant/products`

- **Empty.** "You haven't added any products yet." Button: **Add your first product**.
- **Toolbar.**
  - Search: "Search by name or SKU".
  - Status filter: All / Live / Drafts / In review / Changes requested / Scheduled / Archived.
  - Category, and stock (In stock / Low / Out).
  - Sort: Updated, Name, Price.
  - View toggle: Table / Grid.
- **Bulk actions.** Bar text: "{n} selected".
  - Publish, which sends for review if not trusted.
  - Unpublish, Archive, Duplicate.
  - Result: "3 products archived" / "1 product couldn't be published: add images to Navy".
- **Inline stock edit.** Optimistic, rolled back on rejection: "Stock not saved — {reason}".
- **No results.** "No products match these filters." Button: **Clear filters**.
- **Pagination.** "Load more", cursor-based.

## 9. Product editor — `/merchant/products/new`, `/merchant/products/[id]`

**Layout.**

- Desktop: a sticky section nav (Basics · Attributes · Options · Media · Details · Shipping · Visibility & SEO).
- Mobile: accordions.
- Sticky footer: **Save draft** · **Preview** · **Submit for review** (or **Publish** for trusted merchants).

**Autosave.**

- Status line:
  - "Saving…"
  - "Saved 10:42"
  - "Offline — changes will sync"
  - "Couldn't save — retrying"
- Leaving with unsaved changes: "Leave without saving? Changes since 10:42 will be lost."

**Sections.**

- **Basics.**
  - Name (≤ 120).
  - Description: a paragraph (≤ 4,000) plus up to 6 highlights.
  - Category tree; a leaf is required: "Choose a specific category, like Women › Dresses › Midi".
  - Style id: suggested and unique per shop. Error: "You already use {id} for {product}".
- **Attributes.**
  - Fields come from the category's config; required fields are marked "Required".
  - Composition rows (material plus %) show a total: "Total 90% — composition must add up to 100%".
- **Options.**
  - **Colours.** Name, family and swatch for each. Swatch: hex input validated as "Enter a colour like #1F2A44", or **Pick from image**. Reorder with drag or Move up/down.
  - **Fits.** Checkboxes limited to what the category allows.
  - **Sizes.** A preset run per size type with toggles. "Add custom size" only where the category allows it.
  - **Matrix.**
    - Columns: SKU, price, compare-at, stock per location, barcode, weight, online, backorder, low-stock.
    - Bulk bar: "Apply to {n} selected rows".
    - Unticking a combination: "Not made — this combination won't be created".
    - Price errors: "Enter a price" · "Compare-at must be higher than the price".
    - When options change: "Added 6 variants. Kept prices and stock for 30 existing variants."
- **Media (per colour).**
  - Drop zone text: "Add 1–12 photos of {colour}. At least 1600 px on the long edge, up to 15 MB."
  - The first image is "Main", the second is "Hover".
  - Alt text is required. A suggestion is prefilled and flagged until confirmed: "Check this description — confirm or edit it".
  - **Copy images from…** lists other colours.
  - The queue keeps uploading across sections and announces "3 of 5 uploaded".
- **Details.** Fit notes, model info, fabric and care, size guide (platform or custom table).
- **Shipping.** Weight, dimensions, ships-from, processing override.
- **Visibility & SEO.**
  - Status, schedule date and time, slug.
  - SEO title and description, generated with counters "54/60" and "141/160".
  - Keywords as chips.

**Publish blockers.** Shown in a summary dialog with links to each section:

- "Your shop isn't approved yet — products go live when it is"
- "Verify your email first"
- "Add at least one image to Navy"
- "Price every variant you make (4 missing)"
- "Add stock or allow backorder on at least one variant"
- "Fill in the required attribute: Material"
- "Add alt text to 2 images"

**Success.**

- "Submitted for review — we usually reply within 1 business day."
- For trusted merchants: "Published. It can take a minute to appear in search."

**Changes requested.** A banner with the reviewer's reasons and "Resubmit when ready".

## 10. Preview — `/merchant/products/[id]/preview`

The real PDP and product card render the draft, with a top bar: "Preview — only you can see this page. [Back to editor]". The page is `noindex` and the URL carries a signed token. A missing or invalid token gets "This preview link has expired. Open it again from the editor."

## 11. Shop settings — `/merchant/shop/*`

Profile, branding, locations and policies reuse the onboarding forms, with **Save changes** in place of "Continue".

- After approval, changes to name, slug, logo or banner go live immediately and refresh the storefront: "Saved. Your shop page will update in a minute."
- Changing the slug warns: "Your old address will stop working. Links you've shared will break."
- Close shop: "Close your shop? Your products are hidden immediately. You can reopen within 30 days."

## 12. Orders — `/merchant/orders`

- **Empty.** "No orders yet. When shoppers buy your products, they appear here."
- **List.** Order number, date, your items count, your items' total, and status. Status is one of: To ship · Shipped · Delivered · Cancelled.
- **Detail.**
  - Shows only this merchant's lines and the ship-to address. Payment details and other merchants' items are hidden.
  - **Mark shipped**: carrier (USPS / UPS / FedEx / DHL / Other) and tracking number. Success: "Marked as shipped. We emailed the customer."
- **Permission denied.** Another merchant's order returns 404: "We couldn't find that order." It is not a 403, so ids can't be probed.

## 13. Settings — `/merchant/settings/*`

- **Account.** Display name; email (change with re-verification).
- **Username.** Change it under the same rules, at most once every 30 days: "You changed your username on {date}. You can change it again on {date}."
- **Security.** Change password (current + new); **Sign out of all devices**.
- **Notifications.** Email toggles for orders, reviews and shop status. Shop status emails are always on: "Required: you'll always hear about your shop's status."

## 14. Shopper side

- **Product card.** "by {Shop name}" under the product name, linking to the shop.
- **PDP "Sold by" block.**
  - Logo, name, "Ships from {city}, {state}".
  - Return summary: "30-day returns" / "Returns within 14 days" / "Final sale — no returns".
  - Link **Visit shop**.
- **`/shops/[slug]`.**
  - Banner, logo, name, tagline, about text.
  - Locations: retail stores only, with open-now status.
  - Product grid with filters, sort, density and load more.
  - Empty: "{Shop} hasn't listed anything yet. Check back soon."
  - Not approved or unknown: 404.
- **Search and PLP.** A "Shop" facet. Search matches shop names.

## 15. Admin side (back office)

- **`/admin/merchants`.** A queue of shops pending review.
  - **Approve** sends "Your shop is live".
  - **Request changes** needs reasons the merchant sees.
  - **Reject** needs a reason.
- **Shop detail.** Suspend (reason required), Reinstate, and trust level (Standard / Trusted). The history comes from the audit log.
- **`/admin/merchants/products`.** A queue of products in review.
  - **Approve** makes the product live.
  - **Request changes** sends reasons.
- **Empty queues.** "Nothing waiting for review."

## Emails

| Trigger                     | Subject                                                    |
| --------------------------- | ---------------------------------------------------------- |
| Registration                | Verify your email to open your Texora shop                 |
| Password reset              | Reset your Texora merchant password                        |
| Shop submitted              | We've received your shop                                   |
| Shop approved               | Your shop is live on Texora                                |
| Changes requested           | A few changes before your shop goes live                   |
| Shop suspended / reinstated | Your Texora shop has been paused / Your shop is live again |
| Product approved            | {Product} is live                                          |
| Product changes requested   | Changes needed for {Product}                               |
| New order                   | New order {number}: {n} items to ship                      |
