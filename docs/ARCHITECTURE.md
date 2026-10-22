# Architecture

Texora is a specialty-apparel storefront with a back office and a merchant marketplace, built on Next.js 16 (App Router, Cache Components, React 19), TypeScript (strict), Tailwind CSS v4 and Firebase (Authentication, Firestore, Storage). Decisions and their reasons are logged in [`DECISIONS.md`](DECISIONS.md) (D-001 onward); feature status is in [`FEATURE_PARITY.md`](FEATURE_PARITY.md).

## Applications in one codebase

| Area            | Routes                                                                                         | Who                                   |
| --------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------- |
| Storefront      | `src/app/(storefront)`: home, listings, product, bag, help, stores, gift cards, shops, account | Everyone; `/account` needs an account |
| Checkout        | `src/app/(checkout)`: steps, confirmation and payment                                          | Guests and shoppers                   |
| Back office     | `src/app/(admin)/admin`                                                                        | Staff, by role                        |
| Merchant portal | `src/app/(merchant)`, `src/app/(merchant-auth)`                                                | Merchants (`vendor` role)             |
| API             | `src/app/api`: Stripe webhook, cron jobs, exports, return QR                                   | Machines and staff                    |

Route groups give each area its own layout (chrome, density, navigation) without changing URLs.

## Code layout

```
src/
  app/           routes (groups above), sitemap, robots, error and status pages
  components/    primitives (design system), commerce, plp, pdp, bag, checkout, account,
                 orders, navigation, editorial, admin, merchant, analytics
  config/        brand, navigation, merchandising, merchant limits, security headers, help
  lib/
    actions/     runAction: schema → access check → handler → typed result (every mutation)
    auth/        sessions (HTTP-only cookie), RBAC (roles → permissions), identity, passwords
    account/     customer sign-up/in, profile, addresses, wishlist, bag sync, export, deletion
    catalog/     listing engine (filters, facets, sorting), search index, PDP data
    bag/ orders/ pricing/ payments/ giftcards/ loyalty/ returns/   commerce core
    merchant/    accounts, shops, products (drafts → publishing), media pipeline, orders
    admin/       back-office services (orders, refunds, people, site content)
    data/        Firestore repositories (schema-validated reads)
    validation/  Zod schemas: the single source of data shapes, client and server
    security/    rate limits (Firestore fixed windows)
    analytics/   typed, consent-gated ecommerce events
    email/       Resend transport and React Email templates
  stores/        client state (Zustand): bag, wishlist, checkout, preferences
  styles/        design tokens (ATELIER), globals, fonts
firestore/       rules template (generated into firestore.rules from rbac.ts)
scripts/         bootstrap (live setup), store structure, photography, rules, budgets, contrast
tests/           integration, rules, fixtures (demo catalogue), e2e runner and env
e2e/             Playwright specs and visual baselines
```

## Rendering and caching

- **Cache Components.** Catalogue reads are `"use cache"` functions tagged by entity (`products`, `inventory`, `categories`, `collections`, `stores`, `shops`) and revalidated by tag when staff or merchants save (stale-while-revalidate). Listing and product pages prerender from the cached listing index; request-time pieces (session, bag, account sync) sit in their own `Suspense` boundaries, so pages keep a static shell.
- **Session first.** Anything that reads the session calls `getSession()` (which calls `connection()`) before other fetches, so prerendering never sees request data.
- **Soft 404s** for unknown dynamic slugs (D-039); every `generateStaticParams` returns at least one entry, even on an empty store.
- **Images** go through `next/image` from `/media/**`: licensed stock and the store's own photography in `public/media`, merchant uploads processed into Storage and served by `/media/m/...`.

## Data

