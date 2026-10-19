# CALVAC upgrade: accounts, payments and deployment

Status: source implemented and locally tested. Both production database migrations were approved and applied; Git publication and the `calvac.in` domain switch are in progress. Vercel MCP is connected. The target is the existing **calvac-4-0** project in the same team as the live **claxxic-india** project; no replacement Vercel project needs to be created.

## Customer and admin flows

The reference was `F:/CALVAC_CLOTHING-main/CALVAC_CLOTHING-main`. Its Supabase account/Razorpay architecture is adapted to this application's React/Python stack:

- Guest WhatsApp and Cash on Delivery checkout; online payment requires a verified sign-in session.
- Sign-in, registration, email confirmation, password reset, profile/address saving, owned order history and sign-out. Account address persistence is opt-in; guest addresses remain session-only.
- An order is created with authoritative pricing and reserved inventory before online payment. The customer resumes that saved order after checkout closes. Provider order creation uses a database lease and reuses an existing bound provider order.
- Browser payment signatures are checked using the stored provider order ID. They never mark an order paid. Verified, amount/currency-checked Razorpay webhooks update payment state and their deduplication record in one SQL transaction.
- Unpaid online reservations expire after 45 minutes. Cleanup runs on checkout and, with a per-worker 30-second throttle, catalog activity; customers can also cancel unpaid reservations. There is no separately provisioned scheduler. Late captures on cancelled orders require manual refund review and do not resurrect/restock orders incorrectly.
- Admins control the three checkout methods. Online payment remains unavailable unless the server also has gateway credentials and a webhook secret. Paid/pending/failed/refund-review states are visible; unpaid online orders cannot be confirmed or shipped manually.
- Production uses Upstash when configured, otherwise a private atomic PostgreSQL rate limiter. A limiter failure still fails closed. No new paid service is provisioned.

The intended admin already has a confirmed Supabase email. Its allowlist is configured in Vercel, with verified-email enforcement in the API. No password or account email was changed.

## Approved database changes applied

Applied in order to `jjyysdxkoarjlxwttiak` on 19 October 2026:

1. `supabase/migrations/202610190001_checkout_hardening.sql`: add missing product/order fields, backfill snapshots from existing relational order items, widen address/image fields, add indexes, restrict public permissions/RLS, and add idempotent stock/order transactions.
2. `supabase/migrations/20261019070645_customer_payments.sql`: add private customer profiles, verified-account order ownership, payment metadata/leases/events and rate-limit records; add service-only checkout, payment-event, expiry, cancellation and limiter RPCs. Profile RLS permits customers to access only their own profile; customer order access goes through the verified API and exposes no internal notes/stock metadata.

The original 330 products, 976 orders and 1,153 relational items remain. Original totals, customer details, statuses, stock quantities and passwords were not rewritten. 974 snapshots were backfilled; two historical orders have no item records and keep empty snapshots. Legacy order cancellation still requires manual stock review. The user explicitly approved both production migrations, resolving the earlier automatic approval rejection.

Supabase recorded versions `20261019111147` (checkout_hardening) and `20261019111159` (customer_payments). Post-apply verification confirms RLS on every public table, no public mutations except owned profiles, and service-only privileged RPCs. Internal limiter/idempotency/payment-event tables deliberately have no public policies. Leaked-password protection remains a dashboard setting requiring configuration.

Each migration has bounded lock/statement timeouts and a transaction. Migration compatibility and transaction behavior pass isolated PostgreSQL tests using the captured schema. These do not substitute for multi-connection/live integration checks.

## Vercel rollout

1. Publish `codex/calvac-upgrade` to `MuFeEd06/CALVAC-4.0`; keep the live project's `MuFeEd06/Sneaker_store_3.0` source intact.
2. Apply the approved migrations and recheck RLS, grants, public catalog reads, safe order fields and privileged function access.
3. Build a **preview** in `calvac-4-0` from the exact upgrade commit. Use Node 24, `npm run build`, `dist`, and the Python API configuration in `vercel.json`.
4. Check build logs, all public routes, direct-route refresh, admin sign-in/settings and customer authentication. Only use fixtures/test-mode payment credentials for payment tests.
5. Produce a production deployment in `calvac-4-0` after the checks succeed. Move **calvac.in** from `claxxic-india` to this ready project, verify TLS/routes/API requests, and retain the old deployment for rollback.

The old `claxxic-india.vercel.app` address stays with its existing project. Moving the custom `calvac.in` domain does not rename the old Vercel project or delete it. The destination already owns `calvac-4-0.vercel.app`.

The target already has Supabase and ImageKit environment variables. `ADMIN_EMAILS` and exact `ALLOWED_ORIGINS` were added. Each deployment's server-owned `VERCEL_URL` is also accepted for same-deployment browser requests; arbitrary preview subdomains are not allowlisted.

## Account/payment setup before enabling production online payment

- Configure Supabase Site URL/redirect allowlist for `https://calvac.in/auth/callback`, `https://calvac.in/reset-password`, the target project's equivalent URLs, and approved preview URLs. Configure custom SMTP for customer confirmation/reset emails and enable leaked-password protection if supported by the plan.
- Add server-only `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` in Vercel. Start with test-mode keys. The application returns only the public key ID to checkout.
- Configure the Razorpay webhook at `https://calvac.in/api/razorpay/webhook` for `payment.captured`, `order.paid`, `payment.failed`, and optionally `payment.authorized`. Configure automatic capture in Razorpay. Exercise failed, cancelled, delayed and duplicate delivery scenarios before switching to live keys.
- Enable Pay Online in admin settings after configuration and testing. Refunds are reviewed/processed in Razorpay; this implementation does not automatically issue refunds or fabricate a refunded status.

No live payment credentials were requested, decrypted or printed. No real payment was attempted.
