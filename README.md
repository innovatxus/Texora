# Texora storefront

Specialty-apparel e-commerce platform built with Next.js 16 (App Router, Cache Components), React 19, TypeScript (strict), Tailwind CSS v4 and Firebase.

The full build brief is in [`STOREFRONT_BUILD_PROMPT.md`](STOREFRONT_BUILD_PROMPT.md); the merchant portal brief is in [`MERCHANT_PORTAL_BUILD_PROMPT.md`](MERCHANT_PORTAL_BUILD_PROMPT.md). Decisions are logged in [`docs/DECISIONS.md`](docs/DECISIONS.md).

## Requirements

- **Node.js 22.12 or newer**
- A **Firebase project** (Authentication with Email/Password, Firestore, Storage)
- **Java 21+** only to run the automated test suites (they use a local, offline sandbox)

## Setup (your live Firebase project)

The app always runs on your real Firebase project; there's no demo data.

1. In the Firebase console, start **Authentication** (enable Email/Password), **Firestore** and **Storage** (production mode).
2. `npm install`, then copy `.env.example` to `.env.local` and fill in the web config, a base64 service-account key (Project settings → Service accounts) and two random 32+ character secrets. `.env.local` is git-ignored.
3. Deploy the security rules and indexes before anything connects:
   `npx firebase deploy --only firestore:rules,firestore:indexes,storage --project <project-id>`
4. Run the one-time setup:
   `npm run bootstrap -- --project <project-id> --admin-email you@example.com --name "Your Name"`
   It creates the store settings, categories, collections, starter pages (royalty-free photography, see [`docs/IMAGE_CREDITS.md`](docs/IMAGE_CREDITS.md)) and your super-admin account, with the password typed at a hidden prompt. It never overwrites existing data and is safe to run again. Add `--personas` for one ready-made test account per role (shopper, rewards member, customer service, merchandiser, pricing, inventory, fulfilment, admin) at `+` aliases of your admin email, such as `you+service@example.com`, sharing one password you type.
5. `npm run dev` (or `npm run build && npm run start`). Sign in at `/auth/signin` and open `/admin`.

**Staging.** With `STAGING=true` every response carries `X-Robots-Tag: noindex`, `robots.txt` blocks crawlers, and without `RESEND_API_KEY` emails go to the `emailOutbox` collection (Firebase console → Firestore) instead of being sent. The public launch needs `RESEND_API_KEY` and `STAGING` removed.

### Accounts and roles

- **Shoppers** sign up at `/auth/register` (optionally joining rewards) and manage everything at `/account`: orders, invoices, returns, rewards, wishlist, addresses, payment methods, sizes, communication and security.
- **Staff** are invited from `/admin/users` by an admin, with a role (customer service, merchandiser, pricing, inventory, fulfilment, admin).
- **Merchants** register at `/merchant/register` (footer: **Sell on Texora**) and are approved at `/admin/merchants`.

## Scripts

| Script                                  | What it does                                                                        |
| --------------------------------------- | ----------------------------------------------------------------------------------- |
| `dev` / `build` / `start`               | Next.js dev server, production build, production server (your live project)         |
| `bootstrap`                             | One-time live-project setup: store structure and your admin account                 |
| `typecheck`                             | Generates route types, then `tsc --noEmit`                                          |
| `lint` / `lint:fix`                     | ESLint, zero warnings allowed                                                       |
| `format` / `format:check`               | Prettier (with Tailwind class sorting)                                              |
| `test` / `test:watch` / `test:coverage` | Vitest unit and component tests                                                     |
| `test:rules`                            | Firestore and Storage rules matrix (every role × collection × operation), sandboxed |
| `test:integration`                      | Services, sessions, roles, accounts and audit logging, sandboxed                    |
| `test:e2e` (`e2e`)                      | Playwright on a sandboxed demo store: starts, seeds, builds into `.next-e2e`, runs  |
| `e2e:visual` / `e2e:visual:update`      | Visual regression against (or refreshing) the baselines                             |
| `rules:generate` / `rules:check`        | Build `firestore.rules` from `firestore/rules.template` and `rbac.ts`               |
| `budget`                                | Merchant portal per-route JS budgets (after `npm run build`, D-086)                 |
| `contrast` / `contrast:check`           | Regenerates or verifies `docs/CONTRAST.md` from the design tokens                   |
| `verify`                                | Everything CI checks, in order                                                      |

A Husky pre-commit hook runs ESLint and Prettier on staged files.

