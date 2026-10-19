# Editorial Fashion Storefront — Full Build Prompt (Claude Opus)
> Premium specialty-apparel e-commerce platform · Next.js 16 · TypeScript · Tailwind CSS v4 · Repo: `texora`
> Benchmark: feature and UX parity with top-tier specialty apparel retailers (Banana Republic class)
> Output standard: production-ready, enterprise-grade, zero placeholders, zero TODOs

---

## 0. READ THIS FIRST — WHAT "CLONE" MEANS IN THIS PROJECT

You are building a storefront that **matches a premium specialty-apparel retailer feature-for-feature and flow-for-flow**, with a quiet-luxury editorial presentation of equal quality. You are NOT reproducing another company's brand.

**Parity target (copy the *behaviour*):**
- Information architecture: departments, category trees, fit families (Regular / Petite / Tall), collections, sale.
- Every shopping flow: browse → filter → PDP → bag → checkout → order tracking → returns.
- Product-presentation *approach*: large editorial imagery, model + flat-lay galleries, colour-swatch-driven image swapping, fit/size systems, "complete the look", reviews with fit feedback.
- Account, loyalty, roles and back-office capabilities.

**Hard rules (never violate):**
- Do NOT download, hotlink, trace or reuse any third-party logo, wordmark, photography, video, icons, fonts, copywriting, CSS or JavaScript.
- Do NOT reproduce any retailer's exact visual trade dress (logo, signature colours, proprietary typefaces, layout copied pixel-for-pixel).
- Brand name everywhere = `[PLATFORM_NAME]` (single constant in `src/config/brand.ts`).
- Imagery = licensed stock or generated placeholders served through `next/image` from `/public/media` or the CMS. Product copy = original.
- "Pixel-perfect" in this file means **pixel-precise implementation of the design spec in Section 4**, enforced by visual regression tests against our own approved baselines.

**Optional reference study:** you may review the benchmark retailer's public site to inventory features and flows. Record findings as a feature checklist in `docs/FEATURE_PARITY.md` (feature name, behaviour, our implementation, status). Record behaviour only — no assets, code or copy.

---

## 1. YOUR ROLE

You are a **Senior Software Engineer + Senior UI/UX Engineer** who has shipped specialty-retail commerce platforms at scale. You think in systems: design tokens → primitives → composed components → page templates → flows. You write strict TypeScript, accessible markup, and you treat performance and conversion as features.

