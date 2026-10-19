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
Vitest 5 / Vite 8 and jsdom 30 depend on loading ES modules through `require()`, which Node only supports without a flag from 22.12. `package.json` `engines` and CI pin Node 22 LTS (latest patch).

## D-013 — `firebase-tools` audit warnings accepted (dev only)

**Date:** 2026-10-19 · **Phase:** 0
`npm audit` reports advisories in transitive dependencies of `firebase-tools` (for example `uuid` via `gaxios`). It is a local CLI for the emulators and never ships in the app bundle. The only fix offered is a downgrade to an older major. Re-check on each `firebase-tools` release.

## D-014 — Deferred stack items

**Date:** 2026-10-19 · **Phase:** 0
`next-intl` (i18n), Sentry and Web Vitals reporting are part of the stack but are installed when first needed (shell in Phase 3, observability in Phase 9), keeping Phase 0 limited to tooling the later phases build on.
