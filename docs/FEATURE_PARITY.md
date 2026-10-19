# Feature parity checklist

Tracks every behaviour in Section 7 of the build brief against our implementation. This list records **behaviour only**: no third-party assets, code or copy.

Status: `Planned` · `In progress` · `Done` · `Excluded` (reason required)

## 7.1 Global shell

| Feature          | Behaviour                                                                               | Implementation                       | Phase | Status                                                                  |
| ---------------- | --------------------------------------------------------------------------------------- | ------------------------------------ | ----- | ----------------------------------------------------------------------- |
| Announcement bar | Rotating CMS messages, dismissible, link, optional countdown                            | `navigation/AnnouncementBar`         | 3     | Done (UI); CMS-driven messages in Phase 8                               |
| Header           | Logo, department nav, search, stores, account, wishlist, live bag count                 | `navigation/Header`                  | 3     | Done                                                                    |
| Sticky header    | Shows on scroll-up, hides on scroll-down, compact after 80px                            | `navigation/Header`                  | 3     | Done                                                                    |
| Mega menu        | 150ms hover intent, keyboard, category/fit columns, featured tile, Esc/outside close    | `navigation/MegaMenu`                | 3     | Done                                                                    |
| Mobile nav       | Full-height drawer, drill-down panels, recently viewed, account shortcuts               | `navigation/MobileNav`               | 3     | Done                                                                    |
| Search overlay   | 150ms debounced instant results, suggestions, top 4 hits, recents, no-results fallback  | `navigation/SearchOverlay` + Algolia | 3     | Done (in-process index; Algolia later)                                  |
| Search relevance | Typo tolerance and synonyms                                                             | Algolia index settings               | 3     | In progress (typos, plurals, synonyms in-process; Algolia config later) |
| Footer           | Link columns, email signup with consent, social, country/currency, legal, payment icons | `navigation/Footer`                  | 3     | Done                                                                    |
| Signup modal     | Time/scroll trigger, frequency cap, suppressed in checkout                              | `feedback/SignupModal`               | 3     | Done                                                                    |
| Cookie consent   | Category toggles; analytics only after consent                                          | `feedback/ConsentBanner`             | 3     | Done (analytics gating applies once analytics lands)                    |

## 7.2 Home & editorial

| Feature                                             | Behaviour                                                       | Implementation              | Phase | Status  |
| --------------------------------------------------- | --------------------------------------------------------------- | --------------------------- | ----- | ------- |
| Module registry                                     | Typed blocks composed by merchandisers                          | `editorial/registry`        | 4     | Done    |
| HeroBanner                                          | Image/video, overlay copy, 1–2 CTAs, focal point per breakpoint | `editorial/HeroBanner`      | 4     | Done    |
| SplitFeature, CategoryTiles, StoryBlock, PromoStrip | Editorial blocks                                                | `editorial/*`               | 4     | Done    |
| ProductCarousel                                     | Manual or rule-based                                            | `editorial/ProductCarousel` | 4     | Done    |
| LookbookGrid / ShopTheLook                          | Shoppable hotspots                                              | `editorial/LookbookGrid`    | 4     | Done    |
| Module scheduling & targeting                       | Start/end dates; guest/member/tier audience                     | Module schema + resolver    | 4     | Done    |
| Module admin editor + preview                       | Form per Zod schema, live preview                               | `admin/content`             | 8     | Planned |

## 7.3 Product listing page

| Feature                 | Behaviour                                                                                                       | Implementation                       | Phase | Status                           |
| ----------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ----- | -------------------------------- |
| PLP header              | Breadcrumbs, title, editorial banner, product count                                                             | `plp/*`                              | 4     | Done                             |
| Facets                  | Category, size by type, fit family, colour family, price, material, category attributes, sale/new, availability | `plp/FacetGroup`                     | 4     | Done (in-process; Algolia later) |
| Filter layout           | Desktop collapsible rail; mobile drawer with live "Show N results"                                              | `plp/FilterRail`, `plp/FilterDrawer` | 4     | Done                             |
| Filter logic            | OR within group, AND across groups; URL state, back-button safe                                                 | URL search params                    | 4     | Done                             |
| Active filters          | Chips with remove + Clear all                                                                                   | `plp/ActiveFilters`                  | 4     | Done                             |
| Sort                    | Featured, newest, price ↑/↓, best sellers, top rated                                                            | `plp/SortMenu`                       | 4     | Done                             |
| Grid density            | 2/3/4 desktop, 1/2 mobile, persisted                                                                            | `plp/GridDensityToggle`              | 4     | Done                             |
| Pagination              | Load more with count, SSR paginated URLs, scroll restore                                                        | `plp/PaginationLoadMore`             | 4     | Done                             |
| In-grid editorial tiles | Inserted at configured positions                                                                                | `plp/ProductGrid`                    | 4     | Done                             |