Firestore collections (schemas in `src/lib/validation`): `products`, `variants` (one per SKU, stock per location), `categories`, `collections`, `pages` (CMS modules), `users` (+ `addresses`, `wishlist`, `paymentMethods`, `loyaltyLedger`), `carts`, `orders`, `returns`, `reviews`, `promotions`, `promoCodes`, `giftCards`, `stores`, `notifications`, `auditLogs`, `settings`, `rateLimits`, `emailOutbox`; marketplace: `merchants`, `usernames`, `shops` (+ `locations`), `shopSlugs`, `productDrafts`, `merchantMedia`.

- Every read is parsed with its Zod schema; invalid documents are logged and treated as missing.
- Orders snapshot their lines, prices, seller and addresses at purchase time; placement is idempotent (idempotency key) and reserves stock in a transaction.
- Merchant products are edited as drafts and written to `products`/`variants` only by publishing (D-079, D-082).

## Identity, roles and access

- **Sign-in** is checked on the server (rate-limited per IP, 15-minute lockout per account) and exchanged for an HTTP-only session cookie.
- **Roles** live in Firebase custom claims; `src/lib/auth/rbac.ts` maps roles to granular permissions and is the single source for: the proxy (route access, with 403 for denied pages), every Server Action (`runAction` access checks) and the generated Firestore rules (`npm run rules:generate`).
- Customers can self-enrol in rewards; shoppers can become merchants (D-061, D-091); every other role change needs an admin and is audited.
- **Audit:** privileged actions write to `auditLogs` (actor, role, action, target, before/after, IP).

## Commerce flows

- **Bag** lives on the device and, for signed-in shoppers, in `carts/{uid}` (merged on sign-in, saved on change). Prices, promotions, tax, gift cards and rewards are always computed on the server.
- **Checkout** saves step state, offers saved addresses, and pays by card (Stripe Payment Element: saved cards, Apple/Google Pay when enabled; confirmed by webhook) or cash on delivery. Delivery only, no store pickup (D-044).
- **After purchase:** order pages (signed link or account), invoice, reorder, self-serve returns with QR labels, loyalty points on delivery, back-in-stock and price-drop alerts.

## Security

Security headers on every response (`src/config/security-headers.ts`): a Content Security Policy without nonces (keeps Partial Prerendering) limited to this site, Stripe and Google APIs; HSTS on HTTPS; nosniff; frame blocking; strict referrer and permissions policies. Server Actions are CSRF-safe by design, all mutations validate input with Zod and check permissions, prices are server-side only, the Stripe webhook verifies signatures, and rate limits cover sign-in, sign-up, password reset, promo-code guessing, order lookup, gift-card balance, reviews, alerts and order placement. `STAGING=true` adds noindex everywhere.

## Background jobs

Scheduled `POST` routes, authenticated with `Authorization: Bearer $CRON_SECRET`:

| Route                            | Suggested schedule | Does                                                        |
| -------------------------------- | ------------------ | ----------------------------------------------------------- |
| `/api/cron/release-reservations` | every 5 minutes    | Frees stock held by unpaid card orders                      |
| `/api/cron/notifications`        | hourly             | Back-in-stock and price-drop emails, scheduled e-gift cards |
| `/api/cron/merchant-publish`     | every 5 minutes    | Publishes merchant products scheduled for a time            |
| `/api/cron/media-cleanup`        | hourly             | Deletes unused merchant uploads after 24 hours              |

## Environments

- **Live / staging:** the app always runs on a real Firebase project configured in `.env.local` (or the host's environment). `npm run bootstrap` sets up a new project (D-093).
- **Tests:** the suites run against the Firebase emulators with offline `demo-` projects and the demo catalogue in `tests/fixtures`; `npm run test:e2e` builds into `.next-e2e`. Both env schemas refuse emulator mode for a real project.

## Testing

Unit and component tests (Vitest, jsdom), Firestore and Storage rules matrices (every role × collection × operation), integration tests against the emulators, and Playwright end-to-end tests at 375/768/1024/1440 with axe checks and visual baselines. Per-route JavaScript budgets are checked with `npm run budget`.
