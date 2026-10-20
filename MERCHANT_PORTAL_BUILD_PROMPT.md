# Merchant Portal — Full Build Prompt (Claude Code)

> Texora · Next.js 16 · React 19 · TypeScript strict · Tailwind CSS v4 · Firebase
> Scope: footer entry point → merchant registration → shop creation (branding + locations) → product creation with full options & variants → products live on the storefront
> Output standard: production-ready, enterprise-grade, zero placeholders, zero TODOs, zero regressions

---

## 1. YOUR ROLE

You are a **Senior Software Engineer + Senior UI/UX Engineer** who has built marketplace seller portals (Shopify admin, Etsy shop manager, Farfetch partner portal class). You design the whole merchant journey first, then implement it as a fast, secure, accessible extension of the existing Texora codebase.

Operating rules:

1. **Audit before build.** This repo already has Phases 0–7 of `STOREFRONT_BUILD_PROMPT.md` implemented. Read it before writing code.
2. **Extend, don't fork.** Reuse existing primitives, tokens, validation schemas, repositories, session/RBAC, audit logging, `run-action.ts`, search indexing and the `cn()`/`cva` patterns. No parallel systems.
3. **Phase-gated.** Finish each phase, run `typecheck`, `lint`, unit, rules and E2E tests, plus `build`, then print `✅ PHASE N COMPLETE` with a summary. Continue without asking unless a decision is irreversible.
4. **No regressions.** Every existing test still passes. The storefront's performance budgets and visual baselines don't move except where a phase intentionally changes them.
5. **Read `AGENTS.md` and `node_modules/next/dist/docs/` first.** This Next.js version differs from your training data (e.g. route protection lives in `src/proxy.ts`). Current conventions beat any example in this file.

---

## 2. WHAT ALREADY EXISTS — BUILD ON IT

Confirm each of these in Phase 0 and record anything that differs in `docs/DECISIONS.md`:

| Existing piece                                                                         | Where                                              | How the merchant portal uses it                                                                                                                             |
| -------------------------------------------------------------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vendor` role with `vendor.catalog.write`, `vendor.orders.read`, `vendor.payouts.read` | `src/lib/auth/rbac.ts`                             | **A merchant = the `vendor` role.** Keep the internal name `vendor`; say "Merchant" in all UI copy. Add permissions only where listed in Section 6          |
| `vendorId` custom claim + `assignRole(..., { vendorId })`                              | `src/lib/auth/roles.ts`, `session.ts`              | Set on merchant registration; `vendorId` = the merchant's id                                                                                                |
| `vendorId` on `products` and `variants`; `vendorOwnsIncoming()` rule                   | `src/lib/validation/catalog.ts`, `firestore.rules` | Merchant products use the **existing** product/variant schemas. No new product model                                                                        |
| `stores` collection + store locator                                                    | `src/lib/stores`, `(storefront)/stores`            | That is the **platform's own** physical stores. **Do not reuse it for merchants.** Merchant shops get their own collections (Section 5) to avoid collisions |
| `stockByLocation` keyed by location id; `ONLINE_LOCATION`                              | catalog schema                                     | Merchant locations become inventory locations with namespaced ids (`m_{shopId}_{locationId}`)                                                               |
| Route access map (`/admin/vendor` prefix)                                              | `rbac.ts`, `src/proxy.ts`                          | Replace with `/merchant` prefix rules (Section 4) and update tests                                                                                          |
| Storage rules = deny-all                                                               | `storage.rules`                                    | Phase 2 adds scoped merchant media rules                                                                                                                    |
| `FOOTER_COLUMNS`                                                                       | `src/config/navigation.ts`                         | Add the Merchants entry point (Phase 1)                                                                                                                     |
| Search index builder                                                                   | `src/lib/catalog/build-index.ts`                   | Add shop name/slug fields and a "Shop" facet                                                                                                                |

---

## 3. THE MERCHANT JOURNEY (design this first, end-to-end)

Write `docs/MERCHANT_JOURNEY.md` before coding UI. It needs a screen-by-screen flow map, every state (empty, loading skeleton, validation error, server error, success, permission denied) and the copy for each. Then implement exactly that.

### 3.1 Entry: footer → Merchants landing

- Footer gets a **"Merchants"** column: _Sell on [PLATFORM_NAME]_ (→ `/merchants`), _Merchant sign in_ (→ `/merchant/sign-in`), _Merchant help_ (→ `/help/merchants`).
- `/merchants` is a public, statically rendered marketing page in the storefront design language. Sections: hero with "Open your shop" CTA, how it works (3 steps: register → build your shop → list products), what you get (shop page, nationwide reach, analytics), fees/requirements summary (content from `src/config/merchant.ts`, not hardcoded in JSX), FAQ accordion, final CTA. One primary CTA per viewport.

### 3.2 Registration (`/merchant/register`)

Fields: **email**, **username**, **password**, confirm password, accept merchant terms (checkbox, links to the terms page).

- **Username:** 3–30 chars, `^[a-z0-9](?:[a-z0-9_.-]*[a-z0-9])?$`, lowercased, reserved-word blocklist (`admin`, `support`, `texora`, `help`, route names…). Live availability check (debounced 300ms, server action, rate-limited). Uniqueness is **guaranteed** by a transaction on `usernames/{username}`, not by a query.
- **Email:** RFC-valid, normalized lowercase, unique (Firebase Auth enforces it; map the error to friendly copy).
- **Password:** min 12 chars, strength meter (zxcvbn-style score ≥ 3), show/hide toggle, checked against a common-password list. No composition rules beyond that.
- On submit (one server action, idempotent): create the Firebase Auth user (email/password) → reserve the username → create `merchants/{vendorId}` with `status: "onboarding"` → `assignRole(system, uid, "vendor", { vendorId })` → write the audit log → send the email-verification link → mint the session cookie → redirect to `/merchant/onboarding`.
- If any step fails midway, roll back (delete the Auth user and release the username) so a retry works.
- Customers who already have an account can **upgrade** to merchant from the same page after signing in (role change goes through `assignRole`, sessions revoked and re-minted).

### 3.3 Sign in, verification, recovery

- `/merchant/sign-in` takes email **or** username plus password; a username resolves to an email server-side. Generic error copy ("Email/username or password is incorrect"). Rate-limited and lockout-aware.
- Unverified email: a banner with resend (60s cooldown). Merchants can build drafts but **cannot submit a shop for review or publish products until verified**.
- Forgot/reset password flows. Optional TOTP 2FA in settings (feature-flagged).

### 3.4 Onboarding wizard (`/merchant/onboarding`) — create the shop

A stepper with progress saved on every step (resume anywhere, any device). Back never loses data. Each step is a separate route segment so it's deep-linkable and code-split.

**Step 1 — Shop basics:** shop name (2–60), shop URL slug (auto-generated from the name, editable, live availability check, reserved via `shopSlugs/{slug}` transaction), tagline (≤ 80), description (≤ 1,500, plain text with line breaks), primary department(s) (multi-select from the existing department config), what you sell (categories from the existing category tree, multi-select, ≥ 1), shop type (brand / boutique / designer / reseller).

**Step 2 — Branding:**

- **Logo:** square, PNG/JPG/WebP/SVG-sanitized, ≥ 512×512, ≤ 5 MB. Shows a crop-to-square tool and live previews (circle avatar 40px, header 96px, product card "Sold by" 20px).
- **Banner:** 3:1, ≥ 2400×800, ≤ 10 MB. Crop tool, focal-point picker, and previews at desktop (1440) and mobile (375) crops.
- **Accent colour:** choose from a curated set of 8 accents defined as tokens. Each one is pre-verified for AA contrast on the shop page. No free hex input.
- Upload UX: drag-and-drop + file picker, progress bar, cancel, retry, client-side type/size/dimension validation **and** server-side re-validation.

**Step 3 — Contact & policies:** public contact email (defaults to the account email), phone (E.164 with country selector), website, Instagram/TikTok/Facebook handles (validated formats). Return policy: _use platform default_ or _custom_ (window 0/14/30/60 days, condition notes ≤ 500). Shipping: ships from (location select from Step 4), processing time (1–2 / 3–5 / 5–10 business days).

**Step 4 — Locations (one or more):**

- Location type: **retail store**, **warehouse / ship-from**, **pickup point** (multi-select per location).
- Fields: name, address (autocomplete; manual fallback; normalized + geocoded server-side), timezone (auto from geocode, editable), weekly hours (per day open/closed + up to 2 ranges, "copy to all days"), special hours/closures, phone, pickup enabled (yes/no + instructions).
- Map preview pin. Add, edit, reorder, set primary, archive (not hard-delete if stock references it).
- At least one location must ship or offer pickup.

**Step 5 — Review & submit:** a full summary with "edit" links back to each step, plus a live preview of the shop page exactly as shoppers will see it. Submitting sets `shop.status = "pending_review"` (blocked until the email is verified) and notifies admins. Merchants can keep adding products while pending; nothing is public until the shop is **approved**.

Shop status machine: `draft → pending_review → approved (live) | changes_requested → pending_review`, plus `suspended` (admin only) and `closed` (merchant-initiated, reversible within 30 days). Every transition is audited, shown on the dashboard, and emailed.

### 3.5 Merchant dashboard (`/merchant`)

- **Home:** shop status card with the next required action, setup checklist (verify email, branding, location, first product, submit), counts (live / draft / in-review / rejected products, low stock), recent activity.
- **Navigation:** Home · Products · Shop (profile, branding, locations, policies) · Orders · Settings (account, username, password, 2FA, notifications) · Help.
- **Layout:** desktop sidebar, mobile bottom tab bar (primary actions in the thumb zone), shop switcher if a merchant owns more than one shop (data model supports many; UI caps at 3 via config).

### 3.6 Product creation (`/merchant/products/new`, `/merchant/products/[id]`)

A single long-form editor with a sticky section nav (desktop) / accordion sections (mobile), **autosave drafts every 5s of inactivity**, "unsaved changes" guard, and a sticky footer with _Save draft_ · _Preview_ · _Submit for review_ (or _Publish_ for trusted merchants).

1. **Basics:** name (≤ 120), description (≤ 4,000, structured: paragraph + bullet highlights), department → category (tree picker, leaf required; drives `sizeType` and the attribute set), style id / merchant SKU prefix (auto-suggested, editable, unique per shop).
2. **Attributes:** dynamic fields driven by category config (`src/config/product-attributes.ts`): material/composition (multi, with % that must sum to 100), sleeve, length, neckline, rise, closure, pattern, occasion, season, care. Required/optional per category. Values map 1:1 to the existing `attributes` record and storefront filters.
3. **Options — the variant builder:**
   - **Colours:** add any number. Each gets a name, a colour family (enum used by storefront filters), and a swatch (pick from an uploaded image with an eyedropper, or the hex picker, validated). Drag to reorder (keyboard reorder buttons too).
   - **Fit families:** Regular / Petite / Tall / Plus (whichever the category allows).
   - **Sizes:** preset size runs per `sizeType` (alpha XXS–4XL, numeric 00–24, waist×inseam, shoe EU/US, one size) with toggles. A custom size is allowed only if the category permits it.
   - **Variant matrix:** generated from colour × fit × size. A spreadsheet-style grid with per-variant **SKU** (auto pattern, editable), **price**, **compare-at price**, **stock per merchant location**, **barcode**, **weight**, **available online** toggle, **backorder** toggle, and **low-stock threshold**. Bulk-edit toolbar: apply price/stock/weight to selected rows, filter by colour/fit/size, select all, and disable combinations you don't make (excluded combinations aren't created).
   - Prices are entered as decimals but stored as integer minor units via the existing `moneySchema`. Compare-at must be greater than price.
4. **Media (per colour):**
   - Upload 1–12 images per colour (≥ 1600px on the long edge, 3:4 crop guide overlay, ≤ 15 MB, JPG/PNG/WebP/AVIF) and an optional ≤ 30s video with poster.
   - Drag to reorder; first = primary, second = hover/alternate. Required **alt text** (suggested from name + colour, must be edited or confirmed). Focal point per image. "Copy images from colour…" for shared detail shots.
   - Background upload queue that survives navigating between sections; failed uploads retry.
5. **Details:** fit notes, model info (height / size worn), fabric & care lines, size-guide selection (platform guide for the category or a merchant guide table).
6. **Shipping:** package weight/dimensions defaults (variants inherit), ships-from location, processing-time override.
7. **Visibility & SEO:** status, schedule publish date/time, SEO title/description (auto-generated with live counters), slug (auto, unique), search keywords (chips).
8. **Preview:** renders the real storefront PDP and product card components with the draft data (server-rendered, `noindex`, token-protected URL).

Also on the product list (`/merchant/products`): table/grid toggle, search, filters (status, category, stock), sort, bulk actions (publish/unpublish/archive/duplicate), inline stock edit, cursor pagination, and an empty state with a "Add your first product" CTA. Duplicate product copies everything except SKUs (re-suggested) and slug. Archive is a soft delete.

### 3.7 Review & publishing

- Product status machine: `draft → in_review → live | changes_requested`, plus `archived` and `scheduled`. Merchants with `shop.trustLevel = "trusted"` (admin-set) skip review.
- Publish-time validation (server): shop approved, email verified, ≥ 1 colour with ≥ 1 image, every enabled variant priced, ≥ 1 sellable variant (stock > 0 or backorder), required attributes present, alt text present.
- On going live: write product + variants in a batch, denormalize the shop display fields onto the product (`shop: { id, slug, name, logo }`), update the search index via the existing builder, and `revalidateTag` the affected PLP/PDP/shop tags.

### 3.8 How it shows up for shoppers (storefront integration)

- **Product card:** a small "by {Shop name}" line under the product name (links to the shop).
- **PDP:** a "Sold by" block with logo, name, location city, return policy summary, and "Visit shop" link. Pickup availability uses merchant pickup locations.
- **Shop page `/shops/[slug]`:** banner (focal-point aware), logo, name, tagline, description, locations with hours and open-now status (reuse `src/lib/stores/hours.ts` logic, don't duplicate it), and the shop's product grid using the **existing PLP components** (filters, sort, density, load-more). Statically generated with on-demand revalidation. JSON-LD `Organization` + `ItemList`.
- **Search & PLP:** a "Shop" facet; search hits include shop name.
- Only `approved` shops and `live` products are ever visible. Suspending a shop hides all its products within one revalidation cycle.

### 3.9 Orders (minimum to close the loop)

- Order lines already snapshot product data; ensure each line also snapshots `vendorId` and shop name at purchase time.
- `/merchant/orders`: list and detail limited to lines belonging to the merchant (read via a server-side query scoped by `vendorId`, never by client filter). Fulfilment actions (mark packed / shipped with carrier + tracking) only if the existing order model supports per-line fulfilment. Otherwise, implement per-merchant fulfilment groups and record the decision in `DECISIONS.md`.
- Payouts are **out of scope** for this prompt (they need a Stripe Connect integration). Leave the existing `vendor.payouts.read` permission in place and do not build a fake payouts screen.

### 3.10 Admin side (minimum required for the journey to work)

Under the existing admin area, permission-gated (`merchants.review`, `merchants.manage`):

- Merchant applications queue with shop preview, approve / request changes (with reasons merchants see) / reject.
- Product review queue for non-trusted merchants.
- Suspend/reinstate shops and set the trust level. Everything audited.

---

## 4. ROUTES & PROJECT STRUCTURE (built for speed)

```
src/app/
  (storefront)/
    merchants/page.tsx                 # public landing — static
    shops/[slug]/page.tsx              # public shop page — SSG + on-demand revalidate
    help/merchants/...                 # via existing help system content
  (merchant-auth)/merchant/
    register/page.tsx
    sign-in/page.tsx
    forgot-password/page.tsx
    reset-password/page.tsx
    verify-email/page.tsx
  (merchant)/merchant/                 # authenticated portal, own layout, dynamic
    layout.tsx                         # session check, shop context, sidebar/bottom nav
    page.tsx                           # dashboard
    onboarding/(basics|branding|contact|locations|review)/page.tsx
    products/page.tsx
    products/new/page.tsx
    products/[id]/page.tsx
    products/[id]/preview/page.tsx
    shop/(profile|branding|locations|policies)/page.tsx
    orders/page.tsx, orders/[id]/page.tsx
    settings/(account|security|notifications)/page.tsx