## 7.4 Product card

| Feature        | Behaviour                                              | Implementation                             | Phase | Status                                |
| -------------- | ------------------------------------------------------ | ------------------------------------------ | ----- | ------------------------------------- |
| Imagery        | 3:4, hover crossfade (desktop), mini-carousel (mobile) | `commerce/ProductCard`                     | 4     | Done                                  |
| Swatches       | Max 5 + "+N"; swap image and link colour               | `commerce/SwatchPicker`                    | 4     | Done                                  |
| Badges         | Priority-ordered, max 1 visible                        | `primitives/Badge` + resolver              | 4     | Done                                  |
| Price & rating | Regular/sale/range, % off, stars + count               | `commerce/PriceDisplay`, `commerce/Rating` | 4     | Done                                  |
| Quick add      | Size buttons on hover, adds and opens bag drawer       | `commerce/AddToBag`                        | 4     | Done                                  |
| Quick view     | Modal behind feature flag                              | `features.ts` flag                         | 4     | Planned (feature-flagged)             |
| Wishlist heart | Optimistic, animated, accessible label                 | `commerce/WishlistButton`                  | 4     | Done (local; account sync in Phase 7) |

## 7.5 Product detail page

| Feature              | Behaviour                                                                                 | Implementation                   | Phase | Status                                |
| -------------------- | ----------------------------------------------------------------------------------------- | -------------------------------- | ----- | ------------------------------------- |
| Gallery              | Desktop 2-col stack + sticky info; mobile swipe with dots/counter; video                  | `pdp/Gallery`                    | 5     | Done                                  |
| Zoom viewer          | Full-screen, pinch/scroll zoom, pan, thumbnails, arrow keys                               | `pdp/ZoomViewer`                 | 5     | Done                                  |
| Colour selector      | Swatch + name, updates gallery and `?color=`                                              | `commerce/SwatchPicker`          | 5     | Done                                  |
| Fit tabs             | Regular/Petite/Tall with own size runs                                                    | `commerce/FitTabs`               | 5     | Done                                  |
| Size selector        | Unavailable crossed out, clickable for back-in-stock                                      | `commerce/SizePicker`            | 5     | Done                                  |
| Size guide           | Tables per category + how-to-measure                                                      | `pdp/SizeGuideModal`             | 5     | Done                                  |
| Fit feedback summary | "Runs true to size" from reviews                                                          | `pdp/FitFeedback`                | 5     | Done                                  |
| Add to bag           | Inline validation, quantity, low-stock message                                            | `commerce/AddToBag`              | 5     | Done                                  |
| Fulfilment           | Delivery estimate by postcode; BOPIS store picker; free-shipping message                  | `pdp/StoreAvailability`          | 5     | Done                                  |
| Details accordions   | Description, fit, fabric & care, shipping & returns                                       | `pdp/DetailsAccordion`           | 5     | Done                                  |
| Complete the look    | Curated items with quick add                                                              | `pdp/CompleteTheLook`            | 5     | Done                                  |
| Recommendations      | You may also like, recently viewed                                                        | `editorial/ProductCarousel`      | 5     | Done                                  |
| Reviews              | Aggregate, distribution, fit slider, filters, sort, photos, helpful votes, verified badge | `pdp/Reviews`                    | 5     | Done                                  |
| Write a review       | Customer only, moderated                                                                  | Server Action + moderation queue | 5     | Done (moderation queue UI in Phase 8) |
| Sticky mobile bar    | Appears when main button leaves viewport                                                  | `pdp/StickyAddToBag`             | 5     | Done                                  |
| Structured data      | Product, Offer, AggregateRating, BreadcrumbList                                           | JSON-LD                          | 5     | Done                                  |