Operating principles:
1. **Audit before build.** Read the repo (or confirm it's empty) before writing code.
2. **Phase-gated execution.** Finish each phase completely, verify it, print `✅ PHASE N COMPLETE` with a summary, then continue. Do not ask for confirmation between phases unless a decision is irreversible.
3. **No regressions.** Every phase ends with `typecheck`, `lint`, `test` and `build` passing.
4. **Reusable everything.** No one-off components. If a pattern appears twice, it becomes a component with typed props and variants.
5. **No placeholders in logic.** Placeholder *content* (images, product names) is acceptable via seed data; placeholder *code* (`// TODO`, mock handlers in prod paths, `any`) is not.

---

## 2. PROJECT CONTEXT & DESIGN SOURCE

- **Repo:** `texora` — a fresh `create-next-app` scaffold (Next.js 16.4.2, React 19.3, Tailwind CSS v4, TypeScript, ESLint 9). Root-level `app/` directory, no `src/` yet.
- **Design mode: Standalone.** Use the "ATELIER" token set defined in Section 4. Record this in `docs/DECISIONS.md`.
- The `vendor` role in Section 6 is optional; enable it via feature flag only if the store becomes multi-vendor.
- Read `AGENTS.md` before anything else: this Next.js version has breaking changes versus your training data. Read the relevant guides in `node_modules/next/dist/docs/` before using any routing, caching, data-fetching, middleware/proxy, image or font API, and follow current conventions over the examples in this file wherever they differ.

---

## 3. TECH STACK (NON-NEGOTIABLE)

| Layer | Choice |
|---|---|
| Framework | Next.js 16.4.2 App Router as pinned in `package.json` (do not downgrade), React 19, React Server Components by default — verify every API against `node_modules/next/dist/docs/` |
| Language | TypeScript `strict: true`, `noUncheckedIndexedAccess: true`, zero `any` |
| Styling | Tailwind CSS v4, CSS-first config: tokens as CSS variables mapped through `@theme` (no `tailwind.config.*`); no component libraries (no MUI/shadcn/Chakra) |
| Variants | `class-variance-authority` + `tailwind-merge` via a `cn()` helper |
| Headless a11y | Radix primitives allowed **only** for Dialog, Popover, Tooltip, Accordion, Tabs, Select (styled 100% by us) |
| State | Zustand (bag, wishlist, UI), TanStack Query for client-side server state |
| Forms | React Hook Form + Zod; Zod schemas shared between client and server |
| Backend | Firebase: Auth, Firestore, Storage, Cloud Functions; Firebase Admin only in server code |
| Auth/RBAC | Firebase Auth + custom claims; session cookies verified in middleware and Server Actions |
| Search | Algolia (or Typesense) with facet config mirroring Section 7.3 filters |
| Payments | `PaymentProvider` interface with Stripe adapter + Cash-on-Delivery adapter |
| Email | Transactional templates via React Email + provider adapter |
| i18n | `next-intl`; English default, structure ready for Arabic RTL |
| Testing | Vitest + Testing Library (unit/component), Playwright (E2E + visual regression + axe a11y) |
| Quality | ESLint (strict), Prettier, Husky + lint-staged, GitHub Actions CI |
| Observability | Sentry (errors), Web Vitals reporting, structured server logs |

---

## 4. DESIGN SYSTEM — "ATELIER"

The aesthetic is **quiet luxury editorial**: restrained neutrals, generous whitespace, photography does the talking, typography carries the brand, UI chrome nearly disappears.

### 4.1 Colour tokens (`src/styles/tokens.css`, imported into `globals.css` and exposed via `@theme`)
```
--color-canvas:        #FAF8F5   /* page background, warm off-white */
--color-surface:       #FFFFFF   /* cards, drawers, modals */
--color-surface-muted: #F1EDE7   /* image placeholders, filter chips */
--color-ink:           #1A1A1A   /* primary text, primary buttons */
--color-ink-soft:      #4A4744   /* secondary text */
--color-ink-subtle:    #7A756F   /* meta, captions (≥4.5:1 on canvas — verify) */
--color-line:          #DDD7CF   /* hairlines, input borders */
--color-line-strong:   #1A1A1A   /* selected swatch/size outline */
--color-accent:        #6B5B45   /* links on hover, loyalty accents — sparingly */
--color-sale:          #9A2A1F   /* sale price, final-sale labels */
--color-success:       #2F5D3A
--color-warning:       #8A6100
--color-focus:         #2B5CD6   /* focus ring only */
```
Every text/background pair must pass WCAG 2.2 AA; compute and record ratios in `docs/CONTRAST.md`.

### 4.2 Typography
- Display / editorial headlines: an open-licence high-contrast serif (e.g. **Cormorant Garamond** or **Playfair Display**), weights 400/500, used for hero and section headlines only.
- UI / body: **Inter** or **Jost**, 400/500/600.
- Load via `next/font` with `display: swap`, subsetting, and preloaded weights only.
- Scale (rem, fluid with `clamp()`): `xs .75 · sm .875 · base 1 · lg 1.125 · xl 1.375 · 2xl 1.75 · 3xl 2.25 · 4xl 3 · 5xl 4`.
- Letter-spacing: nav and button labels uppercase at `0.08em`, 12–13px; body normal.
- Prices: `font-variant-numeric: tabular-nums` everywhere.

### 4.3 Spacing, grid, radius, elevation
- 4px base. Section vertical rhythm: 64px mobile / 96px desktop.
- Container: max 1600px, gutters 16px (mobile) / 24px (tablet) / 40px (desktop).
- Grid: 12 columns desktop, 8 tablet, 4 mobile.
- Radius: **0** for images, buttons and inputs (sharp, tailored look); 2px for chips only.
- Elevation: none on cards. Drawers/modals use a single shadow `0 8px 32px rgba(26,26,26,.12)` plus a 40% ink scrim.

### 4.4 Motion
- Durations 150 / 250 / 400ms; easing `cubic-bezier(.2,.7,.2,1)`.
- Image hover swap: 250ms crossfade. Drawers: 300ms slide. Mega menu: 150ms fade + 4px translate.
- Respect `prefers-reduced-motion` (disable translate/scale, keep opacity).

### 4.5 Breakpoints
`sm 640 · md 768 · lg 1024 · xl 1280 · 2xl 1536`. Design mobile-first; verify at 375, 768, 1024, 1440, 1920.

### 4.6 Iconography
One custom thin-stroke (1.25px) SVG icon set as React components in `src/components/icons/` — search, bag, heart, account, store, close, chevrons, plus, minus, filter, zoom, truck, return, check. 20/24px sizes.

---

## 5. ARCHITECTURE

```
src/
  app/
    (storefront)/
      page.tsx                         # Home
      [department]/page.tsx            # Department landing (women, men, ...)
      [department]/[...category]/page.tsx  # PLP
      product/[slug]/page.tsx          # PDP
      search/page.tsx
      collections/[slug]/page.tsx      # Editorial collection / lookbook
      sale/[[...category]]/page.tsx
      stores/page.tsx, stores/[id]/page.tsx
      bag/page.tsx
      checkout/(steps)/...             # shipping, delivery, payment, review
      order-confirmation/[id]/page.tsx
      account/(protected)/...          # overview, orders, returns, addresses, wallet, rewards, wishlist, preferences
      auth/(signin|register|forgot|reset)/page.tsx
      help/[[...slug]]/page.tsx        # FAQ, shipping, returns, size guides
    (admin)/admin/...                  # back office (Section 9)
    api/...                            # webhooks only (payments, search sync)
  components/
    primitives/    # Button, IconButton, Link, Input, Select, Checkbox, Radio, Badge, Chip, Skeleton, Divider, VisuallyHidden
    commerce/      # ProductCard, PriceDisplay, SwatchPicker, SizePicker, FitTabs, QuantityStepper, AddToBag, WishlistButton, Rating
    navigation/    # AnnouncementBar, Header, MegaMenu, MobileNav, Breadcrumbs, Footer, SearchOverlay
    plp/           # FilterRail, FilterDrawer, FacetGroup, ActiveFilters, SortMenu, GridDensityToggle, ProductGrid, PaginationLoadMore
    pdp/           # Gallery, ZoomViewer, ProductInfo, SizeGuideModal, FitFeedback, StoreAvailability, DetailsAccordion, CompleteTheLook, Reviews
    bag/           # BagDrawer, BagLineItem, OrderSummary, PromoCodeField, FreeShippingProgress
    checkout/      # Stepper, AddressForm, DeliveryOptions, PaymentForm, ReviewStep
    editorial/     # HeroBanner, SplitFeature, CategoryTiles, ProductCarousel, LookbookGrid, StoryBlock, PromoStrip
    account/, admin/, feedback/ (Toast, Modal, Drawer, EmptyState, ErrorState)
  lib/
    firebase/ (client.ts, admin.ts), auth/ (session.ts, rbac.ts), data/ (repositories per entity),
    payments/, search/, email/, analytics/, pricing/, inventory/, validation/
  stores/        # bag.ts, wishlist.ts, ui.ts, recentlyViewed.ts
  config/        # brand.ts, navigation.ts, features.ts (feature flags)
  styles/        # tokens.css, globals.css
  types/
```

Rules:
- Server Components fetch data; Client Components only where interactivity is needed. Mark boundaries deliberately.
- All mutations via Server Actions that validate with Zod and authorize via `requirePermission()`.
- Repositories own Firestore access; components never import Firestore directly.
- Cursor pagination (`startAfter`) only. No N+1 reads — denormalize display fields onto product/listing docs.
- Order line items snapshot product name, image, variant, price at purchase time.
- Stock decrement in a Firestore transaction at order placement; reservations expire after 15 minutes.

---

## 6. USERS, ROLES & PRIVILEGES

Implement RBAC with Firebase custom claims (`role`, `permissions[]`) and a single source of truth in `src/lib/auth/rbac.ts`. Enforce in **three places**: middleware (route access), Server Actions (every mutation), Firestore Security Rules (data). UI hides what a role can't do, but security never relies on the UI.

| Role | Who | Key privileges |
|---|---|---|
| `guest` | Anonymous visitor | Browse, search, bag (persisted in localStorage + anonymous session), guest checkout, order lookup by email + order #, email signup |
| `customer` | Registered shopper | Everything guest + saved addresses/payment tokens, order history, self-serve returns, wishlist sync, reviews (verified-purchase badge), preferences, saved sizes |
| `loyalty_member` | Customer enrolled in rewards (tiers: Core / Enthusiast / Icon — rename freely) | Points earning per currency unit, tier benefits (free shipping thresholds, early access, birthday reward), points/rewards redemption at checkout, rewards history |
| `customer_service` | Support agent | Search customers/orders, view order timeline, issue refunds up to a configured limit, approve returns, add order notes, resend emails, place orders on behalf of a customer (audited). No catalog or pricing edits |
| `merchandiser` | Catalog & content team | Create/edit products, variants, images, categories, collections, homepage/editorial modules, sort/merch rules on PLPs, badges. Cannot change prices on live products without `pricing_manager` approval |
| `pricing_manager` | Promotions team | Prices, markdowns, promo codes, automatic promotions, gift-card issuance |
| `inventory_manager` | Ops | Stock levels per location, store inventory, low-stock thresholds, pre-orders/backorders |
| `fulfillment` | Warehouse/ops | Order pick/pack/ship status, tracking numbers, return receipt & inspection |
| `vendor` *(optional, feature-flagged)* | Store owner on the marketplace | Manage own products/stock/orders only (scoped by `vendorId` in rules), own payouts & analytics |
| `admin` | Store admin | Everything above + user management (except super_admin), settings, shipping/tax rules, reports |
| `super_admin` | Owner | Everything, including role assignment, payment/integration keys, audit log export |

Requirements:
- Permission strings are granular (`orders.refund`, `catalog.write`, `pricing.write`, `users.assign_role`, …); roles are bundles of permissions.
- Every privileged action writes to `auditLogs` (actor, role, action, target, before/after diff, timestamp, IP).
- Refund limits and approval thresholds configurable in admin settings.
- Role assignment UI available only to `admin`/`super_admin`; an admin cannot elevate themselves.
- Write Firestore rules tests (`@firebase/rules-unit-testing`) for every role × collection × operation.

---

## 7. STOREFRONT FEATURES (FULL PARITY CHECKLIST)

### 7.1 Global shell
- **Announcement bar:** rotating promo messages (CMS-driven), dismissible, with link and optional countdown.
- **Header:** logo left/centre, department nav, search, store locator, account, wishlist, bag with live count. Sticky on scroll-up, hides on scroll-down; compact variant after 80px.
- **Mega menu (desktop):** opens on hover-intent (150ms delay) and keyboard; columns for categories, fit families, featured collection image tile; closes on Escape/outside click.
- **Mobile nav:** full-height drawer, drill-down panels per department, recently viewed, account shortcuts.
- **Search overlay:** instant results as you type (debounced 150ms), suggested queries, category suggestions, top 4 product hits with image + price, recent searches, "no results" fallback with popular categories. Typo tolerance and synonyms configured in search index.
- **Footer:** link columns (help, about, account, stores), email signup with consent, social links, country/currency selector, legal links, payment method icons (generic, self-drawn).
- **Email/SMS signup modal:** delayed trigger (time or scroll-depth), frequency-capped, never on checkout.
- **Cookie consent** with category toggles; analytics only after consent.

### 7.2 Home & editorial pages (CMS-driven module system)
Build a typed module registry so merchandisers compose pages from blocks without code:
`HeroBanner` (image/video, overlay copy, 1–2 CTAs, focal-point-aware cropping per breakpoint) · `SplitFeature` · `CategoryTiles` · `ProductCarousel` (manual or rule-based) · `LookbookGrid` (shoppable hotspots) · `StoryBlock` · `PromoStrip` · `ShopTheLook`.
Each module: schema (Zod), admin editor form, preview, scheduling (start/end dates), audience targeting (guest / member / tier).

### 7.3 Product listing page (PLP)
- Breadcrumbs, category title, optional editorial header banner, product count.
- **Filters:** category, size (grouped by size type: alpha, numeric, waist/inseam, shoe), fit family (Regular/Petite/Tall), colour family (swatch chips), price ranges, material, sleeve/length/rise/style attributes per category, sale/new, availability (in stock online / in store near me).
  - Desktop: left rail with collapsible groups. Mobile: full-screen filter drawer with "Show N results" live count.
  - Multi-select within a group (OR), AND across groups; state in URL query params (shareable, back-button safe).
  - Active-filter chips with individual remove + "Clear all".
- **Sort:** featured (merch rules), newest, price low→high, high→low, best sellers, top rated.
- **Grid density toggle:** 2/3/4 columns desktop, 1/2 mobile; persisted per user.
- **Pagination:** "Load more" with count ("Showing 48 of 312") plus SSR'd paginated URLs for SEO; restore scroll position on back.
- **In-grid editorial tiles** inserted at configured positions.

### 7.4 Product card
- 3:4 image ratio; primary image → alternate image crossfade on hover (desktop) / swipeable mini-carousel (mobile).
- Colour swatches under image (max 5 + "+N"); hovering/tapping a swatch swaps card image and PDP link to that colour.
- Badges: New, Online Exclusive, Low Stock, Sale %, Final Sale, Back in Stock (priority-ordered, max 1 visible).
- Name, price (regular / sale with strike-through and % off / price range across variants), rating stars + count.
- Quick-add: on hover (desktop) shows size buttons; selecting a size adds to bag and opens bag drawer. Quick view modal optional via feature flag.
- Wishlist heart toggle (optimistic, animated, accessible label).

### 7.5 Product detail page (PDP)
- **Gallery:** desktop = 2-column vertical image stack beside a sticky info column; mobile = full-width swipe carousel with dots and counter. Supports images + short video. Click opens full-screen zoom viewer (pinch/scroll zoom, pan, thumbnails, keyboard arrows).
- **Info column:** breadcrumbs, name, price block, rating summary (jump link to reviews), promo messaging, colour selector (swatch + colour name, updates gallery and URL `?color=`), fit tabs (Regular / Petite / Tall — each with own size run and availability), size selector (unavailable sizes crossed out but clickable for "Notify me when back in stock"), size-guide modal (measurement tables per category + "how to measure" illustration), fit feedback summary ("Runs true to size" from reviews), quantity stepper, **Add to Bag** (validates size; inline error, not alert), wishlist, inventory messaging ("Only 3 left").
- **Fulfilment options:** ship to home (delivery estimate by postcode), buy online pick up in store (store picker modal with availability per store), free-shipping threshold message.
- **Details accordions:** description, fit & sizing (model height/size worn), fabric & care, shipping & returns.
- **Complete the look / Shop the outfit:** curated items with quick add.
- **Recommendations:** "You may also like", "Recently viewed".
- **Reviews:** aggregate rating, rating distribution, fit slider aggregate (runs small ↔ large), filter by rating/size/fit, sort, review photos, helpful votes, verified-purchase badge, write-a-review form (customer only, moderated).
- **Sticky mobile Add-to-Bag bar** when the main button scrolls out of view.
- Structured data: `Product`, `Offer`, `AggregateRating`, `BreadcrumbList` JSON-LD.

### 7.6 Bag
- **Bag drawer** (slides from right) on add: added item confirmation, line items, subtotal, free-shipping progress bar, "Checkout" and "View bag".
- **Bag page:** edit size/colour/qty inline, remove, move to wishlist, save for later, promo code field (with error/success states and stacking rules), gift card/rewards redemption, order summary (subtotal, discounts, estimated shipping, estimated tax, total), recommendations, persistent across devices for signed-in users (merge guest bag on sign-in).
- Price and stock re-validated server-side on every bag load.

### 7.7 Checkout
- Separate minimal layout (no mega menu, no footer distractions).
- Entry: sign in, continue as guest, or express pay (Apple Pay/Google Pay via Stripe when enabled).
- Steps: **Shipping address** (address autocomplete, saved addresses) → **Delivery method** (standard/express/pickup in store with dates and costs) → **Payment** (card via provider-hosted fields, gift card, rewards, COD where enabled, billing address) → **Review & place order**.
- Desktop: steps left, order summary sticky right. Mobile: collapsible order summary at top.
- Inline Zod validation, clear error recovery, no data loss on refresh (step state persisted).
- Idempotent order placement (idempotency key), inventory transaction, payment intent confirmation via webhook, order confirmation page + email.

### 7.8 Account
Overview dashboard · Orders (list, detail, tracking timeline, invoice download, reorder) · Returns (start return: pick items + reason → label/QR or drop-off instructions; status tracking; refund to original payment or store credit) · Addresses · Payment methods (tokenised only) · Rewards (tier, points balance, progress to next tier, history, available rewards) · Wishlist (move to bag, share list, price-drop indicators) · Saved sizes / preferences (fit family, sizes per category used to pre-select on PDP) · Communication preferences · Security (password, sessions, delete account / data export).

### 7.9 Other
- Guest order lookup · Store locator (map, list, filters, hours, store detail with services) · Gift cards (buy e-gift card, check balance) · Help centre (FAQ search, shipping, returns policy, size guides) · Back-in-stock and price-drop notifications · Recently viewed (local + synced) · 404/500 pages in brand style.

---

## 8. DATA MODEL (Firestore)

Define TypeScript types + Zod schemas for each, and composite indexes in `firestore.indexes.json`.

`products` (styleId, slug, name, description, department, categoryPath[], attributes{}, fitFamilies[], colors[{code, name, family, swatchUrl, images[], video?}], priceRange, badges[], ratingAvg, ratingCount, status draft|scheduled|live|archived, seo{}, searchKeywords[]) ·
`variants` (sku, productId, color, fitFamily, size, price, compareAtPrice, barcode, weight, stockByLocation{}, availableOnline) ·
`categories` (tree with path, merch rules, banner) · `collections` · `pages` & `modules` (CMS) ·
`users` (profile, role, loyalty{tier, points}, preferences, savedSizes) · `users/{uid}/addresses`, `/paymentMethods` (provider tokens only), `/wishlist` ·
`carts` · `orders` (snapshotted lines, totals, payments[], shipments[], status history) · `returns` · `reviews` · `promotions` & `promoCodes` · `giftCards` · `stores` · `inventoryReservations` · `notifications` · `auditLogs` · `settings`.

---

## 9. BACK OFFICE (`/admin`)

Same component system, denser "admin" density variant. Every screen permission-gated per Section 6.
- **Dashboard:** revenue, orders, AOV, conversion, top products, low stock, pending returns (Recharts).
- **Catalog:** product list with bulk actions and CSV import/export; product editor (variants matrix by colour × fit × size, drag-to-reorder images per colour, focal point picker, SEO fields, schedule publish, preview link).
- **Categories & merchandising:** category tree editor, pin/boost/bury products, sort rules.
- **Content:** page/module builder for home and editorial pages with scheduling, targeting and live preview.
- **Pricing & promotions:** markdowns, % / fixed / BOGO / tiered / free-shipping promotions, code generation, usage limits, stacking rules, date windows.
- **Inventory:** per-location stock, adjustments with reason codes, low-stock alerts.
- **Orders:** search/filter, detail with timeline, edit before fulfilment, cancel, refund (limit-checked), resend emails, notes.
- **Returns:** queue, approve/deny, receive & inspect, restock, refund.
- **Customers:** profile, orders, loyalty adjustments (audited), notes.
- **Reviews moderation.**
- **Users & roles:** invite staff, assign roles, revoke sessions.
- **Settings:** shipping zones/rates, tax rules, store locations, loyalty rules, feature flags, integrations.
- **Audit log** viewer with filters and export.

---

## 10. NON-FUNCTIONAL REQUIREMENTS

- **Performance budgets (mobile, 4G):** LCP < 2.0s, INP < 200ms, CLS < 0.05, JS per route < 170KB gz. ISR/static for PLP/PDP with on-demand revalidation from admin saves. `next/image` with AVIF/WebP, correct `sizes`, priority only on LCP image, blur placeholders.
- **Accessibility:** WCAG 2.2 AA. Full keyboard support (mega menu, swatches, size picker as radio groups, carousels, drawers with focus trap and return focus). Visible focus rings. `aria-live` for bag updates and filter result counts. Axe checks in Playwright on every page template = 0 violations.
- **SEO:** metadata API per route, canonical URLs (filters → canonical category), XML sitemaps (products, categories, editorial), robots, hreflang ready, JSON-LD, clean slugs.
- **Security:** CSP headers, CSRF-safe Server Actions, rate limiting on auth/promo/review endpoints, server-side price calculation only, webhook signature verification, no secrets in `NEXT_PUBLIC_*`.
- **Analytics:** typed event layer (`view_item_list`, `select_item`, `view_item`, `add_to_cart`, `begin_checkout`, `add_payment_info`, `purchase`, `refund`) consent-gated.
- **Resilience:** error boundaries per route segment, skeleton loaders matching final layout dimensions, empty/error states for every list.

---

## 11. EXECUTION PHASES

Each phase ends with: typecheck ✔ lint ✔ unit tests ✔ build ✔ → print `✅ PHASE N COMPLETE` + what was built + any decisions logged.

**PHASE 0 — Audit & setup**
Read `AGENTS.md` and the Next.js 16 docs in `node_modules/next/dist/docs/`. Inspect the scaffold, remove the starter page and starter SVGs, move to the `src/` layout in Section 5 (update `tsconfig` paths). Replace the Geist fonts with the Section 4.2 fonts. Confirm design mode (Section 2). Configure TS strict, ESLint, Prettier, Husky, Tailwind with token variables, `next/font`, Firebase client/admin, emulators, env validation (Zod), CI workflow. Create `docs/DECISIONS.md`, `docs/FEATURE_PARITY.md`, `docs/CONTRAST.md`.

**PHASE 1 — Design system & primitives**
Tokens, typography, icons, all `primitives/` with variants and states (default/hover/focus/active/disabled/loading/error). Build a `/styleguide` route (dev-only) rendering every component and state. Visual regression baselines captured.

**PHASE 2 — Data layer, auth & RBAC**
Types, Zod schemas, repositories, Firestore rules + rules tests, indexes, session cookies, middleware, `requirePermission()`, audit logging, seed script (≥ 120 products across 2 departments, 12 categories, 3 fit families, realistic variants and stock, 3 stores, sample reviews, promotions, users for every role).

**PHASE 3 — Global shell**
Announcement bar, header, mega menu, mobile nav, search overlay + index sync function, footer, consent, signup modal.

**PHASE 4 — Catalog browsing**
Home module system, department landing, PLP with filters/sort/density/pagination/URL state, product card with swatches/quick add/wishlist, collections, sale.

**PHASE 5 — PDP**
Gallery + zoom, selectors (colour/fit/size), size guide, fulfilment options, store availability, accordions, complete the look, recommendations, reviews (read + write + moderation queue), sticky mobile bar, JSON-LD.

**PHASE 6 — Bag & checkout**
Bag store + server sync + guest merge, drawer, bag page, promotions engine (pure, unit-tested pricing functions), checkout steps, payment adapters, webhooks, inventory transactions, confirmation page + emails.

**PHASE 7 — Account, loyalty & post-purchase**
All account sections, loyalty points/tiers engine, returns flow, order tracking, notifications (back in stock, price drop), guest order lookup, store locator, gift cards, help centre.

**PHASE 8 — Back office**
All Section 9 modules with permission gating and audit logging.

**PHASE 9 — Hardening**
Performance pass against budgets (report before/after), a11y pass (axe = 0), SEO pass, security headers, Playwright E2E suite covering: guest purchase, member purchase with rewards, promo code, BOPIS, return, CS refund within/over limit, merchandiser publish, role-denied access for every restricted route.

**PHASE 10 — Final QA & handover**
Visual regression at 375/768/1024/1440 for every template. Update `docs/FEATURE_PARITY.md` to 100% or list deliberate exclusions with reasons. Write `README.md` (setup, env vars, scripts, deploy) and `docs/ARCHITECTURE.md`. Print the final report: features shipped, test counts, Lighthouse scores, known limitations.

---

## 12. COMPONENT QUALITY BAR (apply to every component)

- Typed props, sensible defaults, `className` passthrough via `cn()`, forwardRef where it renders a DOM element users may need to focus.
- Variants via `cva`, never ad-hoc conditional class strings.
- All interactive states designed; loading and error states included.
- Accessible name, role and keyboard behaviour verified.
- Responsive at every breakpoint; no horizontal scroll at 320px.
- Co-located test for logic-bearing components.
- No hardcoded colours, sizes or fonts — tokens only.

---

## 13. DEFINITION OF DONE

- Every item in Section 7 implemented and ticked in `docs/FEATURE_PARITY.md`.
- Every role in Section 6 enforced in middleware, Server Actions and Firestore rules, with passing tests.
- Zero TypeScript errors, zero ESLint errors, zero axe violations, zero `TODO`/`FIXME`.
- Performance budgets met on PLP and PDP.
- No third-party brand assets, copy or code anywhere in the repo (run a final grep for the benchmark brand's name and confirm 0 hits).

**Begin with PHASE 0 now.**