src/components/merchant/
  layout/       # MerchantShell, SidebarNav, BottomTabBar, ShopSwitcher, StatusBanner
  onboarding/   # Stepper, StepFooter, SlugField, UsernameField, PasswordStrength
  media/        # Uploader, UploadQueue, ImageCropper, FocalPointPicker, MediaGrid (sortable), SwatchEyedropper
  locations/    # LocationForm, HoursEditor, AddressAutocomplete, MapPreview
  products/     # ProductEditor, SectionNav, AttributeFields, ColorOptions, FitSizeOptions, VariantMatrix, BulkEditBar, ProductTable
  shop/         # ShopHeader, ShopCard, SoldByBlock (storefront-facing, used by PDP/cards)
src/lib/merchant/
  repositories/ (merchants.ts, shops.ts, locations.ts, media.ts, merchant-products.ts)
  actions/      (register.ts, onboarding.ts, shop.ts, locations.ts, products.ts, media.ts)
  variants/     (matrix.ts — pure generate/diff/merge functions, fully unit-tested)
  publishing/   (validate.ts, publish.ts — pure validation + transactional publish)
  media/        (process.ts — server-side validation, dimensions, blur placeholder, dominant colour)
  status.ts     (state machines for shop + product with allowed transitions)
src/lib/validation/merchant.ts         # Zod schemas shared client/server
src/config/merchant.ts                 # limits, reserved words, size runs, accents, landing copy
src/config/product-attributes.ts       # per-category attribute definitions
```

Speed & functionality rules:

- **The storefront stays static/ISR.** Merchant edits never make storefront pages dynamic. Use tag-based revalidation (`shop:{id}`, `product:{id}`, `category:{key}`) and verify against the Next 16 caching docs.
- **The portal is dynamic and client-heavy only where needed.** The editor, matrix, cropper and uploader are client components loaded with dynamic import. Section shells are Server Components. Measure the per-route JS budget: ≤ 250 KB gz for `/merchant/products/[id]`, ≤ 120 KB for other portal routes.
- **Direct-to-Storage uploads.** The browser uploads to `merchant-media/{vendorId}/{shopId}/tmp/{uuid}` under Storage rules. A server action then validates the file (magic bytes, dimensions, sanitizes SVG, strips EXIF/GPS), generates the blur placeholder and dominant colour, and moves it to its permanent path. `next/image` serves everything (`remotePatterns` for the bucket only). Temp files are cleaned by the existing cron pattern after 24h.
- **The variant matrix is virtualized** for 500+ rows and keyboard-navigable like a grid (arrow keys, Enter to edit, Escape to cancel).
- **No N+1.** Shop display fields are denormalized onto products. Lists use cursor pagination. Counts on the dashboard come from maintained counter fields updated in the same transaction/batch.
- **Optimistic UI** for reorder, toggle and inline-stock edits, with rollback on server rejection.

---

## 5. DATA MODEL ADDITIONS (Firestore)

Zod schema + TS type for each in `src/lib/validation/merchant.ts`, indexes in `firestore.indexes.json`:

- `merchants/{vendorId}`: ownerUid, email, username, displayName, status (`onboarding|active|suspended|closed`), emailVerified, trustLevel (`standard|trusted`), shopIds[], createdAt, updatedAt.
- `usernames/{username}`: uid, createdAt (uniqueness lock).
- `shopSlugs/{slug}`: shopId (uniqueness lock).
- `shops/{shopId}`: vendorId, slug, name, tagline, description, shopType, departments[], categoryKeys[], logo (existing `imageSchema` + blur + dominant colour), banner (+ focalPoint), accent (token key), contact{}, social{}, returnPolicy{}, shipping{}, status, reviewNotes[], onboardingStep, counters{ live, draft, inReview, lowStock }, createdAt, updatedAt.
- `shops/{shopId}/locations/{locationId}`: name, types[], address{…, geo}, timezone, hours[], specialHours[], phone, pickup{ enabled, instructions }, isPrimary, status (`active|archived`).
- `products` / `variants`: **existing schemas**, plus `shopId`, denormalized `shop{ id, slug, name, logo }`, and the extended `status` values (`in_review`, `changes_requested`) if not already present. Merchant location stock lives in `stockByLocation` under `m_{shopId}_{locationId}` keys.
- `productDrafts/{productId}`: autosaved editor state (so half-finished work never touches `products`).
- `merchantMedia/{mediaId}`: owner, shopId, path, type, width, height, bytes, blurDataURL, dominantColor, alt, status (`tmp|attached|orphaned`).

---

## 6. SECURITY & PRIVILEGES

- **Permissions to add:** `merchant.shop.write`, `merchant.locations.write`, `merchant.media.write` (vendor), `merchants.review`, `merchants.manage` (admin side). Update `rbac.ts`, the rules' permission map, and both test suites.
- **Enforce in three layers:** `src/proxy.ts` route access (`/merchant/**` requires `vendor`, except the `(merchant-auth)` routes), every Server Action via the existing guard (`requirePermission` + ownership check `resource.vendorId === session.vendorId`), and Firestore/Storage rules.
- **Firestore rules:** merchants read/write only their own `merchants`, `shops`, `locations`, `productDrafts` and `merchantMedia` docs. They can never write `status: "approved"`, `trustLevel`, counters, or `status: "live"` unless trusted (validated server-side; rules deny direct client writes to those fields). The public can read only approved shops and active locations.
- **Storage rules:** writes only to the merchant's own tmp path, content-type allowlist, size caps. Public read only for attached media paths.
- Rate limits on register, sign-in, availability checks, uploads and publish (existing security lib).
- Never trust client-provided `vendorId`/`shopId`; always derive them from the session.
- Audit-log every shop/product status change, role change, and admin decision.
- **Rules tests:** every collection × {anonymous, customer, vendor-owner, vendor-other, admin} × {read, create, update, delete}.

---

## 7. UX & DESIGN QUALITY BAR

- Use the existing ATELIER tokens and primitives only. The portal uses the "admin density" variant (tighter spacing, 14px base) but the same type, colour and component language.
- Forms use React Hook Form + Zod with the same schema as the server. Inline errors appear on blur, a summary appears on submit with focus moved to the first error, and errors are never shown as toasts alone.
- Every async surface has a skeleton that matches the final layout. Every list has an empty state with a next action.
- **Accessibility (WCAG 2.2 AA):** labelled inputs, `aria-describedby` for hints/errors, every drag interaction has keyboard and button equivalents, the cropper/focal picker can be operated by keyboard, `aria-live` for upload progress, autosave status and availability checks, and 44×44px touch targets.
- **Mobile-first:** the whole journey, including adding a product with photos from the phone camera (`accept="image/*" capture`), works at 375px. The matrix collapses into per-colour cards on mobile.
- Copy is human and specific ("Your shop is in review — we usually reply within 1 business day"), never system-speak.
- Autosave indicator: "Saving…" / "Saved 10:42" / "Offline — changes will sync".

---

## 8. EXECUTION PHASES

**PHASE 0 — Audit.** Read `AGENTS.md`, the Next 16 docs for routing/caching/proxy/images, `STOREFRONT_BUILD_PROMPT.md`, `docs/DECISIONS.md`, `docs/FEATURE_PARITY.md`, and the existing auth, RBAC, catalog, validation, rules and search code. Produce an audit in `docs/MERCHANT_AUDIT.md` (what exists, gaps, conflicts, decisions). Write `docs/MERCHANT_JOURNEY.md` (Section 3).

**PHASE 1 — Entry & data foundation.** Footer Merchants column, `/merchants` landing, `src/config/merchant.ts`, Zod schemas, repositories, permissions, proxy rules, Firestore + Storage rules with full rules tests, indexes.

**PHASE 2 — Registration & auth.** Register (username/email/password), sign-in by email or username, verification, recovery, customer→merchant upgrade, rollback-safe registration action, rate limits, unit and E2E tests.

**PHASE 3 — Media pipeline.** Uploader, queue, cropper, focal point, server processing, temp cleanup cron, `next/image` config. Tests include malicious file types, oversized files, SVG script injection, and EXIF stripping.

**PHASE 4 — Onboarding wizard & shop management.** All 5 steps, slug locks, locations with hours/geocode, shop preview, submission + status machine, shop settings pages (edit after onboarding), dashboard home with checklist.

**PHASE 5 — Product editor.** Attributes config, colours/fits/sizes, the variant matrix (pure `matrix.ts` with exhaustive unit tests for generate/diff/merge when options change on an existing product without losing entered prices/stock), per-colour media, details, shipping, SEO, autosave drafts, preview, product list with bulk actions, duplicate/archive.

**PHASE 6 — Review, publishing & storefront integration.** Publish validation, transactional publish, denormalization, search index + Shop facet, tag revalidation, "Sold by" on cards and PDP, `/shops/[slug]` page, admin application and product review queues, suspend/reinstate.

**PHASE 7 — Merchant orders.** `vendorId` snapshot on order lines, scoped order list/detail, fulfilment actions per Section 3.9.

**PHASE 8 — Hardening & QA.**

- **Playwright E2E:** footer → register → verify → onboarding → submit → admin approves → create product with 3 colours × 2 fits × 6 sizes and images → publish → product visible on PLP, search and shop page → shopper buys it → merchant sees the order.
- **Negative tests:** another merchant's resources are inaccessible via UI, actions and rules; suspended-shop products disappear.
- **Quality:** axe = 0 on every portal route; performance budgets met; visual baselines for every portal screen at 375/768/1440.
- **Docs:** update `docs/FEATURE_PARITY.md`, `docs/DECISIONS.md`, `README.md` (merchant setup, env vars, seed merchants).

**PHASE 9 — Seed & handover.** The seed script adds 3 merchants (one per shop type) with approved shops, branding, 2 locations each, and 10+ products each with full variants. It also adds 1 merchant pending review and 1 with changes requested. Print the final report: routes added, tests added (unit / rules / E2E counts), bundle sizes, Lighthouse for `/shops/[slug]` and `/merchants`, known limitations (payouts).

---

## 9. DEFINITION OF DONE

- A brand-new merchant can go from the footer link to a live product on the storefront with no developer help, on desktop and mobile.
- Every option in Sections 3.2–3.6 is implemented, validated client- and server-side, and covered by tests.
- Merchant isolation is proven by rules tests and E2E negative tests.
- Zero TypeScript errors, zero ESLint errors, zero axe violations, zero `TODO`/`FIXME`, all existing tests still green, storefront budgets unchanged or better.
- No placeholder code paths and no fake screens.

**Begin with PHASE 0 now.**