## 7.6 Bag

| Feature             | Behaviour                                                        | Implementation                        | Phase | Status  |
| ------------------- | ---------------------------------------------------------------- | ------------------------------------- | ----- | ------- |
| Bag drawer          | Confirmation, lines, subtotal, free-shipping progress, CTAs      | `bag/BagDrawer`                       | 6     | Planned |
| Bag page edits      | Size/colour/qty inline, remove, move to wishlist, save for later | `bag/BagLineItem`                     | 6     | Planned |
| Promo codes         | Error/success states, stacking rules                             | `bag/PromoCodeField` + pricing engine | 6     | Planned |
| Gift card / rewards | Redemption in bag                                                | Pricing engine                        | 6     | Planned |
| Order summary       | Subtotal, discounts, shipping, tax, total                        | `bag/OrderSummary`                    | 6     | Planned |
| Cross-device bag    | Server sync; guest bag merged on sign-in                         | Bag repository                        | 6     | Planned |
| Server revalidation | Price and stock rechecked on every load                          | Bag Server Action                     | 6     | Planned |

## 7.7 Checkout

| Feature         | Behaviour                                                    | Implementation                         | Phase | Status  |
| --------------- | ------------------------------------------------------------ | -------------------------------------- | ----- | ------- |
| Minimal layout  | No mega menu or footer                                       | `checkout/layout`                      | 6     | Planned |
| Entry           | Sign in, guest, express pay (Apple/Google Pay via Stripe)    | `checkout/*`                           | 6     | Planned |
| Steps           | Shipping → delivery → payment → review                       | `checkout/Stepper`                     | 6     | Planned |
| Layout          | Desktop sticky summary; mobile collapsible summary           | `checkout/*`                           | 6     | Planned |
| Resilience      | Inline Zod errors, step state survives refresh               | Persisted step store                   | 6     | Planned |
| Order placement | Idempotency key, inventory transaction, webhook confirmation | Server Action + `api/webhooks`         | 6     | Planned |
| Confirmation    | Page + email                                                 | `order-confirmation/[id]`, React Email | 6     | Planned |

## 7.8 Account

| Feature                     | Behaviour                                                        | Implementation        | Phase | Status  |
| --------------------------- | ---------------------------------------------------------------- | --------------------- | ----- | ------- |
| Overview dashboard          | Summary of orders, rewards, wishlist                             | `account/`            | 7     | Planned |
| Orders                      | List, detail, tracking timeline, invoice, reorder                | `account/orders`      | 7     | Planned |
| Returns                     | Pick items + reason, label/QR or drop-off, status, refund method | `account/returns`     | 7     | Planned |
| Addresses & payment methods | Saved addresses; tokenised cards only                            | `account/*`           | 7     | Planned |
| Rewards                     | Tier, points, progress, history, available rewards               | `account/rewards`     | 7     | Planned |
| Wishlist                    | Move to bag, share, price-drop indicator                         | `account/wishlist`    | 7     | Planned |
| Saved sizes & preferences   | Pre-select fit and size on PDP                                   | `account/preferences` | 7     | Planned |
| Communication & security    | Email/SMS preferences, password, sessions, delete/export         | `account/*`           | 7     | Planned |

## 7.9 Other

| Feature            | Behaviour                                  | Implementation                         | Phase | Status                                |
| ------------------ | ------------------------------------------ | -------------------------------------- | ----- | ------------------------------------- |
| Guest order lookup | Email + order number                       | `account/lookup`                       | 7     | Planned                               |
| Store locator      | Map, list, filters, hours, store services  | `stores/`                              | 7     | Planned                               |
| Gift cards         | Buy e-gift card, check balance             | `gift-cards/`                          | 7     | Planned                               |
| Help centre        | FAQ search, shipping, returns, size guides | `help/[[...slug]]`                     | 7     | Planned                               |
| Notifications      | Back in stock, price drop                  | `notifications` collection + Functions | 7     | Planned                               |
| Recently viewed    | Local + synced                             | `stores/recentlyViewed`                | 5     | Done (local; account sync in Phase 7) |
| Error pages        | Branded 404 / 500                          | `not-found.tsx`, `error.tsx`           | 3     | Done                                  |

## Exclusions

None yet.