### How the tests stay away from your data

The test suites create accounts, shops and orders, so they never use your project. They run against the local Firebase emulators with offline `demo-` projects and the demo catalogue in `tests/fixtures/` (`tests/emulator.env` for e2e), and the e2e build goes to `.next-e2e`, so your live build is untouched. The app refuses emulator mode for anything but a `demo-` project (D-093). Pass Playwright arguments through, e.g. `npm run test:e2e -- e2e/account.spec.ts --project desktop`.

## Deploy

Any Node.js host for Next.js works (for example Vercel or Firebase App Hosting).

1. Set every variable from `.env.example` in the host's environment, never in a committed file. `NEXT_PUBLIC_SITE_URL` is the public `https://` address. Keep `STAGING=true` for a test deployment; for launch, set `RESEND_API_KEY` and remove `STAGING`.
2. Deploy the Firestore and Storage rules and indexes whenever `firestore/rules.template`, `storage/rules.template` or `firestore.indexes.json` change (`npm run rules:generate` first).
3. Schedule the background jobs (`POST`, header `Authorization: Bearer $CRON_SECRET`): `/api/cron/release-reservations` and `/api/cron/merchant-publish` every 5 minutes, and `/api/cron/notifications` and `/api/cron/media-cleanup` hourly.
4. For card payments, add the Stripe keys and point a Stripe webhook at `/api/webhooks/stripe` (events: `payment_intent.succeeded` and `payment_intent.payment_failed`), using its signing secret as `STRIPE_WEBHOOK_SECRET`.
5. Add the production domain to Firebase Authentication → Settings → Authorized domains.

How the pieces fit together: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Merchant portal

Independent shops sell on Texora through the merchant portal. Shoppers find it from **Sell on Texora** in the footer (`/merchants`).

- **Merchants:** register at `/merchant/register`, verify the emailed link (in staging without Resend, emails land in the `emailOutbox` collection in the Firebase console), then complete onboarding (basics, branding, contact, locations, review) and submit. Products are built in `/merchant/products`, orders appear in `/merchant/orders`, and account settings are in `/merchant/settings`.
- **Texora staff:** review shops at `/admin/merchants` and products at `/admin/merchants/products`. Reviewing needs `merchants.review` (merchandiser, admin); pausing, reinstating and trust levels need `merchants.manage` (admin). Trusted merchants publish without review.

- **Delivery only:** merchants ship their own items. There is no store pickup, and payouts are out of scope.

Merchant features use the existing environment variables:

| Variable                                    | Used for                                                                                                |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `FIREBASE_STORAGE_BUCKET` / `NEXT_PUBLIC_…` | Merchant media: browser uploads to `tmp/`, processed files served at `/media/m/…`                       |
| `ORDER_TOKEN_SECRET`                        | Signs the product preview links                                                                         |
| `CRON_SECRET`                               | `/api/cron/merchant-publish` (scheduled publishing) and `/api/cron/media-cleanup` (24-hour tmp cleanup) |
| `RESEND_API_KEY` / `EMAIL_FROM`             | Merchant emails (verification, review decisions, new orders)                                            |

In production, schedule both cron routes (for example every 5 minutes for publishing and hourly for cleanup) with `Authorization: Bearer $CRON_SECRET`. The team inbox for review requests is `MERCHANT_TEAM_EMAIL` in `src/config/merchant.ts`.

## Styleguide

With `ENABLE_STYLEGUIDE=true` (the `.env.example` default), every token and primitive is catalogued at [http://localhost:3000/styleguide](http://localhost:3000/styleguide). It returns 404 when the flag is off; never enable it on a public deployment.

## Project layout

```
src/
  app/          routes ((storefront), (admin), api)
  components/   primitives, commerce, navigation, plp, pdp, bag, checkout, editorial, ...
  config/       brand.ts, navigation, feature flags
  lib/          env, firebase, auth, data repositories, payments, search, email, ...
  stores/       client state (Zustand)
  styles/       tokens.css (ATELIER design tokens), globals.css, fonts.ts
e2e/            Playwright specs
docs/           decisions, feature parity, contrast ratios
```

## Environment variables

All variables are validated with Zod at startup (`src/lib/env`). See [`.env.example`](.env.example) for the full list. `NEXT_PUBLIC_*` values are visible in the browser; never put secrets in them. In production `FIREBASE_SERVICE_ACCOUNT` (base64-encoded service-account JSON) is required, and blank `KEY=` lines count as unset.
