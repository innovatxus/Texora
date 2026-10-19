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
