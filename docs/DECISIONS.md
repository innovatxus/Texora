# Decision log

Each entry records what we decided, why, and what it affects. Newest last.

## D-001 — Design mode: Standalone, ATELIER tokens

**Date:** 2026-10-19 · **Phase:** 0
We build against the ATELIER token set from the build brief (Section 4) rather than an external design source. Tokens live in `src/styles/tokens.css` inside `@theme`, so Tailwind generates utilities from them and emits each as a CSS variable. Tailwind's default colour, radius, shadow and font scales are cleared (`--color-*: initial` etc.), so only tokens can be used in class names.

## D-002 — Brand name: Texora

**Date:** 2026-10-19 · **Phase:** 0
`[PLATFORM_NAME]` resolves to **Texora**, defined once in `src/config/brand.ts`. All UI reads from that module.

## D-003 — `ink-subtle` darkened from #7A756F to #6E6963

**Date:** 2026-10-19 · **Phase:** 0
The brief's `#7A756F` measures 4.31:1 on `canvas` and 3.91:1 on `surface-muted`, both below the 4.5:1 AA requirement the brief itself mandates. `#6E6963` keeps the same warm hue and passes on every surface (5.13 / 5.44 / 4.66). See `docs/CONTRAST.md`; CI fails if a pair regresses.

## D-004 — Next.js 16 `proxy.ts` instead of `middleware.ts`

**Date:** 2026-10-19 · **Phase:** 0
Next.js 16 deprecates the `middleware` file convention in favour of `proxy` (same capabilities, renamed file and export). Wherever the brief says "middleware" (route access, session checks), we implement it in `src/proxy.ts`.

## D-005 — Cache Components and Partial Prefetching stay enabled

**Date:** 2026-10-19 · **Phase:** 0
The scaffold ships with `cacheComponents: true` and `partialPrefetching: true`. Both become the default in the next major, so we build on them from day one: data is cached explicitly with `"use cache"` and `cacheTag`, URL-dependent UI (filters, `?color=`) sits behind `<Suspense>`, and admin saves revalidate by tag. This replaces the brief's "ISR" wording with the Cache Components equivalent.

## D-006 — Linting runs through ESLint directly

**Date:** 2026-10-19 · **Phase:** 0
`next lint` was removed in Next.js 16 and `next build` no longer lints. `npm run lint` runs `eslint --max-warnings=0 .`, and CI runs it as its own step. Strict rules added on top of `eslint-config-next`: no `any`, no non-null assertions, consistent type imports, no `TODO`/`FIXME` comments, `eqeqeq`.

## D-007 — Local development uses Firebase emulators with a `demo-` project

**Date:** 2026-10-19 · **Phase:** 0
The project ID `demo-texora` puts the emulators in offline demo mode: no real Firebase project or credentials are needed. `.env.example` holds working emulator defaults. Switching to a real project means only changing env vars and supplying `FIREBASE_SERVICE_ACCOUNT` (base64 JSON), which env validation requires in production when emulators are off.

## D-008 — Third-party services

**Date:** 2026-10-19 · **Phase:** 0
Search: **Algolia**. Payments: **Stripe** (test mode) behind the `PaymentProvider` interface, plus Cash-on-Delivery. Email: **Resend** with React Email templates. Every key is an environment variable; SDKs and env schema entries are added in the phase that first uses them (Algolia: Phase 3, Stripe/Resend: Phase 6), so no unused config ships early.

## D-009 — Env validation with Zod, split client/server

**Date:** 2026-10-19 · **Phase:** 0
`src/lib/env/schema.ts` holds pure schemas (unit-tested). `client.ts` lists each `NEXT_PUBLIC_*` variable explicitly so Next.js can inline it. `server.ts` imports `server-only`, so importing secrets into a Client Component fails the build.

## D-010 — Fonts: Cormorant Garamond (display) + Inter (UI)

**Date:** 2026-10-19 · **Phase:** 0
Both are open-licence and loaded via `next/font/google` (self-hosted at build time, `display: swap`, Latin subset). Cormorant loads only weights 400/500; Inter is a variable font. Exposed to Tailwind as `font-display` and `font-sans`.

## D-011 — Starter favicon replaced

**Date:** 2026-10-19 · **Phase:** 0
The `create-next-app` favicon is a third-party mark, which the brief forbids. Replaced with a self-drawn Texora "T" monogram at `src/app/icon.svg`.

## D-012 — Node.js ≥ 22.12 required for the test toolchain

**Date:** 2026-10-19 · **Phase:** 0
Vitest 5 / Vite 8 and jsdom 30 depend on loading ES modules through `require()`, which Node only supports without a flag from 22.12. `package.json` `engines` requires it; CI uses `.nvmrc` (see D-023).

## D-013 — `firebase-tools` audit warnings accepted (dev only)

**Date:** 2026-10-19 · **Phase:** 0
`npm audit` reports advisories in transitive dependencies of `firebase-tools` (for example `uuid` via `gaxios`). It is a local CLI for the emulators and never ships in the app bundle. The only fix offered is a downgrade to an older major. Re-check on each `firebase-tools` release.

## D-014 — Deferred stack items

**Date:** 2026-10-19 · **Phase:** 0
`next-intl` (i18n), Sentry and Web Vitals reporting are part of the stack but are installed when first needed (shell in Phase 3, observability in Phase 9), keeping Phase 0 limited to tooling the later phases build on.

## D-015 — lint-staged pinned to v16 (local Git 2.31)

**Date:** 2026-10-19 · **Phase:** 0
lint-staged 17 refuses to run on Git older than 2.32, and this machine has 2.31 (the in-place Git upgrade needs every Git Bash process closed). v16 has no version gate and works. Upgrade Git, then lift the pin.

## D-016 — React 19 `ref` as a prop instead of `forwardRef`

**Date:** 2026-10-19 · **Phase:** 1
The brief asks for `forwardRef` on focusable components. React 19 passes `ref` as an ordinary prop and is phasing `forwardRef` out. Primitives extend `ComponentProps<"element">`, which includes `ref`, and spread it onto the DOM node, so the brief's intent (consumers can focus the element) is met without the deprecated API.

## D-017 — Native `<select>` for form selects

**Date:** 2026-10-19 · **Phase:** 1
`Select` wraps the native element: it keeps the platform picker on mobile, needs no JavaScript, and has full keyboard and screen-reader support. Radix Select stays allowed for custom listboxes that need rich option content (for example the PLP sort menu) and is added when one is built.

