# Texora storefront

Specialty-apparel e-commerce platform built with Next.js 16 (App Router, Cache Components), React 19, TypeScript (strict), Tailwind CSS v4 and Firebase.

The full build brief is in [`STOREFRONT_BUILD_PROMPT.md`](STOREFRONT_BUILD_PROMPT.md); the merchant portal brief is in [`MERCHANT_PORTAL_BUILD_PROMPT.md`](MERCHANT_PORTAL_BUILD_PROMPT.md). Decisions are logged in [`docs/DECISIONS.md`](docs/DECISIONS.md).

## Requirements

- **Node.js 22.12 or newer** (22 LTS latest patch recommended; the test toolchain needs it)
- **Java 21+** for the Firebase emulators

## Setup

```bash
npm install
cp .env.example .env.local   # emulator defaults, no credentials needed
npm run emulators            # terminal 1: Auth, Firestore, Storage + UI at http://127.0.0.1:4000
npm run seed                 # terminal 2: 132 products, 3 stores, reviews, promotions, demo accounts
npm run dev                  # terminal 2: http://localhost:3000
```

### Demo accounts (emulators only)

Every role has an account `<role>@texora.test` (underscores become hyphens), all with the password `Texora-demo-1`: `customer`, `loyalty-member`, `customer-service`, `merchandiser`, `pricing-manager`, `inventory-manager`, `fulfillment`, `vendor`, `admin`, `super-admin`. Promo codes: `WELCOME15`, `SPEND200`. Demo gift card: `TXGC-DEMO-2026-0001`.

## Scripts

| Script                                  | What it does                                                                  |
| --------------------------------------- | ----------------------------------------------------------------------------- |
| `dev` / `build` / `start`               | Next.js dev server, production build, production server                       |
| `typecheck`                             | Generates route types, then `tsc --noEmit`                                    |
| `lint` / `lint:fix`                     | ESLint, zero warnings allowed                                                 |
| `format` / `format:check`               | Prettier (with Tailwind class sorting)                                        |
| `test` / `test:watch` / `test:coverage` | Vitest unit and component tests                                               |
| `test:rules`                            | Firestore rules matrix on the emulator (every role × collection × operation)  |
| `test:integration`                      | Repositories, sessions, roles and audit logging on seeded emulators           |
| `seed`                                  | Reset and seed the running emulators                                          |
| `rules:generate` / `rules:check`        | Build `firestore.rules` from `firestore/rules.template` and `rbac.ts`         |
| `e2e`                                   | Playwright against a production build (`npm run build` first)                 |
| `e2e:visual` / `e2e:visual:update`      | Visual regression against (or refreshing) the styleguide and portal baselines |
| `budget`                                | Merchant portal per-route JS budgets (after `npm run build`, D-086)           |
| `emulators`                             | Firebase emulators for the offline `demo-texora` project                      |
| `contrast` / `contrast:check`           | Regenerates or verifies `docs/CONTRAST.md` from the design tokens             |
| `verify`                                | Everything CI checks, in order                                                |

A Husky pre-commit hook runs ESLint and Prettier on staged files.

`build`, `verify` and `e2e` need the emulators running and seeded: catalog pages prerender from Firestore.

## Merchant portal

Independent shops sell on Texora through the merchant portal. Shoppers find it from **Sell on Texora** in the footer (`/merchants`).

- **Merchants:** register at `/merchant/register`, verify the emailed link (in development, emails land in the `emailOutbox` collection, viewable in the emulator UI), then complete onboarding (basics, branding, contact, locations, review) and submit. Products are built in `/merchant/products`, orders appear in `/merchant/orders`, and account settings are in `/merchant/settings`.
- **Texora staff:** review shops at `/admin/merchants` and products at `/admin/merchants/products`. Reviewing needs `merchants.review` (merchandiser, admin); pausing, reinstating and trust levels need `merchants.manage` (admin). Trusted merchants publish without review.
- **Seed merchants** (emulators only; password `Texora-demo-1`, sign in at `/merchant/sign-in` with the email or username):

  | Shop                                                         | Type            | State                                      | Sign in       |
  | ------------------------------------------------------------ | --------------- | ------------------------------------------ | ------------- |
  | [Harbor & Pine](http://localhost:3000/shops/harbor-and-pine) | Brand (trusted) | Approved, 12 live products                 | `harborpine`  |
  | [Maison Rue](http://localhost:3000/shops/maison-rue)         | Boutique        | Approved, 12 live products                 | `maisonrue`   |
  | [Studio Ines](http://localhost:3000/shops/studio-ines)       | Designer        | Approved, 11 live products                 | `studioines`  |
  | Northline Supply                                             | Reseller        | Waiting for review (one product in review) | `northline`   |
  | Petal & Thread                                               | Boutique        | Changes requested                          | `petalthread` |

  Approved shops each have a logo, a banner and two locations (a retail store that also ships, and a ship-from warehouse). Their products are made in 3 colours × 2 fits × 6 sizes. Review the pending shop as `admin@texora.test` at `/admin/merchants`.

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

All variables are validated with Zod at startup (`src/lib/env`). See [`.env.example`](.env.example) for the full list. `NEXT_PUBLIC_*` values are visible in the browser; never put secrets in them. In production with emulators off, `FIREBASE_SERVICE_ACCOUNT` (base64-encoded service-account JSON) is required.
