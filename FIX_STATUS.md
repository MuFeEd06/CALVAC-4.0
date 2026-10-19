# CALVAC fix status — 19 October 2026

The code changes are implemented, verified, published to `MuFeEd06/CALVAC-4.0` and **live at https://calvac.in** through Vercel's `calvac-4-0` project. Both production database migrations were explicitly approved and applied on 19 October 2026. The old `claxxic-india` project is retained for rollback. See `DEPLOYMENT_PLAN.md` for release evidence and remaining account/payment configuration.

## Original findings

Numbers correspond to `PROJECT_AUDIT.md`.

| # | Change | Status |
| --- | --- | --- |
| 1 | Preserve ImageKit URLs on product saves; reject invalid URLs visibly instead of erasing images. | Local fix verified |
| 2 | Reuse checkout keys across retries, prevent duplicate clicks, clear the cart after success, and show an authoritative confirmation with a separate WhatsApp link. | Local/browser verified; database RPC deployed |
| 3 | Move idempotency into the order transaction; store a payload hash and replay the committed confirmation. Failed transactions leave no reservation. | SQL/API tests pass; migration applied |
| 4 | Upgrade Vite, React Router and affected transitive dependencies; regenerate the lockfile. | npm audit: zero vulnerabilities |
| 5 | Default local development to a loopback Python API; require explicit opt-in for known production backends. | Implemented |
| 6 | Separate pending requests from expiring cache values; shorten product freshness and invalidate list/detail/search/settings/offer caches after edits. | Unit tests pass |
| 7 | Replace 120 GIFs with 60 WebP frames per device, use a bounded cancellable buffer, and honor reduced motion/data saving. | Unit/browser/visual checks pass |
| 8 | Remove the database-backed stylesheet from the rendering path; initialize with static/cached theme values and refresh asynchronously. | Build/browser verified |
| 9 | Preserve spaces during address editing and normalize at save/submit. | Unit/browser verified |
| 10 | Enforce ten units per variant and twenty cart lines; revalidate size availability when color changes. | Unit/browser verified |
| 11 | Reject malformed phone/PIN data, boolean/fractional quantities and invalid IDs; enforce variants/prices/stock in SQL. | API/SQL tests pass; SQL deployed |
| 12 | Preserve policy Markdown paragraphs, headings and lists through server validation. | API round-trip test passes |
| 13 | Use an atomic fixed rate-limit window, set expiry once, fail closed on Redis errors, and return Retry-After. | API tests pass |
| 14 | Dynamically import public/admin routes; load admin authentication and styles within the admin route tree. | Build/browser verified |
| 15 | Show catalog/search/product/admin failures and retry states; prevent failed settings saves from appearing successful. | Browser/API verified |
| 16 | Add cursor pagination and server filters to products/orders; use load-more controls and bounded homepage queries. | API/browser verified |
| 17 | Replace removed `cgi` multipart handling with bounded standard-library parsing; declare Python 3.12–3.14 support. | Python 3.12 upload tests pass; CI includes 3.14 |
| 18 | Use the same v7 theme cache contract at startup and during refresh. | Implemented |
| 19 | Abort obsolete search requests and ignore old responses after new input, clearing, closing or navigation. | Browser race check passes |

Additional fixes remove fabricated reviews/material claims and unused Three.js code, use accessible links/focus states, stop idle/touch cursor work, obtain admin tokens through the configured session, validate admin access on the server, limit address retention to the current session/24 hours, and handle failed image loads locally. Setup documentation, environment examples, version declarations, tests and CI are included.

## Measured performance changes

| Animation assets | Before | After |
| --- | ---: | ---: |
| Desktop sequence | 15,498,851 bytes | 1,151,800 bytes (92.6% smaller) |
| Mobile sequence | 15,498,851 bytes | 607,944 bytes (96.1% smaller) |
| Decoded frames retained | Complete sequence potentially retained | At most ten |

Only nearby frames load, with two concurrent downloads. Browser checks observed five initial mobile frame requests in the latest run, no further frame requests after navigation, and one poster request under reduced motion. Original GIFs remain in `assets/source-frames/`, outside the public build and excluded from API deployments.

The fixture production build has a roughly 323 KB shared entry, a 44 KB home route, and separate admin routes plus a 187 KB Supabase client. Public-cart browser requests contain **no admin or Supabase chunks**, no admin stylesheet, and no `/api/theme-css` request. Asset sizes are uncompressed build output; these are not real-user timing measurements.

## Connected database findings and proposed migration

Read-only inspection of `jjyysdxkoarjlxwttiak` found 330 products, 976 orders and 1,153 relational order items. Products, legacy settings and order items lacked RLS and had broad anonymous/authenticated privileges. Orders, offers and site settings had RLS enabled with no policies. The old checkout function was already service-role only, but referenced missing product/order columns. No application triggers existed.

