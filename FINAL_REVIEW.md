# Final security, reliability and hosting review

Reviewed on 20 October 2026 (Asia/Calcutta). Application: CALVAC, `calvac.in`, Vercel project `calvac-4-0`; Supabase project `jjyysdxkoarjlxwttiak`.

The implementation is designed to keep resource use small. It cannot guarantee free hosting at any traffic level. In particular, **Vercel Hobby permits personal, non-commercial use; a live footwear store does not meet that condition**. No paid plan, billing setting, domain move, or provider migration was enabled during this review. See [Vercel Hobby](https://vercel.com/docs/plans/hobby).

## Fixes in this review

| Finding | Change | Verification |
| --- | --- | --- |
| Authenticated users could bypass the account API and write arbitrary profile content directly through Supabase. | Revoked direct browser INSERT/UPDATE and removed the corresponding write policies. Account saves continue through the existing validated server endpoint. | Local database tests deny writes even to one's own profile, retain owner-only reads, and allow server saves. Live privilege inspection confirms the same grants. |
| Invalid catalog parameters triggered inventory maintenance before being rejected. | Validate product IDs, filters and pagination before maintenance or database reads. | Regression tests verify zero database/maintenance calls for invalid input. |
| The menu's Sale link filtered the product tag, whereas Collections used the sale flag. | Menu uses `sale=1`; the API also supports legacy `tag=sale` links through `on_sale`. | API and browser regressions. |
| Image resizing discarded existing URL query parameters, including signatures. Several components rebuilt URLs independently. | Centralized exact-host ImageKit resizing; preserve query metadata and leave signed URLs unchanged. Shared responsive URL generation on cards and detail pages. | Metadata/signature/host unit tests and browser source-URL checks. |
| Small search/cart thumbnails requested larger product images; carousel cards had no responsive sizing. | Search uses 80px, cart 160px, cards at most 480px, carousel cards use 160/320/520px candidates. The heavily blurred carousel background uses 80px. Product-detail images retain larger sizes. Brand tiles load lazily. | Build and responsive browser checks; sample ImageKit measurements below. |
| Catalog lists transferred long specifications and per-size stock maps that cards never display. | List/search database projections omit these fields. Detail and assistant reads retain them. | API tests verify detail specifications/stock are preserved. |
| The assistant fetched the 332-product index in four sequential requests on a cold start. | Fetch the same bounded index in one request, cache it for 60 seconds per warm instance, and re-read candidates before answering. The existing 1,000-product cap remains. | A 332-row fixture verifies one read and cache reuse; freshness/availability tests remain. |
| Password-reset requests had no visible cooldown after success. | A 60-second cooldown survives reload for the same email, independently of verification resend. Supabase still enforces the actual server limits. | Browser fixture verifies one recovery request and a disabled resend button after reload. |
| Order history mounted one payment polling loop per pending online order. | History uses manual status checks; automatic checks stay with the active checkout or a newly submitted payment and pause in hidden tabs. Polling remains bounded to 12 attempts. | Browser fixture opens 20 pending orders and verifies no per-order polling fan-out. |
| Sold-out sizes remained focusable/clickable controls; selected colours/sizes lacked explicit state. | Disable unavailable sizes and expose selected states to assistive technology. Prioritize the main product image. | Variant browser regression and type checking. |
| Bundle/media growth could silently increase usage again. | Added `npm run check:budgets` to CI, checking eager dependency graphs, compressed JS and static media sizes. | Production build and budget checks. |

The profile migration is `supabase/migrations/20261020035242_profile_server_writes.sql`. Its version matches the hosted migration history. It changes privileges/policies only; it does not rewrite or delete customer records or orders. Rollback, if a separately reviewed client integration needs direct profile writes, would restore the previous owner-checked write policies and grants. The current website does not need those grants.

## Security and reliability observations

All public tables have RLS. Public product reads require active products; orders, order items, payment events, checkout idempotency and API rate-limit tables are not granted to browser roles. Every checkout/payment maintenance RPC is executable only by the service role/postgres. Admin access uses verified Supabase identity and trusted app metadata or the confirmed-email allowlist, not customer-editable metadata. Customer API queries derive identity from the verified access token.

Checkout prices and inventory are calculated transactionally in Postgres. Stable product locks, persisted idempotency and the WhatsApp matching-order cooldown remain in place. Cancellation restores tracked stock once. Browser payment signatures cannot mark orders paid; the signed provider webhook validates order binding, amount and INR currency. The rate limiter persists in the database in production and fails closed on failure. Uploads require admin access, have a 200 KiB content limit and validate image type/dimensions.

Authentication, orders, profiles, admin responses and assistant replies use no-store responses. Only public catalog/settings/offer data have short shared caching. Two consecutive live catalog reads returned CDN MISS then HIT, confirming cache reuse. Static versioned frames and hashed build assets have immutable caching. Server functions use Python's standard library, bounded HTTP timeouts and the Supabase REST API; they do not create persistent database connection pools or depend on local uploaded files.

Production and complete dependency audits reported **zero known advisories**. A targeted secret-pattern scan of source and built assets found no private-key/Gemini/live-payment-key matches; only the example environment file is tracked. This is a bounded review, not proof that no vulnerability can exist. Existing regression tests cover checkout rollback/retries, permission boundaries, payment event tampering, ownership, account flows, collections, product details, themes, heroes and admin behavior.

The live runtime-error cluster query returned no errors in its selected 24-hour window. Detailed runtime logs were available only within the Hobby retention window; the 30-minute grouped result was limited to the top paths and is not monthly billing telemetry.

## Measured footprint

| Item | Measured size |
| --- | ---: |
| Supabase database at initial inspection | 15,027,347 bytes (about 15 MB) |
| Products at inspection | 332 |
| Orders at initial inspection | 980; normal store activity continued during review |
| Initial JS dependency graph, gzip | About 110 KB |
| Homepage's static JS dependency graph, gzip | About 118 KB, before the selected lazy hero |
| Complete mobile scroll sequence | 607,944 bytes |
| Complete desktop scroll sequence | 1,151,800 bytes |
| Optional character model | 768,888 bytes |
| All public static assets | About 4.4 MB; these are not all loaded per visit |

The scroll player initially requests up to five frames, keeps at most ten decoded frames and has two concurrent downloads. Reduced motion/data saving uses one poster. Particle mode does not load the scroll sequence. Admin/Supabase authentication chunks and the 3D renderer remain outside the initial/homepage static import graph. The optional Three.js renderer is about 612 KB uncompressed / 154 KB gzip and loads on the relevant product experience; its size warning is expected, not an eager homepage transfer.

One live product image at quality 75 returned 1,798 bytes at 80px, 8,556 bytes at 160px, 46,256 bytes at 400px and 143,296 bytes at 800px, all WebP. The 80px search thumbnail saves about 96% versus that sample's 400px variant; this is one sample, not a catalog-wide average. Browser cache, pixel density, selected hero and pages visited affect actual transfer.

## Free-plan constraints and remaining operational decisions

| Service | Current published free allowance relevant here | Assessment |
| --- | --- | --- |
| Vercel | Hobby is personal/non-commercial; published resource quotas also apply. | Resource use is small, but the commercial store requires an eligible hosting plan/provider. Code optimization cannot change eligibility. |
| Supabase | 500 MB database, 5 GB egress, 5 GB cached egress, 1 GB Storage, 50,000 monthly active users. Free projects may pause after a week of inactivity. | About 15 MB database usage is comfortably below storage allowance. Product media is on ImageKit/static hosting, not Supabase Storage. Monthly REST egress and auth traffic still need dashboard monitoring. Ordinary database REST responses should be budgeted against uncached egress; Vercel caching reduces repeated origin requests. |
| ImageKit | Forever Free currently advertises 20 GB/month bandwidth and 3 GB DAM storage. Older account allowances may differ. | Resized WebP, lazy loading, small uploads and browser reuse reduce use. The connected tools do not expose this account's actual storage/monthly meter, so remaining quota is not independently verified. |

Sources: [Vercel Hobby](https://vercel.com/docs/plans/hobby), [Supabase pricing](https://supabase.com/pricing), [ImageKit plans](https://imagekit.io/plans/), [ImageKit signed URLs](https://imagekit.io/docs/media-delivery-basic-security).

Supabase still reports leaked-password protection disabled. That feature is [available on Pro and above](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection); it was not enabled as a paid dependency. The three informational “RLS enabled, no policy” notices on the server-only ledger/rate-limit tables are intentional deny-by-default, not missing public access. Five unused-index notices were not acted on: this is a small/new deployment, and those indexes support product filtering, foreign keys, expiry and duplicate-order checks. Removing them merely to silence notices would discard useful access paths.

Supabase Free does not include automatic backups. Keep a regular secure database export and a tested restore procedure for a real store; this review did not export customer data. Monitor database size, uncached egress, active users, Vercel requests/compute/transfer, ImageKit bandwidth/storage, Resend sending quota and Gemini quota in their dashboards. Gemini already has per-IP limits and a 300-generation daily store cap with a catalog-only fallback; that cap is not a guarantee of provider-free usage. No synthetic keep-alive cron, large load test, paid transaction or new real email was run.

## Comparison with the provided old checkout

`F:\claxxic-india-main` uses Flask/SQLAlchemy/Gunicorn in its `render.yaml`, local upload directories and local brand assets. Its order endpoint accepts client prices/totals and has no persisted idempotency. These are unsuitable patterns to copy into the serverless upgrade. The current app retains the simple storefront structure while using static CDN assets, ImageKit uploads, cursor pagination, authoritative inventory/prices and durable order/payment state. The old checkout was read for reference and was not modified.

## Verification and rollout

The checks passed 33 Node/database tests, 41 Python API tests, the production build, email-artifact consistency, size budgets and browser regressions with isolated auth/payment/catalog fixtures. The final browser run includes the last image refinements and history-polling regression and reported no page errors. Browser fixtures block external providers and create no live orders or emails. See the GitHub check run on the release commit for the CI result.

Local PGlite tests are single-process database behavior tests; they are not a multi-connection production load test. Real payment capture, receipt appearance in email clients and future traffic capacity cannot be inferred from those fixtures. The hosted profile permissions were independently queried after applying the migration. Existing `claxxic-india` and its rollback state were not changed.
