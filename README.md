# CALVAC

React storefront and admin interface with Python serverless APIs, Supabase and ImageKit.

The latest homepage adds the supplied particle-shoe design, a shared light/dark theme and device-specific hero controls. See `HERO_RELEASE.md` for admin instructions, the five-minute WhatsApp duplicate-order cooldown and rollout details.

## Local development

Use Node.js 22.12+ (tested with 24.19) and Python 3.12–3.14.

1. Run `npm ci`.
2. Copy `.env.example` to `.env` and configure **local or preview** Supabase credentials. Browser variables must contain only the public URL and anonymous/publishable key. Service-role and ImageKit private keys belong only on the server.
3. Start the API with `python -m scripts.dev_api` in one terminal.
4. Start the frontend with `npm run dev` in another terminal.

The frontend proxies to `http://127.0.0.1:8000`. The API runs the same handlers used by Vercel. It binds only to loopback. Access to the known production backend requires an explicit `ALLOW_PRODUCTION_BACKEND=true`; a production proxy also requires `ALLOW_PRODUCTION_PROXY=true`. Keep these disabled for ordinary development and tests.

Admin access requires a Supabase user with trusted `app_metadata.role = "admin"` or a confirmed email in the server's `ADMIN_EMAILS`. User-editable metadata does not grant access. Set `ALLOWED_ORIGINS` to the exact deployed storefront origins. Production rate limiting uses Upstash when configured, otherwise the private atomic database limiter; failures deny the request.

## Database deployment — required before the updated API

Both reviewed migrations were applied to `jjyysdxkoarjlxwttiak` on 19 October 2026 after explicit user approval. Verification preserved 330 products, 976 orders and 1,153 relational order items; 974 historical orders now have item snapshots. The other two have no item records. All public tables have RLS, and privileged checkout/payment functions are service-role only.

1. Review `FIX_STATUS.md` and the read-only inspection in `DATABASE_SECURITY_REVIEW.sql`. Keep a current database backup and use a Supabase preview branch or development project for the final integration/concurrency checks.
2. Review both files in `supabase/migrations/` in order: checkout hardening, then customer payments. They support legacy JSON text columns, backfill item snapshots, restrict public access, and add customer/payment/rate-limit transactions. Original order-item records, totals, statuses and stock quantities remain intact.
3. Apply the migration in the preview database. Verify duplicate-key retries, rollback, variant pricing, shared inventory, cancellation, inactive-product visibility, and anonymous denial of order access/RPC execution.
4. Apply the compatible migration to the target database, then deploy the API and frontend together.

Checkout uses service-only `create_order_with_stock_v4`, checking the WhatsApp cooldown before passing the server-verified customer ID and payment method into the v3/v2 payment and inventory/idempotency transaction. It validates variants and prices, locks products in a stable order, and commits inventory, order creation and idempotent confirmation together. API routes authorize admin and customer operations before calling privileged functions.

`set_order_status_v3` permits Pending → Confirmed/Cancelled, Confirmed → Shipped/Cancelled, and Shipped → Delivered. Unpaid online orders cannot advance. Cancellation restores tracked inventory exactly once. Legacy orders without v2 inventory metadata need a manual inventory review before cancellation; the migration does not guess whether the old checkout deducted their inventory.

No application triggers existed at inspection time. The original two-argument checkout RPC remains service-role only for compatibility. Existing orders are not marked as v2 orders. Admin reads also load relational items for legacy orders written during the old storefront's cutover window.

## Accounts and payments

Guests can use WhatsApp/Cash on Delivery. Online payment requires sign-in. Accounts support registration, Google OAuth when the provider is configured, email confirmation/resend, password reset, opt-in saved addresses and owned order history. Supabase redirect URLs and SMTP must be configured for the release domain. See [ACCOUNT_CATALOG_RELEASE.md](ACCOUNT_CATALOG_RELEASE.md) for Google activation and the collection/product-detail fixes.

Razorpay loads only when a customer chooses Pay Online. Browser signatures never mark orders paid: verified webhooks check the stored order, amount and INR currency, and atomically record payment and event deduplication. Unpaid reservations expire after 45 minutes; checkout/catalog activity triggers cleanup. Late captures require manual refund review. Server credentials and the admin payment switch are both required before online checkout becomes available. See `DEPLOYMENT_PLAN.md` for setup and rollout details.

## Performance

The storefront hamburger opens a left drawer adapted from the supplied Sidebar 5 reference. Its reusable component and scoped styles live in `src/components/ui/sidebar-5.tsx` and `sidebar-5.css`, using the existing React/TypeScript, CSS variables and Lucide icons. It loads only when opened. The supplied curved-menu motion is mirrored for the left drawer: the drawer slides in with a curved leading edge and reverses when closing, using the existing Framer Motion dependency. The normalized SVG follows viewport resizing, matches the theme, and respects reduced-motion preferences. Profile links to `/account`, orders to `/account/orders`, and search uses the existing shop route. The native modal keeps the background inert and scrolling locked until the exit finishes; keyboard wrapping, Escape/backdrop closing, focus restoration, and both motion preferences are covered by browser checks. `BROWSER_TEST_DRAWER_ONLY=1 npm run test:browser` runs just the drawer scenarios against a fixture build.

See [FINAL_REVIEW.md](FINAL_REVIEW.md) for the 20 October security review, applied profile-permission fix, resource measurements and current hosting-plan constraints. CI enforces the build/media budgets with `npm run check:budgets`.

- Home uses 60 WebP frames per device variant: **1,151,800 bytes desktop**, **607,944 bytes mobile**, versus 15,498,851 bytes of GIFs previously.
- Only a window of nearby frames is fetched. At most ten decoded frames are retained, with two concurrent downloads. Skip/navigation aborts pending work and releases bitmaps. Reduced motion/data-saving requests only the first frame.
- Original GIFs are kept in `assets/source-frames/`, outside the public build. Rebuild WebP files with `python scripts/optimize_frames.py` after installing Pillow in a development environment. Bump the `/frames/v2` version if regenerated assets change because these URLs are immutable.
- Admin routes, their authentication client, and styles load only when visiting admin. Build output includes a manifest for checking route dependencies.
- Themes use static defaults and validated `calvac_settings_v8` cached values before rendering, followed by an asynchronous refresh. Public API caching is short; authentication/orders/admin responses are not cacheable.
- Catalog and order lists use cursor pagination. Catalog filters run on the server. Product prices/stock expire from client caches after 15–30 seconds and are authoritative only inside the checkout transaction.

## Checks

```text
npm run typecheck
npm test
python -m unittest discover -s tests -p "test_*.py" -v
npm run build
npx playwright install chromium
npm run test:browser
npm audit
```

The database tests use isolated embedded PostgreSQL (PGlite), including `tests/fixtures/live-schema.sql` captured without customer records. They verify migration compatibility with that schema and SQL behavior; they do not replace multi-connection concurrency testing on Supabase. Browser tests serve `dist/` on loopback with fixture API responses and blocked external services. They send no real orders. `PLAYWRIGHT_CHROMIUM_EXECUTABLE` can select an existing local Chromium executable.

For the optional admin browser scenario, build with `VITE_SUPABASE_URL=https://test-fixture.supabase.co` and `VITE_SUPABASE_ANON_KEY=fixture-public-key`, then run with `BROWSER_TEST_ADMIN=1`. These are synthetic test values; use actual public project settings for a release build. CI sets these fixture values automatically.

See `PROJECT_AUDIT.md` for the original findings and `FIX_STATUS.md` for implementation and deployment status.