`supabase/migrations/20261019111147_checkout_hardening.sql` was applied after approval:

- Add missing inventory/order fields and sale/pagination indexes; retain JSON text columns and support their prefixed legacy size labels.
- Copy historical relational item details into the new order snapshot field. Keep original records, totals, statuses and stock quantities unchanged. Two legacy orders have no item rows; their snapshots stay empty for manual review.
- Widen address/image fields to match values accepted by the API; add timestamp defaults for future orders.
- Add service-only transactional checkout/idempotency and status functions. Lock inventory in a stable order, validate variant prices and shared stock, and restore v2 inventory once on permitted cancellation.
- Enable RLS and remove direct public mutation privileges. Keep storefront configuration and active products readable; restrict orders, order items and idempotency records to server access. Cover legacy `settings` too.
- Add the missing order-items foreign-key index and an idempotency order lookup index.

The migration has a five-second lock timeout and a sixty-second statement timeout and runs in one transaction. Existing orders are not marked as v2 orders. Cancelling an old order requires a manual stock review because the old inventory behavior cannot safely be inferred.

The second migration, `20261019111159_customer_payments.sql`, adds owned profiles, order ownership, Razorpay leases/events, reservation expiry and persistent rate limits. Both live migrations succeeded. Live verification confirms the original 330 products, 976 orders and 1,153 item rows, with 974 snapshots backfilled and no historical orders marked as new checkout orders. Every public table has RLS; anonymous/authenticated roles cannot execute privileged RPCs or read orders/items. Profiles allow only owner access. Three internal tables deliberately have no public policies. The original RLS errors and missing foreign-key index warning are resolved; new unused-index notices are informational.

No real test order, stock adjustment, payment or customer deletion was performed. Multi-connection concurrency and real payment-provider delivery still need validation; embedded PostgreSQL tests do not establish those properties.

Supabase also reports **leaked-password protection disabled**. Its Auth configuration is not editable through the available database tools; enable it in the dashboard if the project plan supports it. [Supabase password-protection guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

The original public-schema metadata and checkout definition were saved without customer data in the task's `database-before-fixes.json` artifact. An original project ZIP was also preserved before editing. `tests/fixtures/live-schema.sql` contains only schema metadata for reproducible compatibility tests.

## Verification

- TypeScript check and Vite 8 production build pass.
- 22 frontend/SQL tests pass, including migrations against the captured live schema, payment event retries, ownership, stock expiry and rate-limit windows.
- 20 Python API tests pass, covering validation, confirmed admin email, retries, privacy/ownership, payment signatures, rate limiting, pagination, cutover compatibility and uploads.
- Production-browser scenarios pass for checkout, pagination, variants, stale search, mobile animation cleanup, reduced motion, bundle separation, failed admin saves, customer sign-in, pending-to-paid confirmation, owned history, sign-out cleanup, payment settings and immediate refund-review feedback after admin cancellation. No page JavaScript errors were observed.
- Screenshots inspected for mobile home/confirmation and admin save-error feedback. API responses and external image placeholders were fixtures; no real orders were sent.
- npm audit reports zero vulnerabilities after the dependency update.
- GitHub Checks passed for the published release, including Python 3.12 and 3.14. Vercel preview/production builds succeeded; deployed catalog/settings/payment configuration returned successfully, and unsigned customer/admin API access was denied.
- After moving `calvac.in`, live HTTPS/mobile checks passed for home, shop, cart, login, registration and account/admin redirects, with no horizontal overflow or JavaScript errors. The live homepage loaded no admin/Supabase chunks. WhatsApp/COD are enabled; Razorpay remains disabled until credentials, webhook and test-mode verification are configured.

Browser results/screenshots are in `test-results/`. CI uses synthetic public Supabase settings for the admin browser scenario; a release build must use the real public project configuration.

## Particle hero and theme release

See `HERO_RELEASE.md` for the new reference-based particle hero, retained scroll mode, independent device shoes/uploads/positioning, shared monochrome light/dark styling and five-minute WhatsApp duplicate guard. The release adds service-only checkout v4 and an indexed lookup that recognizes recent orders from the preceding deployment, while preserving all existing orders.

The particle hero module is approximately 42 KB uncompressed (15 KB gzip); its default desktop/mobile images are 121,260 / 133,526 bytes, and only the selected device/mode image is requested. The retained scroll module is loaded separately. Local validation includes 28 frontend/SQL/theme tests and 22 Python API tests; browser verification covers actual particles, device selection, saved theme preferences, uploads, cooldown feedback and rendered text contrast.
