# Texora storefront

Specialty-apparel e-commerce platform built with Next.js 16 (App Router, Cache Components), React 19, TypeScript (strict), Tailwind CSS v4 and Firebase.

The full build brief is in [`STOREFRONT_BUILD_PROMPT.md`](STOREFRONT_BUILD_PROMPT.md). Decisions are logged in [`docs/DECISIONS.md`](docs/DECISIONS.md).

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

| Script                                  | What it does                                                                 |
| --------------------------------------- | ---------------------------------------------------------------------------- |
| `dev` / `build` / `start`               | Next.js dev server, production build, production server                      |
| `typecheck`                             | Generates route types, then `tsc --noEmit`                                   |
| `lint` / `lint:fix`                     | ESLint, zero warnings allowed                                                |
| `format` / `format:check`               | Prettier (with Tailwind class sorting)                                       |
| `test` / `test:watch` / `test:coverage` | Vitest unit and component tests                                              |
| `test:rules`                            | Firestore rules matrix on the emulator (every role × collection × operation) |
| `test:integration`                      | Repositories, sessions, roles and audit logging on seeded emulators          |
| `seed`                                  | Reset and seed the running emulators                                         |
| `rules:generate` / `rules:check`        | Build `firestore.rules` from `firestore/rules.template` and `rbac.ts`        |
| `e2e`                                   | Playwright against a production build (`npm run build` first)                |
| `e2e:visual` / `e2e:visual:update`      | Visual regression against (or refreshing) the styleguide baselines           |
| `emulators`                             | Firebase emulators for the offline `demo-texora` project                     |
| `contrast` / `contrast:check`           | Regenerates or verifies `docs/CONTRAST.md` from the design tokens            |
| `verify`                                | Everything CI checks, in order                                               |

A Husky pre-commit hook runs ESLint and Prettier on staged files.

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