## D-018 — Control borders use `ink-subtle`, not `line`

**Date:** 2026-10-19 · **Phase:** 1
WCAG 1.4.11 requires 3:1 for the boundary of a control. `line` (#DDD7CF) is about 1.3:1 on canvas, so inputs, selects, checkboxes, radios and outline icon buttons use `ink-subtle` (5.13:1) and darken to `ink` on hover/focus. `line` remains for decorative hairlines and disabled controls.

## D-019 — Radios are circular; `sale` doubles as the error colour

**Date:** 2026-10-19 · **Phase:** 1
The sharp-corner rule has one exception: radios stay round, because shape is how people tell single from multiple choice. The token set has no separate error colour, so error text and invalid borders use `sale` (7.27:1 on canvas).

## D-020 — Styleguide gated by `ENABLE_STYLEGUIDE`

**Date:** 2026-10-19 · **Phase:** 1
The brief says the styleguide is dev-only, but Playwright must test a production build. `/styleguide` therefore renders only when the server env flag `ENABLE_STYLEGUIDE=true` (set in `.env.example` for local and CI); otherwise it returns 404. It is also `noindex, nofollow`. Production deployments leave the flag unset.

## D-021 — Visual baselines are stored per OS

**Date:** 2026-10-19 · **Phase:** 1
Font rasterisation differs between Windows, macOS and Linux, so one set of PNGs cannot serve every machine. Snapshots live under `e2e/__screenshots__/{platform}/{viewport}/`. Windows baselines are committed from local runs. Linux baselines for CI are produced by the manual `visual-baselines.yml` workflow and committed after review; until they exist, CI runs every e2e test except `@visual`.

## D-022 — Motion tokens use Tailwind's duration namespace

**Date:** 2026-10-19 · **Phase:** 1
Durations are declared as `--transition-duration-{fast,base,drawer,slow}` so Tailwind generates `duration-fast` etc. directly from the tokens; the default transition duration and easing are set to the ATELIER values.

## D-023 — CI pinned to ubuntu-24.04 and the local Node version

**Date:** 2026-10-19 · **Phase:** 1
The first CI run failed in `npm ci` on the day `ubuntu-latest` began moving to Ubuntu 26. CI now pins `ubuntu-24.04` and reads Node from `.nvmrc` (24, the version used locally, whose bundled npm 11 wrote the lockfile). Actions moved to their current majors (checkout/setup-node/upload-artifact v7, cache v6) after GitHub's Node 20 runtime deprecation. Move to a newer image deliberately, in its own PR.

## D-024 — Custom claims carry only `role`; permissions are derived

**Date:** 2026-10-19 · **Phase:** 2
The brief suggests claims with `role` and `permissions[]`. Firebase caps custom claims at 1000 bytes, and the admin bundle alone exceeds that as a string array. Claims therefore carry `role` (plus `vendorId` for vendors). Every enforcement point derives permissions from `src/lib/auth/rbac.ts`: the proxy and Server Actions import it, and `npm run rules:generate` writes the role → permission map into `firestore.rules`. Changing a role's bundle is one edit, and CI fails if the generated rules are stale.

## D-025 — Three enforcement points, permission-based everywhere

**Date:** 2026-10-19 · **Phase:** 2

1. **Proxy** (`src/proxy.ts`): optimistic route gate for `/account` and `/admin/*` from `ROUTE_PERMISSIONS`; redirects signed-out users to sign-in with a safe `next`, rewrites to a 403 page otherwise. Skips the revocation round trip for speed.
2. **Server Actions**: every mutation goes through `runAction()` (Zod → `requirePermission()` with revocation check → handler → typed result). Pages use `requirePagePermission()`, which renders `forbidden()` / `unauthorized()` (`experimental.authInterrupts`).
3. **Firestore rules**: check permissions, never role names. Own-data rules also require the matching permission, so an unrecognised role claim gets no access at all (found by the rules matrix).

## D-026 — Merchandiser price changes go through approval requests

**Date:** 2026-10-19 · **Phase:** 2
"Merchandisers cannot change prices on live products without pricing_manager approval" is modelled as a `priceChangeRequests` collection: merchandisers create pending requests, pricing managers approve or reject them, and only `pricing.write` may change variant prices or the denormalised `priceRange`. Stock, price and catalog fields on a variant are separate permission scopes, and a single update cannot mix them.

## D-027 — Money in minor units; Firestore-safe shapes

**Date:** 2026-10-19 · **Phase:** 2
All prices are integers in cents. Products denormalise `categoryKeys` (`["women", "women/jeans"]`) so category listings are exact `array-contains` queries; this also avoids nested arrays, which Firestore rejects (the seed caught a `string[][]` promotion condition). Gift cards store a SHA-256 of the code, never the code.

## D-028 — Session cookies

**Date:** 2026-10-19 · **Phase:** 2
Firebase session cookies named `__session` (the only cookie Firebase Hosting forwards), HTTP-only, `SameSite=Lax`, `Secure` in production, 5-day lifetime, minted only from a sign-in under 5 minutes old. Anonymous auth is used for guest carts but never gets a session cookie. A user profile with role `customer` is created on first sign-in.

## D-029 — Test layers

**Date:** 2026-10-19 · **Phase:** 2

- `npm test`: unit tests (Vitest, jsdom), no emulators.
- `npm run test:rules`: the Firestore rules matrix, every case × 13 personas (950 checks), expected outcomes derived from `rbac.ts`.
- `npm run test:integration`: repositories, sessions, role assignment and audit logging against seeded emulators (seeded with the same writer as `npm run seed`).
- `npm run e2e`: Playwright against a production build.
  All four run in CI.

## D-030 — Placeholder imagery paths

**Date:** 2026-10-19 · **Phase:** 2
Seeded products reference `/media/placeholders/{garment}-{colour}-{view}.svg`. Phase 4 generates those self-drawn SVGs into `public/media` (no third-party imagery), so the data contract is fixed now.

## D-031 — UI first, functionality second

**Date:** 2026-10-19 · **Phase:** 3
At the owner's request the remaining phases are reordered: every screen is built first (shell, catalog, PDP, bag/checkout, account, back office) against the real seeded data, then the functional integrations follow (Algolia, promotions engine, payments, order placement, email, returns, loyalty, admin mutations). Phase numbers in this log keep the brief's numbering; the build order is the owner's.

## D-032 — In-process search until Algolia is connected

**Date:** 2026-10-19 · **Phase:** 3
The search overlay calls a `suggest` Server Action backed by a pure, unit-tested matcher (`src/lib/search/match.ts`): AND matching, prefix on the last word, one-typo tolerance on 4+ letter words, plural stemming and retail synonyms, over a cached index of live products. It is real search over real data, sized for the current catalogue; the Algolia adapter replaces the action without UI changes.

## D-033 — Generated placeholder imagery

**Date:** 2026-10-19 · **Phase:** 3
`npm run placeholders` (run automatically before `dev` and `build`) draws 532 original SVG illustrations (8 garments × 22 colours × 3 views, plus editorial tiles) into `public/media/placeholders`, which is git-ignored. No third-party imagery. Product alt text describes the view honestly ("front view", "flat lay", "fabric detail").

## D-034 — Browser state through useSyncExternalStore

**Date:** 2026-10-19 · **Phase:** 3
Values from localStorage, sessionStorage, cookies and the clock are read with `useSyncExternalStore` (`src/lib/browser/hooks.ts`) instead of set in effects: no hydration mismatch, no extra render, and same-tab writes notify subscribers. Persisted Zustand stores (bag, recently viewed) hydrate after mount via `StoreHydration`.

## D-035 — Focus restoration for store-driven panels

**Date:** 2026-10-19 · **Phase:** 3
Radix Dialog returns focus only to its own `Trigger`. Drawers and modals here are opened from anywhere through the UI store, so `Drawer` and `Modal` record the focused element on open and restore it on close (caught by the shell e2e suite).

## D-036 — CMS module registry

**Date:** 2026-10-19 · **Phase:** 4
Pages (`pages/{slug}` in Firestore) are ordered lists of typed modules: hero, promo strip, category tiles, product carousel (manual or rule-based), split feature, story block, lookbook (shoppable hotspots) and shop-the-look. `src/lib/cms/modules.ts` holds one Zod schema per type in a discriminated union, so a malformed module never reaches a page. Pages are cached for minutes so schedule windows open and close without a deploy. Modules targeted at members or loyalty tiers render behind `<Suspense>` after a session check, so the rest of the page stays static. Heroes are art-directed: separate mobile and desktop crops positioned by focal point.

## D-037 — Listing engine and URL state

**Date:** 2026-10-19 · **Phase:** 4
`src/lib/catalog/listing.ts` (pure, unit-tested) owns filter parsing, faceting, sorting and paging. Filters are OR within a group and AND across groups; each facet counts results with every other active filter applied. All state is in the URL (shareable, back-button safe); filtered URLs canonicalise to the unfiltered listing. "Load more" links to `?page=N`, which renders the first N pages, so it is crawlable and the browser restores scroll on back. It runs over a cached index of live products joined with variant stock (a projection read, not full documents). The Algolia adapter replaces the index without UI changes.

## D-038 — Builds need seeded data

**Date:** 2026-10-19 · **Phase:** 4
Catalog pages are partially prerendered from Firestore, so `npm run build` (and `npm run verify`) need the emulators running and seeded locally (`npm run emulators`, `npm run seed`). CI and the baseline workflow wrap seed + build + e2e in `firebase emulators:exec`. Production builds read the real project.

## D-039 — HTTP status with Partial Prerendering

**Date:** 2026-10-19 · **Phase:** 4
With PPR, a dynamic route's prerendered fallback shell is sent with status 200 before page code runs, so `notFound()` cannot change the status. Two measures:

1. The proxy answers 404 for any unknown first path segment, using an allow-list (`src/config/routes.ts`) that a unit test keeps in sync with the folders in `src/app`.
2. Listing routes validate their params before streaming (`instant = false`), so every known URL is prerendered and errors surface early.

**Known limitation:** an unknown category inside a valid department (e.g. `/women/xyz`) returns 200 in production with the branded not-found page and `noindex`. Revisit in the Phase 9 SEO pass (for example by teaching the proxy the category list).

## D-040 — Reserved filter keys

**Date:** 2026-10-19 · **Phase:** 4
A product attribute named `fit` (slim/standard) collided with the fit-family filter in both facets and URLs. The attribute is now `cut`, and `RESERVED_FILTER_KEYS` plus a seed test stop any attribute from reusing a built-in filter key.

## D-041 — Touch targets in dense filters

**Date:** 2026-10-19 · **Phase:** 4
Axe (WCAG 2.2, SC 2.5.8) flagged 18px filter checkboxes and their spacing to the accordion headers. Checkboxes are now 20px with 12px row gaps and top padding, so every target has a clear 24px zone. Quick-add panels are height-capped so they never cover the wishlist button.

## D-042 — Product page rendering

**Date:** 2026-10-19 · **Phase:** 5
Every live product page (132) is fully prerendered for its default colour. `?color=` is URL data, so the buy box reads it on the client inside a Suspense boundary whose fallback is the same component in the default colour. Choosing a colour updates the URL with `history.replaceState`: shareable, no server round trip. Variant, stock, delivery-estimate and review-summary logic is pure and unit-tested (`variant-selection.ts`). Pickers are native radio groups, so arrow-key navigation and group semantics come from the platform. Unknown product slugs share the PPR soft-404 limitation in D-039 (branded not-found page with `noindex`).

## D-043 — Hydration readiness in tests

**Date:** 2026-10-19 · **Phase:** 5
Static HTML is visible before React hydrates, and Suspense boundaries hydrate separately from the root. End-to-end tests therefore wait for `html[data-hydrated]` (root) and, on product pages, for the buy box's own `data-interactive` marker (set via `useHydrated()`, no effect). Playwright uses half the CPU cores locally so the server and hydration aren't starved.

## D-044 — Delivery only, no store pickup

**Date:** 2026-10-19 · **Phase:** 6
At the owner's request, Texora does not offer buy-online-pick-up-in-store. Delivery methods are `standard` and `express` only, across the PDP, the pricing engine, the bag and order schemas, checkout and confirmation. A shipping address is therefore always required, and online orders reserve only `online` stock. Stores keep their per-location stock and services (returns, alterations, styling) for the store locator.

## D-045 — Bag clearing after an order

**Date:** 2026-10-19 · **Phase:** 6
The bag is cleared by the confirmation page (`ClearAfterOrder`), not before navigating away from review: clearing first tripped the checkout's empty-bag guard and redirected to `/bag` mid-navigation.

## D-046 — Guest access to orders by signed link

**Date:** 2026-10-19 · **Phase:** 7
Guests reach their order, return and gift card pages through HMAC-signed links (`signToken(purpose, id)`), from checkout, email or the order lookup (order number + email, both required, with one error message for any mismatch). The purpose is part of the signature, so an order link can't open a gift card purchase or an unsubscribe action. Signed-in owners and staff with `orders.read` get in without a token. These pages render at request time (`connection()`) inside Suspense.

## D-047 — Returns are approved automatically within policy

**Date:** 2026-10-19 · **Phase:** 7
A return request inside the policy (shipped, within 30 days of delivery or of the latest estimate, not final sale, units not already returned) is approved immediately with a prepaid label or an in-store drop-off code; both carry a QR code of the return number. The check runs in a Firestore transaction that reads the order's existing returns, so two tabs can't return the same units. The refund estimate is the discounted unit price, rounded down; shipping is not refunded. Receiving, inspection and refunds happen in the back office (Phase 8). Email images use a signed PNG route because mail clients block `data:` URLs.

## D-048 — Store locator without a map

**Date:** 2026-10-19 · **Phase:** 7
No maps key is configured, so the locator ships as a list with text search, service filters and "use my location" distance sorting (browser geolocation, computed on the device), plus OpenStreetMap directions links. Open/closed status is computed in the browser in each store's time zone so the pages stay fully static. A map can be added when a provider key is chosen.

## D-049 — E-gift cards are issued on delivery, not at purchase

**Date:** 2026-10-19 · **Phase:** 7
E-gift cards are bought outside the bag (card payment only) as a `giftCardPurchases` record. The Stripe webhook marks it paid; on the delivery date (immediately, or via the hourly cron) the card is created and its code emailed to the recipient. Only the code's hash is stored, so the code never exists at rest. If the email fails, the card is disabled and the purchase returns to "paid" for a fresh code on the next run. Locally, without Stripe keys, the form explains that card payments are unavailable.

## D-050 — Account creation moved to the final phase

**Date:** 2026-10-19 · **Phase:** 7
At the owner's request, sign-in, registration and all account pages are built in the final phase. Phase 7 delivers the guest versions of post-purchase features and the server pieces accounts will use: points are credited to members once per order (`loyaltyCreditedAt`) with a ledger in `users/{uid}/loyaltyLedger`. Header and footer account links stay in place and resolve when that phase lands. The order confirmation page offers "Track this order" instead of account creation until then.

## D-051 — Product alerts fire once

**Date:** 2026-10-19 · **Phase:** 7
Back-in-stock and price-drop alerts are `pending` until their condition is met (online stock above zero; lowest price below the price when subscribing, read on the server), then sent once and marked `sent`. The hourly `api/cron/notifications` job processes them. "Stop these emails" links are signed per email address and require a button press, so mail scanners can't unsubscribe people.

## D-052 — Staff sign-in ahead of customer accounts

**Date:** 2026-10-20 · **Phase:** 8
The back office needs signed-in staff, so the sign-in page is built now: Firebase checks the password in the browser, the ID token becomes an HTTP-only session cookie, and the browser's Firebase session is dropped. Staff land in `/admin`; anyone else goes to the home page until account pages arrive in the final phase (D-050). Registration, password reset and account pages stay deferred.

## D-053 — How refunds move money

**Date:** 2026-10-20 · **Phase:** 8
A refund is checked (amount left, agent limit), then paid back in a fixed order: card (through the payment provider, with an idempotency key, before anything is written), then gift card balance, then rewards points; anything left (pay on delivery) is recorded as a manual refund for the team to pay back. The transaction then re-checks the amount, restores balances, reverses loyalty points earned on the refunded share and writes the audit log. The customer service limit counts every refund on the order, not just the current one. Cancelling an unshipped order refunds what was collected and returns the stock.

## D-054 — No line-item edits after ordering

**Date:** 2026-10-20 · **Phase:** 8
Orders are snapshots: changing items after payment would need re-authorising the card and re-pricing promotions. Instead, staff cancel (before shipping) or refund (partially or fully) and the customer places a new order. This keeps every total traceable to what was charged.

## D-055 — Product creation lives in the merchant portal

**Date:** 2026-10-20 · **Phase:** 8
The back office edits existing products (content, SEO, schedule, status, prices, image order). Creating products with a variant builder and uploading images is the core of the merchant portal build (`MERCHANT_PORTAL_BUILD_PROMPT.md`), which also needs the media pipeline; it is queued next and will serve platform staff too, so it isn't built twice.

## D-056 — Content is edited as validated JSON; no draft preview

**Date:** 2026-10-20 · **Phase:** 8
Each module's content is edited as JSON in the page builder and validated against its Zod schema on save, so a bad edit can never break the storefront. Order, schedule and audience have proper controls. Previewing unpublished pages and products needs draft mode in every cached storefront query; until then, schedule changes in the future or keep a page in draft.

## D-057 — Tax and integration keys stay in configuration

**Date:** 2026-10-20 · **Phase:** 8
Sales tax uses the state rate table in code, and payment, email and search keys come from environment variables. Editing either in the back office would put secrets in Firestore and let a settings mistake change tax charged; both move with the integrations hardening in Phase 9.

## D-058 — Back office lists read small collections whole

**Date:** 2026-10-20 · **Phase:** 8
Products (about 130), variants (a few thousand), users and categories are read in one query with only the needed fields, then filtered and paged in memory. That keeps search flexible (substring matches Firestore can't do) and fast at this size. Beyond roughly 10,000 documents these screens should query the search index instead. Orders, returns and the audit log use cursor pagination from the start.

## D-059 — Session reads are request-time; access denied uses forbidden()

**Date:** 2026-10-20 · **Phase:** 8
Two production-only issues surfaced once the back office was tested against a build. First, the proxy's rewrite to `/access-denied` with `status: 403` was served as 200, because the prerendered target page set its own status; the page now calls `forbidden()`, which renders `forbidden.tsx` with a real 403 (and Next.js adds `noindex`). Second, a signed-in visitor's prefetch of a static page prerendered the member-targeted CMS modules, and verifying the session cookie read the clock during that pass. `getSession()` (and `createSession()`) now call `connection()`, so any session read is request-time by definition and every caller is covered.

## D-060 — Merchants are not back-office staff

**Date:** 2026-10-20 · **Phase:** Merchant 0
The `vendor` role (shown as "Merchant") inherited `admin.access` and was listed as staff, so a merchant could open `/admin`. It now gets customer permissions plus the vendor and merchant permissions, leaves `STAFF_ROLES`, and lands in `/merchant` after sign-in. The internal name stays `vendor`.

## D-061 — A system actor grants the merchant role at registration

**Date:** 2026-10-20 · **Phase:** Merchant 0
`assignRole` checks that the actor may assign roles, and a self-registering merchant has no such actor. Server code uses a fixed system actor that the policy allows for exactly one change, `customer → vendor` with a `vendorId`, so registration still goes through `assignRole` (claim, profile mirror, session revocation, audit log) without widening anyone's rights.

## D-062 — Merchant catalog writes go through Server Actions only

**Date:** 2026-10-20 · **Phase:** Merchant 0
The rules let vendors write their own products and variants directly, which would skip publish validation, shop denormalisation and counters. Vendors keep read access to their own documents, but every product, variant, shop and location write happens in a Server Action with the Admin SDK. The only client-writable merchant data is the merchant's own `productDrafts` and temporary uploads.

## D-063 — Rate limiting with Firestore fixed windows

**Date:** 2026-10-20 · **Phase:** Merchant 0
There was no rate limiter. `src/lib/security/rate-limit.ts` counts attempts per action and key (hashed IP, email or uid) in fixed windows stored in Firestore, inside a transaction, with documents that expire by TTL. That works across server instances without new infrastructure. Phase 9 hardening can swap the store for Redis behind the same interface.

## D-064 — Merchant media is served through the app

**Date:** 2026-10-20 · **Phase:** Merchant 0
Next 16 won't optimise images from local IPs, which includes the Storage emulator, and a public bucket would expose unprocessed uploads. Processed files are streamed from Storage by an app route under `/media/m/` with immutable caching, and `next/image` treats them as local images (`localPatterns`). The bucket stays private, and production and development behave the same.

## D-065 — Merchant stock sells as the online total

**Date:** 2026-10-20 · **Phase:** Merchant 0
Checkout, reservations and listings count `stockByLocation.online`. Merchant stock is kept per location (`m_{shopId}_{locationId}`), and every write also sets `online` to the sum over the merchant's active ship-from locations. The storefront's stock logic is unchanged, and per-location stock is still recorded for merchant reporting.

## D-066 — Merchant locations reuse the store hours logic

**Date:** 2026-10-20 · **Phase:** Merchant 0
Merchant locations have their own collection (`shops/{id}/locations`) so they never mix with Texora's stores. Their weekly hours use the same shape as `storeSchema.hours`, so `openStatus` and `weeklyHours` in `src/lib/stores/hours.ts` serve both, extended for special-hours dates.

## D-067 — Products get their own status enum

**Date:** 2026-10-20 · **Phase:** Merchant 0
Review states (`in_review`, `changes_requested`) apply only to products. `productStatusSchema` extends the shared publish statuses with them. Pages, categories and collections keep `draft / scheduled / live / archived`. Storefront queries already filter on `live`, so nothing public changes.

## D-068 — Pluggable geocoding

**Date:** 2026-10-20 · **Phase:** Merchant 0 (revised in Merchant 4)
Address autocomplete, street-level geocoding and map tiles need an external provider, and none is configured. Locations are entered as US addresses. The ZIP code is checked against the state's ZIP ranges ("We couldn't find that address. Check the ZIP code and state."), and `src/lib/merchant/geo.ts` fills in the state's default timezone (editable) and an approximate position at the state's centre. Location cards show the address and today's opening status instead of a map. A provider-backed geocoder and map preview plug in behind the same `GeocodeResult` shape when a key is added.

## D-069 — Merchant fulfilment uses the existing shipments

**Date:** 2026-10-20 · **Phase:** Merchant 0
Orders already group SKUs into `shipments` with carrier and tracking, which is per-line fulfilment. A merchant marks its own lines shipped by adding a shipment that holds only its SKUs. The order becomes "shipped" once every line is in a shipment, so no separate fulfilment-group model is needed.

## D-070 — Marketplace flag; no TOTP in this pass

**Date:** 2026-10-20 · **Phase:** Merchant 0 (revised in Merchant 1)
The footer column, `/merchants` and merchant help are static and always shown, so the storefront shell stays prerendered. The existing `settings.features.vendorMarketplace` flag (on in the seed) gates what creates new marketplace activity: registration and shop submission show "Merchant registration is paused" when it is off, and the shop facet hides. Existing merchants keep their portal. TOTP two-factor needs Firebase Identity Platform, and the Auth emulator can't complete TOTP enrolment, so it can't be tested. It is recorded as a known limitation instead of shipping an untested setting.

## D-071 — No pickup for merchants

**Date:** 2026-10-20 · **Phase:** Merchant 0
The merchant prompt includes pickup points, pickup settings and PDP pickup availability. At the owner's request there is no pickup anywhere (D-044), so merchant locations are retail stores or ship-from warehouses, at least one active ship-from location is required, and the PDP shows shipping only.

## D-072 — Merchant passwords are checked on the server

**Date:** 2026-10-20 · **Phase:** Merchant 2
Customer and staff sign-in checks the password in the browser with the Firebase SDK. Merchant sign-in sends email-or-username and password to a Server Action, which calls the Identity Toolkit REST API. That is what lets usernames resolve to an email without exposing the mapping, failed attempts count towards a 15-minute lockout per account (and per IP), and registration create a session in the same request. Verification and password-reset codes are applied the same way, through links built on our own domain (`/merchant/verify-email`, `/merchant/reset-password`) carrying Firebase's one-time code.

## D-073 — One-time codes are never used during render

**Date:** 2026-10-20 · **Phase:** Merchant 2
Email clients, link previews and router prefetches can open a link before the person does. The reset page only checks its code, which doesn't use it up. The verification page applies its code from an effect after the page loads in a browser, so a prefetch or a preview can't consume it.

## D-074 — Rate limits key on the forwarded client IP

**Date:** 2026-10-20 · **Phase:** Merchant 2
Per-IP limits use the first `X-Forwarded-For` address, falling back to `X-Real-IP`. The hosting proxy (Firebase App Hosting, or any load balancer in front of `next start`) overwrites these headers, so clients can't choose their own key. Per-account limits (sign-in lockout, verification resends) don't depend on the IP at all. End-to-end tests send a distinct forwarded address per test, as separate visitors would.

## D-075 — Uploads authenticate with an in-memory custom token

**Date:** 2026-10-20 · **Phase:** Merchant 3
Sessions are HTTP-only cookies, so the browser has no Firebase sign-in for Storage rules to check. Before the first upload, the portal asks a Server Action for a custom token and signs the Firebase client in with it, using in-memory persistence, so nothing is written to disk and closing the tab ends it. The Storage rules check the role and vendorId claims on the user record and allow only write-once files in the merchant's own tmp folder. Every upload is then re-validated on the server.

## D-076 — How uploaded media is processed

**Date:** 2026-10-20 · **Phase:** Merchant 3
The server decides the file type from its bytes, never from the name or Content-Type. Images are decoded with a pixel limit, auto-rotated, cropped to the merchant's crop, scaled down (logo 1024, product photos 2400, banner 3600 on the long edge) and re-encoded as WebP. Re-encoding drops EXIF, GPS and every other metadata. A 16px blur placeholder and the dominant colour are stored with each image. SVG logos are refused if they contain scripts, event handlers, foreign content, entities or external references, and clean ones are rasterised, so no SVG is ever served. Videos (MP4/WebM, up to 30 seconds, read from the container header) are stored as uploaded, because stripping their metadata would mean transcoding, which needs a video service. Raw uploads are deleted as soon as they are processed. The hourly cleanup job removes media that was never attached, or was replaced, more than 24 hours ago.

## D-077 — Shop accents are always emitted as CSS variables

**Date:** 2026-10-21 · **Phase:** Merchant 4
A shop's accent is chosen at runtime and applied through an inline `var(--color-shop-…)` style. Tailwind v4 only emits theme variables that a class uses, so the variable was missing and white button text sat on the page background (caught by axe). The eight accents now live in an `@theme static` block, so every one is always defined. `npm run contrast` still checks each pair.

## D-078 — Active shop and onboarding progress live on the server

**Date:** 2026-10-21 · **Phase:** Merchant 4
Each onboarding step saves to the shop document and records `completedSteps` and `onboardingStep`, so a merchant resumes on any device (`/merchant/onboarding` redirects to the saved step) and Back never loses anything. Merchants with several shops (the UI allows 3) pick one in the header; the choice is an HTTP-only cookie scoped to `/merchant`, checked against ownership on every request.

## D-079 — Drafts are the editor's source of truth

**Date:** 2026-10-21 · **Phase:** Merchant 5
Every merchant product has a `productDrafts` document from the moment it's started. Autosave writes only there, version-checked so a second tab can't overwrite newer work. Each save also stores a small summary (name, first image, price range, online stock, low-stock flag) and mirrors the product's status, so the product list is a single query that shows drafts and published products together. The storefront `products` and `variants` documents are written only by review and publishing (Phase 6). Photos referenced by a draft are marked attached on save and released when removed, so the cleanup job never deletes something in use.

## D-080 — The merchant product list pages in memory

**Date:** 2026-10-21 · **Phase:** Merchant 5
Search over names and SKUs, category, stock and status filters, and sorting by name or price can't all be served by one Firestore index. A shop's drafts are read in one query and filtered, sorted and paged on the server ("Load more" grows the page in the URL). It is fast at merchant catalogue sizes (hundreds of products) and follows D-058. Beyond a few thousand products per shop, the list should move to the search index.

## D-081 — Colour codes, composition and the variant matrix

**Date:** 2026-10-21 · **Phase:** Merchant 5
Colours have stable codes, so renaming one keeps its variants and photos. Variants are keyed by colour, fit and size. When options change, rows that still exist keep everything entered. Removed rows are parked and come back with their values if the option is re-added. Combinations marked "Don't make" are never created. Composition is entered as material and percentage rows that must add up to 100%. At publish it becomes the `material` filter values and a "55% linen, 45% cotton" fabric line, so storefront filters work unchanged.

## D-082 — How merchant products reach the storefront

**Date:** 2026-10-21 · **Phase:** Merchant 6
Merchant products use the existing `products` and `variants` documents; there is no separate model. They are written only by publishing: trusted merchants publish directly, and everyone else's products are approved by a reviewer with `merchants.review`. The storefront product is live only when the merchant's product is live and the shop is approved. The draft's `published` flag records that a version is on sale. Edits to a live product go through review while the published version stays on sale, and stock edits reach live variants straight away. Shop changes (approval, pause, reinstatement, closing, a new name, address or logo) update the shop fields and visibility on existing storefront products without republishing unreviewed content. Pausing a shop hides its products within one revalidation.

## D-083 — SKUs are global; checks run at submission

**Date:** 2026-10-21 · **Phase:** Merchant 6
Variant documents are keyed by SKU across the whole catalog, Texora's own included. A merchant SKU that's already used blocks submission with a message pointing to Options, and approval re-checks it. The storefront is written before the status changes, so a clash can never leave a product marked live with nothing on sale. Suggested style ids (the SKU prefix) include a short code from the shop id, so shops with similar names never suggest the same SKUs.

## D-084 — Shop pages are static, with the time-sensitive parts in the browser

**Date:** 2026-10-21 · **Phase:** Merchant 6
`/shops/[slug]` is prerendered for every approved shop and revalidated by tag (`shops`, `shop:{slug}`). "Open now" is worked out in the browser at the shopper's time, so the page never goes dynamic. Like products, an unknown or unapproved shop shows the not-found page with `noindex` (the PPR soft-404 limitation, D-039). Revalidation uses the "max" profile, so the first visit after a change may still get the previous version while the new one renders.

## D-085 — Merchants see orders only through a scoped server view

**Date:** 2026-10-22 · **Phase:** Merchant 7
Each order line records the merchant's vendor id, shop id and shop name at purchase time, and the order lists its `vendorIds`. Merchants read orders through a server query on `vendorIds` that returns only their own lines, their part's total and the ship-to address, never payment details or other merchants' items. The Firestore rule that let a vendor read whole order documents from the client was removed. "Mark shipped" adds a parcel holding only the merchant's unshipped SKUs (D-069); the order becomes "shipped" when every seller's lines are in a parcel. The customer is emailed tracking details, and merchants are emailed when an order with their items is placed or paid. Payouts remain out of scope.

## D-086 — Portal JS budgets are measured beyond the framework runtime

**Date:** 2026-10-22 · **Phase:** Merchant 8
`npm run budget` reads each portal route's client reference manifest after `next build` and gzips every chunk its layouts and page load. The React 19 and Next.js 16 runtime that every page shares is about 130 KB gzipped on its own, more than the 120 KB budget, so the budgets (250 KB for the product editor, 120 KB for other portal routes) apply to the route's JavaScript beyond that runtime. First-load totals are printed alongside. Polyfills are `nomodule` and not counted. The Firebase client SDK is loaded only when an upload starts, which brought the branding screens from about 250 KB to under 95 KB. The product editor ships about 75 KB because its heavy sections load on demand.

## D-087 — Merchant account settings

**Date:** 2026-10-22 · **Phase:** Merchant 8
Settings cover the person, not the shop (shop settings are under Shop). Changing the email updates Firebase Auth and the merchant record, marks the address unverified and sends a new link: submitting and publishing pause until it is opened. Usernames can change once every 30 days (`usernameChangedAt`), and the lock moves in one transaction. Changing the password checks the current one, revokes every other session and signs this device in again; "Sign out everywhere" includes this device. New-order and product-review emails can be turned off; shop status emails (approval, changes requested, pause) can't, because they decide whether the shop can sell. Phones reach Settings from the username in the header; the bottom tab bar keeps four items.

## D-088 — Storage download listener warning is upstream

**Date:** 2026-10-22 · **Phase:** Merchant 8
The media route logs `MaxListenersExceededWarning` on `PassThrough` streams. It reproduces with a plain `file.download()` outside Next.js and comes from `teeny-request`'s stream mode (used by `@google-cloud/storage`), which adds pipeline listeners for each read. The count is the same for every download and doesn't grow, so it isn't a leak. It is left as is, with no dependency patch and no global listener-limit change, and should be revisited when `@google-cloud/storage` updates its transport.

## D-089 — Seed merchants are built through the portal's own code

**Date:** 2026-10-22 · **Phase:** Merchant 9
The seed can't call the portal's services, which are server-only and need a request. It builds merchant documents directly instead, but runs them through the same pure code the portal uses: the variant matrix, the publish checks (the seed fails if a live product wouldn't pass them), the shop counters and the storefront document builder. Every document is validated against its schema. Product slugs and SKUs are checked against the catalog. Images use the self-drawn placeholders (logos and banners are drawn per shop). Each image still gets a `merchantMedia` record marked attached, so editing a seeded product attaches and releases media exactly as for uploads. If a seeded image is released, cleanup removes its record as usual; its Storage delete finds nothing and ignores that.

## D-090 — Unranked products sort after best sellers

**Date:** 2026-10-22 · **Phase:** Merchant 9
`salesRank` 1 is the best seller, and new products, merchant listings included, start at 0. Sorting ascending put every new product ahead of the real best sellers in Featured, Best sellers and search ties. Seeding merchants made this visible. `compareSalesRank` treats 0 as "not ranked yet" and sorts it last; the in-memory listing engine and search both use it. Firestore can't express this order, so the repository's Firestore sorts stay as they are. No storefront page lists through them.

## D-091 — Shoppers can join rewards themselves

**Date:** 2026-10-22 · **Phase:** Accounts
Joining rewards changes the role from `customer` to `loyalty_member`. `canSystemGrant` now allows exactly that change (and still customer or member → vendor) without an admin. It sets the claim, adds a Core membership to the profile, audits it as the shopper's own action and re-mints this device's session so the new role applies straight away. Sign-up offers it as a ticked-by-default checkbox.

## D-092 — Customer accounts

**Date:** 2026-10-22 · **Phase:** Accounts

- **Sign-in:** all email-and-password sign-in is checked on the server, rate-limited per IP and locked for 15 minutes after 5 failures on an account. The Firebase client SDK is no longer needed on the sign-in page.
- **Orders:** the account lists a shopper's orders, and each links to the existing order page, which already lets the signed-in owner in. That page gained an invoice (printable or saved as PDF) and "Buy it again", which puts the lines back in the bag for re-pricing.
- **Wishlist:** `/account/wishlist` is public. Guests see this device's list; members see their synced one, and anyone can open a shared list.
- **Bag:** the bag follows the shopper across devices. On sign-in, guest items merge into the account (larger quantity wins, never doubled); after that the account's copy loads on each visit and changes are saved.
- **Saved sizes:** a browser copy of fit and sizes pre-selects them on cached product pages without a request.
- **Saved cards:** cards are saved with Stripe through a customer per shopper and Stripe's own "save this card"; only brand, last four digits and expiry are shown.
- **Deletion:** deleting an account removes the sign-in, profile, addresses, wishlist, saved bag and rewards history. Orders and returns are kept unlinked.

## D-093 — The app runs on real data only

**Date:** 2026-10-22 · **Phase:** Live readiness
The demo seed, its commands (`emulators`, `seed`) and the emulator defaults in `.env.example` are gone. The app always uses the configured Firebase project, and `npm run bootstrap` sets up a new one. The emulators remain only as the automated tests' sandbox: rules and integration tests use their own `demo-` projects, and `npm run test:e2e` starts the emulators, seeds the demo catalogue from `tests/fixtures/`, loads `tests/emulator.env` (overriding `.env.local`) and builds into `.next-e2e`. Both env schemas refuse emulator mode unless the project id starts with `demo-`, so a live configuration can't be pointed at fake data, or tests at real data. The illustrated placeholders are now drawn only for the test catalogue; the storefront's menu, sign-up and grid images use the licensed photos.

## D-094 — Storefront hardening

**Date:** 2026-10-22 · **Phase:** 9

- **Content Security Policy without nonces.** Nonces would force every page to render per request and rule out Partial Prerendering. Inline scripts are allowed; every other source is limited to this site, Stripe (payment fields and frames) and Google APIs (direct uploads). HSTS, nosniff, frame blocking, and referrer and permissions policies come with it.
- **Rate limits** cover every public mutation that can be abused, each per IP or per account. Promo codes count only the first time a wrong code is tried from an IP, so normal re-pricing never locks anyone out.
- **Analytics:** a typed, GA4-shaped `dataLayer` event layer, gated on analytics consent. Refunds happen in the back office, so they're logged server-side without personal data.
- **Sitemap and robots:** `sitemap.xml` is built from the same cached reads as the pages; production `robots.txt` links it and keeps private areas out.
- **Budgets:** every storefront and checkout route stays within 170 KB of route JavaScript beyond the shared runtime, the same measure as D-086.
- **Production dependencies:** `@grpc/grpc-js` is pinned to a patched 1.x through npm `overrides`; the production audit is clean. The remaining advisories are in development tools only.
- **Test ordering:** a full `npm run test:e2e` takes the visual baselines last, on a fresh seed, because other tests publish products, refund orders and spend points.

## D-095 — The home hero uses the store's own photograph

**Date:** 2026-10-22 · **Phase:** Live readiness
`public/media/assets/texora hero.png` is framed by `scripts/hero-images.ts`. On desktop it sits on its own white backdrop, right-aligned, so the headline column stays clear. On phones the group sits in the top half, sized so phones' side cropping never cuts anyone off. The other heroes and tiles stay on licensed stock until the store's own photography replaces them in `/admin/content`.

## D-096 — Egypt: EGP, 14% VAT, governorates, Paymob

**Date:** 2026-10-22 · **Phase:** Live readiness
Texora trades in Egypt. Market settings live in `src/config/locale.ts`: currency EGP (formatted `en-EG`, whole pounds without decimals), time zone Africa/Cairo, all 27 governorates (ISO 3166-2:EG codes) and Egyptian mobile numbers. VAT of 14% is added at checkout on goods and delivery. Delivery has two zones, Greater Cairo (Cairo, Giza) and the rest of Egypt, each with standard and express prices, a free-delivery threshold, and Friday as the non-delivery day. Paymob replaces Stripe for cards (Visa, Mastercard, Meeza) and mobile wallets through its hosted checkout; the HMAC-verified callback is the only source of truth, and Cash on Delivery stays. Saved cards were dropped with Stripe. English for now; Arabic (RTL) is a later step.

## D-097 — The store's own campaign photography; three new home sections

**Date:** 2026-10-23 · **Phase:** Live readiness
Every photo slot uses the store's campaign photography (`public/media/assets/campaign`), built by `scripts/campaign-images.ts` into the existing `/media/stock` paths, so live pages update without a content change. The stock photos are gone. The home page gains three CMS sections, each with its own marketing job and editable in `/admin/content`: a **campaign diptych** (`pair`: a seasonal campaign selling new arrivals to both departments), **bleed category tiles** with a link per department (cross-department discovery), and the diptych's **framed** layout (an occasion or gift promotion that also sells e-gift cards). "Shop by category" moves to the **editorial** tile style and carousels gain an optional subheading. Existing pages stay valid: tiles without a variant render as before. The copy on campaign photos sits on a dark fade so light text always passes contrast.

## D-098 — Operations manager, platform owners, email outbox, daily jobs

**Date:** 2026-10-24 · **Phase:** Live readiness

- **Roles.** A new **Operations manager** (`manager`) runs the business day to day: everything the specialist roles can do (customer service with unlimited refunds, catalogue, pricing, stock, fulfilment), approving and suspending merchant shops and products, and reading reports, settings, staff and the audit log, but not changing settings or staff. **Admin** is a manager who also runs settings and staff. `super_admin` is shown as **Platform owner**, and only platform owners grant or change admins and platform owners (`OWNER_ONLY_ROLES`), so an admin can't promote themselves through a second account.
- **Email outbox.** Without `RESEND_API_KEY` (staging), emails are written to `emailOutbox`. Admins and platform owners read them at `/admin/emails` (`emails.outbox.read`) to pass on verification, invitation and reset links while testing; the links are treated like passwords. Nothing new appears once Resend is connected.
- **Delivery address changes.** Customer service corrects the address of an unshipped order within its delivery zone (the zone sets the delivery price); for another zone the order is cancelled and placed again. Phone orders go through the normal checkout with the customer's email and cash on delivery.
- **Background jobs on Vercel.** `vercel.json` schedules the four `/api/cron/*` jobs daily (the Hobby plan allows daily jobs only); each accepts Vercel's GET as well as POST, authenticated with `CRON_SECRET`. Tighten the schedules on Vercel Pro.
- **Operations guide:** `docs/OPERATIONS.md`.

## D-099 — Shoppers never see merchant or shop names

**Date:** 2026-10-27 · **Phase:** Live readiness
Marketplace products sell under Texora. Shop identity is shown only to the shop's own merchant (their portal and shop page) and the Texora team (back office): product cards have no "by" line, the product page has no "Sold by" block (it says "Ships within N business days"), listings have no Shop filter and ignore `?shop=`, and search doesn't index shop names. Shop pages (`/shops/…`) need `shops.preview` (merchants and the marketplace team); everyone else, including signed-out visitors, gets a real 404 from the proxy, and a merchant can open only their own shop. Shop pages are noindex and out of the sitemap. Order records still snapshot the shop for merchants and staff.

## D-100 — No per-shop accent colour

Merchants no longer pick an accent colour. Shop pages use the Texora palette (the brand green for the logo placeholder), so every shop looks like part of one store. The `accent` field is gone from the shop schema, the branding form and the seed; the eight `--color-shop-*` tokens and their contrast checks were removed. Existing shop documents carrying `accent` are read without it (the schema strips unknown fields).

## D-101 — Returns within 14 days

The returns window is two weeks from delivery (was 30 days): `RETURN_WINDOW_DAYS` and `PLATFORM_RETURN_POLICY` drive the deadline, eligibility and the shop summary, and every customer-facing line (product page, bag, help centre, order email, merchant terms) says 14 days.

## D-102 — Egypt address checks

Addresses are checked against Egypt before they are saved (checkout, account address book, back-office address changes, merchant locations), in `src/config/egypt-address.ts`, the same code in the browser and on the server. The city or district may not be one we know belongs to a different governorate, and a postal code (optional) must start with the governorate's Egypt Post prefix. Unknown areas pass, since villages and new compounds are not all listed. The City field suggests the chosen governorate's main areas, and a phone on a saved account address must be an Egyptian mobile.

## D-103 — Returns within 15 days

Supersedes D-101: the returns window is 15 days from delivery. `RETURN_WINDOW_DAYS` and `PLATFORM_RETURN_POLICY` drive the deadline and eligibility, and every customer-facing line says 15 days.
