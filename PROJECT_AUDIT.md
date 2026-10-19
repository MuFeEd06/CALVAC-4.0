# CALVAC project audit

This is the original audit snapshot. Fixes have since been implemented locally; see [FIX_STATUS.md](F:/CALVAC-4.0-main/CALVAC-4.0-main/FIX_STATUS.md) for current verification and pending database deployment work.

Reviewed on 19 October 2026. Scope: the supplied local checkout, its production build, dependency advisories, offline API probes, and isolated browser checks. Application source files were not changed. The audit installed locked dependencies and generated `dist/` to verify the application.

The most urgent work is to fix product image loss and checkout retry behavior, update vulnerable dependencies, and make local development use an isolated backend. Database security and stock correctness need a separate verification step because their implementation is absent from this checkout.

Priority labels: **P1** = address before the next release; **P2** = schedule next; **P3** = follow-up improvement. A priority is the recommended work order, not a claim that an exploit has been demonstrated.

## Architecture and behavior

| Area | Current implementation | Important consequence |
| --- | --- | --- |
| Frontend | React 18, TypeScript, Vite 5, React Router 6 | A client-rendered application with public and admin routes in one build. |
| Storefront | Home, shop, product, cart, contact, policy pages | Catalog filtering mostly happens in the browser after fetching up to 500 products. |
| Data access | `src/api/index.ts` calls same-origin Python endpoints | Products, individual products, search, settings, and offers have separate browser caches. |
| Public API | `api/store.py`, `api/theme_css.py` | Reads Supabase using the anonymous key; database RLS is a security boundary. |
| Checkout | `CartPage` → `POST /api/orders` → Supabase RPC | Cash on delivery. Order persistence occurs before opening WhatsApp. WhatsApp content comes from the browser cart. |
| Inventory and pricing | `rpc/create_order_with_stock` | The live order path delegates this logic to SQL that is not supplied here. The Python `_build_order` and `_decrement_stock` helpers are unused by the handler. |
| Admin login | Python password login via Supabase, then browser `setSession` | Server permissions come from trusted `app_metadata.role` or `ADMIN_EMAILS`; the browser persists a Supabase session. |
| Admin operations | `api/admin.py` with service credentials after `require_admin` | Server-side admin checks are present on protected reads and writes. The hidden URL is only a routing convention. |
| Image upload | Browser compression → authenticated Python upload → ImageKit | Files are capped at 200 KiB after compression, with MIME/signature and dimension checks. |
| Rate limiting | Upstash REST in production; process memory in development | Production routes intentionally fail closed if Upstash is not configured. |
| Home animation | Canvas scrubbing through 120 GIF images | Large network and potential decoded-image memory costs, especially on mobile. |
| Deployment | Vercel static output plus Python functions and rewrites | `npm run dev` only serves the frontend locally and proxies API requests to `calvac.in`. |

Main code entry points: [routing](F:/CALVAC-4.0-main/CALVAC-4.0-main/src/App.tsx:24), [public API client](F:/CALVAC-4.0-main/CALVAC-4.0-main/src/api/index.ts:110), [admin API client](F:/CALVAC-4.0-main/CALVAC-4.0-main/src/api/admin.ts:44), [order handler](F:/CALVAC-4.0-main/CALVAC-4.0-main/api/orders.py:135), [server authorization](F:/CALVAC-4.0-main/CALVAC-4.0-main/api/_lib/_auth.py:45).

Existing protections worth preserving: protected API operations perform server-side admin checks; user-editable `user_metadata` does not grant admin access; request bodies and uploads have size limits; policy HTML is sanitized; and deployment headers include CSP, anti-framing, and HTTPS protections. The review did not demonstrate an unauthenticated admin bypass.

## Findings, in recommended order

### 1. P1 — Saving a product erases its ImageKit main image

**Confirmed with the actual TypeScript function.** `sanitizeProductPayload` applies `isSafeUrl` to `draft.image`, but that URL allowlist omits `ik.imagekit.io`. The upload control supplies an ImageKit URL and product submission runs this sanitizer, so saving a newly uploaded image, or editing an existing ImageKit-backed product, sends an empty main-image URL. The server accepts the empty string and overwrites the image.

Evidence: an input of `https://ik.imagekit.io/example/shoe.webp` produced `image: ""`. Color image fields follow a different validation path.

Fix: introduce a specific image-URL validator, allow the intended ImageKit host, align it with the server allowlist, and report invalid input instead of silently deleting it. Verify upload → save → reload and editing an existing product without changing its image.

References: [image sanitizer](F:/CALVAC-4.0-main/CALVAC-4.0-main/src/utils/validation.ts:85), [URL allowlist](F:/CALVAC-4.0-main/CALVAC-4.0-main/src/utils/validation.ts:35), [submission](F:/CALVAC-4.0-main/CALVAC-4.0-main/src/pages/admin/AdminProductsPage.tsx:751).

### 2. P1 — Checkout retries can create duplicate orders

**Confirmed in a browser against a mocked order endpoint.** Every click generates a new idempotency key. After success, the cart remains populated and the order button becomes usable again. Two completed clicks sent two order requests. There is no order confirmation state or saved order identifier to let the customer safely reopen WhatsApp.

The client also aborts after 8 seconds while the order RPC allows 20 seconds, in addition to preceding rate-limit/idempotency requests. A browser timeout does not establish whether the database committed the order; retrying with a new key can create another order. Opening WhatsApp only after an asynchronous request may also encounter popup blocking.

Fix: persist one key for a checkout attempt across retries, return and display an authoritative order identifier and total, and transition to a completed order view. Provide a separate explicit WhatsApp link for that saved order. Align timeout and reconciliation behavior; do not use a new order submission to recover a lost response.

References: [checkout handler](F:/CALVAC-4.0-main/CALVAC-4.0-main/src/pages/CartPage.tsx:114), [default timeout](F:/CALVAC-4.0-main/CALVAC-4.0-main/src/api/index.ts:74), [RPC timeout](F:/CALVAC-4.0-main/CALVAC-4.0-main/api/orders.py:143).

### 3. P1 — Server idempotency consumes failed attempts and cannot replay success

**Confirmed with a mocked failing RPC.** The handler reserves a key before reading and validating the body. The key remains reserved for 24 hours on validation errors, upstream errors, or a successful order. A repeat receives only `409 Duplicate order request`; the reservation contains no request fingerprint, order identifier, or original response. The key is not passed to the database RPC.

Probe result: first request `502`, same-key retry `409`, different-key retry `200`. Thus a safe retry is blocked after a known failure, and a lost success response cannot be recovered through the key. Redis reservation and database commit are separate operations.

Fix: validate before claiming the attempt, bind the key to a payload fingerprint, and store/replay the order result. Prefer transactional database idempotency with a unique key passed into the order RPC; handle in-progress and failed attempts explicitly.

References: [reservation order](F:/CALVAC-4.0-main/CALVAC-4.0-main/api/orders.py:140), [Redis reservation](F:/CALVAC-4.0-main/CALVAC-4.0-main/api/_lib/_rate_limit.py:99).

### 4. P1 — Locked dependencies have current security advisories

The npm audit returned **10 affected packages: 5 high, 4 moderate, 1 low**. Eight flagged packages are development/build dependencies; `react-router` and `react-router-dom` are runtime dependencies. These are package-level advisory findings, not ten proven application exploits.

| Package | Locked version | Audit severity | Context |
| --- | --- | --- | --- |
| Vite | 5.4.21 | High | Development server, including Windows file-access bypass advisories. |
| Browserslist | 4.28.2 | High | Build tooling. |
| nanoid | 3.3.11 | High | Build dependency; no application call to the vulnerable generator was identified. |
| PostCSS | 8.5.10 | High | Build-time source map processing. |
| source-map-js | 1.2.1 | High | Source map processing. |
| React Router / DOM | 6.30.4 | Moderate each | Shipped browser dependencies; redirect advisories. |
| esbuild | 0.21.5 | Moderate | Development/build tooling. |
| baseline-browser-mapping | 2.10.21 | Moderate | Build tooling. |
| Babel core | 7.29.0 | Low | Build-time source map processing. |

The React Router maintainer lists this DOM version as affected by [GHSA-jjmj-jmhj-qwj2](https://github.com/remix-run/react-router/security/advisories/GHSA-jjmj-jmhj-qwj2). A separate [redirect advisory](https://github.com/remix-run/react-router/security/advisories/GHSA-wrjc-x8rr-h8h6) lists a fix in 7.18.0+. The app's internal navigation mostly uses fixed or encoded paths, so exploit reachability still needs assessment. The [Vite Windows advisory](https://github.com/vitejs/vite/security/advisories/GHSA-fx2h-pf6j-xcff) has exposure conditions; the checked-in config does not enable `server.host`.

Fix: update to supported, patched toolchain/router versions and regenerate the lockfile, then re-run build, type, routing, and auth checks. Do not assume an automatic forced upgrade is compatible. Keep development servers private during the migration.

References: [dependencies](F:/CALVAC-4.0-main/CALVAC-4.0-main/package.json:11), [lockfile](F:/CALVAC-4.0-main/CALVAC-4.0-main/package-lock.json:1).

### 5. P1 — Local development sends API operations to production by default

**Confirmed from configuration; production mutations were not exercised.** Every `/api` request in the Vite dev server is proxied to `https://calvac.in`, with a production Origin header. Local checkout can therefore create real orders and consume real inventory; authenticated local admin operations can change live products and settings. This also means local frontend testing does not test the Python code in this checkout.

Fix: run the Python API locally or use a dedicated preview backend/database, and make the proxy target environment-specific. Require an explicit opt-in for production access. Document which backend a development session uses.

Reference: [development proxy](F:/CALVAC-4.0-main/CALVAC-4.0-main/vite.config.ts:8).

### 6. P2 — Browser caches can stay stale indefinitely within an open session

**Confirmed using the actual API client with a simulated clock.** `_productsPromise` and `_settingsPromise` remain set after resolution. Their early returns bypass later TTL checks. A product fetch after 13 hours made no second request; a settings fetch after 61 seconds also made no second request. Full-page reloads still permit 12-hour product and 8-hour individual-product staleness.

Product create/update/delete does not invalidate public caches. `clearProductsCache` clears only the list, leaving individual product and search caches. Offer saving leaves the separate 5-hour offer cache unchanged. Consequently prices, availability, deleted products, and offers can disagree across views and with checkout.

Fix: distinguish pending-request deduplication from timestamped cached values, use short stock/price freshness windows and background revalidation, and invalidate all relevant keys after mutations. Reconcile cart prices with the server before presenting the final total.

References: [promise cache](F:/CALVAC-4.0-main/CALVAC-4.0-main/src/api/index.ts:110), [individual cache](F:/CALVAC-4.0-main/CALVAC-4.0-main/src/api/index.ts:203), [admin save](F:/CALVAC-4.0-main/CALVAC-4.0-main/src/pages/admin/AdminProductsPage.tsx:754), [offer save](F:/CALVAC-4.0-main/CALVAC-4.0-main/src/pages/admin/AdminSettingsPage.tsx:1278).

### 7. P2 — Animation loads 15.5 MB and retains a large image sequence

**Measured assets:** 120 GIFs, **15,498,851 bytes**, each **800 × 1422**. One RGBA surface per frame would total **546,048,000 bytes**, about **521 MiB**. This is an estimate of decoded surfaces, not a measured browser heap allocation; browser decoding and eviction vary.

The loader ultimately requests every frame, even on mobile or after animation skip. Its cleanup removes only the resize listener; sequential promises, idle callbacks, and timers continue after unmount. Load progress also updates React state for every frame, and scroll changes rerender the full component through `activeFrame`.

Fix: use fewer/smaller modern-format frames or a suitable video strategy, honor reduced motion/data-saving preferences, and keep a bounded frame buffer. Cancel pending work and release images on unmount/skip. Draw from refs/motion values and batch UI progress updates. Fix the resize callback's captured initial frame/settings while revising this component.

References: [loader](F:/CALVAC-4.0-main/CALVAC-4.0-main/src/components/ScrollyShoeExperience.tsx:199), [cleanup](F:/CALVAC-4.0-main/CALVAC-4.0-main/src/components/ScrollyShoeExperience.tsx:268), [scroll state](F:/CALVAC-4.0-main/CALVAC-4.0-main/src/components/ScrollyShoeExperience.tsx:167).

### 8. P2 — First render waits on a database-backed stylesheet

The document loads `/api/theme-css` as a normal stylesheet. That endpoint makes a Supabase request with the default 10-second timeout, and both endpoint and deployment configuration disable caching. The synchronous `theme-init.js` follows this stylesheet. This introduces an avoidable server/database dependency on the first-render path for every page.

Fix: ship default or last-published theme CSS as static content, or apply a validated cached theme immediately and refresh asynchronously. Cache public theme/settings responses with a short TTL and explicit invalidation. Keep admin/auth/order responses uncached.

References: [document head](F:/CALVAC-4.0-main/CALVAC-4.0-main/index.html:39), [theme endpoint](F:/CALVAC-4.0-main/CALVAC-4.0-main/api/theme_css.py:76), [response caching](F:/CALVAC-4.0-main/CALVAC-4.0-main/api/_lib/_responses.py:38).

### 9. P2 — Address entry removes spaces while the customer types

**Confirmed in a browser.** Each change runs `cleanStr`, which trims the whole input. Typing `John Doe` character by character produces `JohnDoe`: the space after `John` is removed before the next character arrives. This also affects multiword street, city, and state values.

Fix: preserve editing text during input, remove unsafe control characters without trimming, and trim when saving/submitting.

References: [address input handler](F:/CALVAC-4.0-main/CALVAC-4.0-main/src/pages/CartPage.tsx:19), [trim behavior](F:/CALVAC-4.0-main/CALVAC-4.0-main/src/utils/validation.ts:8).

### 10. P2 — Cart quantity and selected-variant state disagree with validation

**Quantity mismatch confirmed in a browser:** ten increments changed quantity 1 to 11; the API limit is 10. `addItem` also increments without a cap, and the cart can grow beyond the API's 20-line limit.

Separately, changing color does not clear/revalidate the selected size. `canAdd` checks a size is present and the product-wide flag is clear, but does not check stock for the newly selected color/size. A size selected in an available color can remain selected after switching to a sold-out variant. This is a confirmed UI validation gap; database enforcement remains unverified.

Fix: enforce shared cart limits, revalidate selection when variants change, and check current variant stock before adding and checking out. Keep authoritative enforcement in the order transaction.

References: [cart mutations](F:/CALVAC-4.0-main/CALVAC-4.0-main/src/context/CartContext.tsx:56), [add eligibility](F:/CALVAC-4.0-main/CALVAC-4.0-main/src/pages/ProductPage.tsx:144), [API limits](F:/CALVAC-4.0-main/CALVAC-4.0-main/api/_lib/_validation.py:9).

### 11. P2 — Server order validation accepts malformed customer data and noninteger quantities

**Confirmed with direct validation probes.** A phone of `abcdef` and PIN of `xxxxxx` pass validation. Quantity `true` becomes 1, and 1.9 becomes 1. Product IDs, size/color membership, and size-unit consistency are not checked against products in this validator; some checks may be implemented by the missing SQL function.

Fix: require an integer JSON quantity while excluding booleans, validate phone/PIN formats on the server, and validate variant membership in the transaction. Avoid silently truncating invalid identifiers/data into accepted values. Browser checks alone are bypassable.

Reference: [order validator](F:/CALVAC-4.0-main/CALVAC-4.0-main/api/_lib/_validation.py:458).

### 12. P2 — Saving policies destroys Markdown line structure

**Confirmed with a settings-validation probe.** Server `clean_str` removes newlines and tabs. Policy values use this helper even though policy rendering depends on blank lines, line-start headings, and list entries. `# Shipping\n\nFirst paragraph.\n\n- Item one` becomes `# ShippingFirst paragraph.- Item one`.

Fix: use a multiline text sanitizer for policy content, preserve CR/LF consistently, and keep output HTML sanitization. Verify a save/load round trip with headings, paragraphs, and lists.

References: [string cleaner](F:/CALVAC-4.0-main/CALVAC-4.0-main/api/_lib/_validation.py:210), [policy cleaning](F:/CALVAC-4.0-main/CALVAC-4.0-main/api/_lib/_validation.py:403), [Markdown rendering](F:/CALVAC-4.0-main/CALVAC-4.0-main/src/pages/PolicyPage.tsx:20).

### 13. P2 — Rate-limit denials keep extending the lockout window

**Confirmed with mocked Redis command execution and a simulated clock.** Each hit runs `INCR` and an unconditional `EXPIRE`, including rejected hits. A requester that keeps retrying never gets the advertised recovery after the original window, and old hits are not aged out individually. The development implementation uses a different rolling-window behavior.

Fix: use one atomic Lua operation or a supported limiter algorithm, set expiry only when creating the fixed-window counter, and return an accurate retry interval. Validate per-command Redis errors rather than treating a missing count as zero.

Reference: [Upstash pipeline](F:/CALVAC-4.0-main/CALVAC-4.0-main/api/_lib/_rate_limit.py:59).

### 14. P2 — Public pages eagerly download the admin bundle

**Confirmed from generated HTML and browser requests.** All routes are imported statically. Manual chunking changes output files but does not defer loading: `dist/index.html` preloads `admin-bundle`, and the main entry imports it. The cart page requested it without visiting admin.

Measured JavaScript: entry 97.44 kB, motion 122.57 kB, React 164.65 kB, admin 320.38 kB; combined roughly 705 kB uncompressed / 205 kB gzip. The admin chunk includes shared dependencies, so its entire size is not a guaranteed lazy-loading saving.

Fix: use route-level dynamic imports and Suspense, scope admin session setup to admin routes where practical, and separate shared dependencies from admin UI. Load admin CSS with admin routes.

References: [route imports](F:/CALVAC-4.0-main/CALVAC-4.0-main/src/App.tsx:10), [manual chunks](F:/CALVAC-4.0-main/CALVAC-4.0-main/vite.config.ts:33), [global admin CSS](F:/CALVAC-4.0-main/CALVAC-4.0-main/src/main.tsx:5).

### 15. P2 — Error handling can hide outages and failed admin saves

The homepage's `Promise.all` has no catch. If products fail, settings/offer results are not applied, loading ends, and the page shows an empty catalog without a retry message. Shop load failures also appear as no products. Most settings save handlers and dashboard status/notes writes have no error catch, despite the API helper throwing on non-2xx responses. Errors from asynchronous handlers are not caught by React's render error boundary.

Fix: handle each load/save failure explicitly, preserve already available data, show actionable retry feedback, and track in-progress state per mutation. On the product page, stop the primary loading indicator once the product is ready instead of waiting for optional similar products.

References: [homepage load](F:/CALVAC-4.0-main/CALVAC-4.0-main/src/pages/HomePage.tsx:28), [settings saves](F:/CALVAC-4.0-main/CALVAC-4.0-main/src/pages/admin/AdminSettingsPage.tsx:1265), [order updates](F:/CALVAC-4.0-main/CALVAC-4.0-main/src/pages/admin/AdminDashboardPage.tsx:44), [similar-product wait](F:/CALVAC-4.0-main/CALVAC-4.0-main/src/pages/ProductPage.tsx:113).

### 16. P2 — Catalog and order APIs lack pagination

The public and admin catalog queries stop at 500 rows, ordered by ascending ID. Additional products silently disappear from listing and admin management, even though single-product reads may still work. Orders request `select=*` with no pagination and are subject to the backend's configured row cap. The UI labels the returned subset as a total and has no way to request older pages.

Fix: add stable cursor pagination, explicit counts where needed, server-side filters/search, and an index strategy based on actual database queries. Return only necessary fields for list views. Do not solve this by raising row limits indefinitely.

References: [public catalog](F:/CALVAC-4.0-main/CALVAC-4.0-main/api/store.py:148), [admin catalog](F:/CALVAC-4.0-main/CALVAC-4.0-main/api/admin.py:253), [orders](F:/CALVAC-4.0-main/CALVAC-4.0-main/api/admin.py:288).

### 17. P2 — Upload endpoint is incompatible with Python 3.13+

**Conditional deployment issue.** `api/upload.py` imports standard-library `cgi`; this was [removed in Python 3.13](https://docs.python.org/3.13/library/cgi.html). There is no checked-in Python version pin, and `api/requirements.txt` is empty. The current [Vercel runtime documentation](https://vercel.com/docs/functions/runtimes/python) lists 3.12 as default, so this is not evidence that today's deployment is broken. Selecting 3.13/3.14, or a future default change, prevents this endpoint from importing.

Fix: migrate to a maintained multipart parser with explicit size limits. Pin/document the supported Python version and dependencies; 3.12 pinning is a temporary compatibility measure.

Reference: [cgi import](F:/CALVAC-4.0-main/CALVAC-4.0-main/api/upload.py:2).

### 18. P2 — Theme initialization reads obsolete cache keys

**Confirmed by executing the actual initialization script.** The API stores settings under `calvac_settings_v6`, but `theme-init.js` only reads v4/v5. A v6 cached primary color of `#FF00FF` resulted in the default `#2B9FD8` being applied. Older v4/v5 values can also override newer cached settings during startup. This weakens the intended theme-before-paint behavior and can create a color flash.

Fix: centralize the cache version/normalization contract, migrate or discard old keys, and make the initial theme follow the same source of truth as later refreshes.

References: [current version](F:/CALVAC-4.0-main/CALVAC-4.0-main/src/api/index.ts:6), [old initialization keys](F:/CALVAC-4.0-main/CALVAC-4.0-main/public/theme-init.js:69).

### 19. P2 — Search requests can overwrite newer results

Clearing the debounce timer does not cancel an already-started request. A slow response for an earlier query can arrive after a newer query or after the input has been cleared and overwrite the displayed results. The result is not checked against the current query, and the timer has no unmount cleanup.

Fix: cancel old requests or use a monotonically increasing request identifier/current-query check. Distinguish network/rate-limit errors from a valid empty result instead of converting every error into `[]`.

References: [search handler](F:/CALVAC-4.0-main/CALVAC-4.0-main/src/components/Header.tsx:49), [swallowed search errors](F:/CALVAC-4.0-main/CALVAC-4.0-main/src/api/index.ts:232).

## Database security: unresolved high-priority verification

The checkout depends on `create_order_with_stock`, but no schema, migration, function definition, RLS policies, grants, or database tests are included. **This is a verification gap, not a confirmed database vulnerability.** The unused Python stock/price helpers do not prove the live RPC performs their checks.

Before treating checkout/security as verified, inspect:

- RPC execution privileges. Anonymous/authenticated callers should not be able to invoke a privileged order function directly and bypass Python validation, Upstash limits, and idempotency. Supabase documents [function execution privileges and security-definer behavior](https://supabase.com/docs/guides/database/functions).
- RLS and grants for `orders`: customer names, phone numbers, addresses, and notes must not be publicly readable or writable. Public keys are intentionally visible in a Supabase browser client; hiding them is not a security control. Review [RLS behavior](https://supabase.com/docs/guides/database/postgres/row-level-security).
- Anon product reads: public queries do not explicitly filter `active=true`; inactive-product visibility must be enforced through RLS or an explicit public view/query filter.
- Transactional stock locking/decrement, aggregation of requests drawing from the same stock pool, supported size/color/unit membership, authoritative variant pricing, and rollback on failure.
- Idempotency uniqueness and order result recovery in the same transaction.
- Cancellation transitions/restocking: `api/admin.py` patches only status. A database trigger may implement inventory restoration, but no such definition is supplied.
- The RPC return shape: the API sends its result directly back to the anonymous checkout caller. Return only the newly created order's safe confirmation fields.

[DATABASE_SECURITY_REVIEW.sql](F:/CALVAC-4.0-main/CALVAC-4.0-main/DATABASE_SECURITY_REVIEW.sql:1) contains read-only inspection queries. Review output privately because function definitions may contain operational details. No database changes or live security probes were performed.

## Additional improvements

- **Product content integrity:** ratings/counts and material descriptions are generated from product IDs, not reviews/specifications. This can present invented customer feedback and inaccurate material claims. Replace these with actual data or remove them. References: [ratings](F:/CALVAC-4.0-main/CALVAC-4.0-main/src/utils/index.ts:28), [descriptions](F:/CALVAC-4.0-main/CALVAC-4.0-main/src/utils/index.ts:92).
- **Keyboard access:** product cards and brand tiles use clickable divs without link semantics for the whole card/tile. Use links/buttons, accessible names, and visible focus states. Honor reduced-motion preferences for animation and autoplay.
- **Background CPU:** the custom cursor writes left/top every animation frame, including on touch devices where CSS hides it. Stop when idle/hidden, use transform-based positioning, and remove element listeners on cleanup. Reference: [cursor loop](F:/CALVAC-4.0-main/CALVAC-4.0-main/src/components/Layout.tsx:24).
- **Auth maintainability:** three places scan arbitrary localStorage keys for a token. Use the configured Supabase client's current session rather than taking the first matching stored token. The frontend route guard checks session existence, not admin role; the server checks remain the actual boundary.
- **Operational readiness:** add environment/setup documentation, version pins, database migrations, a `.gitignore`, and meaningful automated checks. No project test suite or CI configuration was supplied. Include build + typecheck + critical checkout/authorization tests in CI. The build script currently does not run TypeScript checking.
- **Remove stale paths:** unused Three.js hero code/dependencies and Flask-session troubleshooting messages no longer match the active animation/auth implementation. Removing unused code reduces maintenance scope; tree-shaken code should not be counted as current browser payload.
- **Customer data persistence:** address details are stored indefinitely in localStorage without an expiry or explicit remember-address control. Define the intended persistence behavior and guard storage writes against quota/security exceptions.

## Verification and limits

| Check | Result |
| --- | --- |
| Locked dependency install | Passed with install scripts disabled. |
| Vite production build | Passed; 1,934 modules transformed. |
| TypeScript `--noEmit` | Passed. |
| Python source parsing | All 15 source files passed. |
| Server validation/idempotency/limiter probes | Passed as reproductions of the reported bugs; all external calls mocked. |
| Frontend function probes | Confirmed image erasure, TTL bypass, incomplete product cache invalidation, and v6 theme-cache mismatch. |
| Browser checkout/address/cart checks | Confirmed whitespace loss, two submissions from two checkout clicks, quantity 11, and eager admin loading; no page JavaScript exceptions in this scenario. |
| Mobile cart layout at 390 px | Summary fit within the viewport; no overflow finding was retained. |
| npm security audit | 10 affected packages: 5 high, 4 moderate, 1 low; exit code 1 is expected for findings. |
| Live Supabase, ImageKit, Upstash, Vercel behavior | Not exercised; credentials/deployment/database definitions were not supplied. |

Audit probes and JSON evidence are saved under [the audit artifact directory](C:/Users/ME/.codex/visualizations/2026/10/19/01a15296-9966-7a10-bf95-b3cc1fc88c68/). Browser network requests were limited to an isolated local build; external services were blocked and orders were mocked. A screenshot uses fixture data and blocked external images, so it is not a production visual-quality assessment.

This directory has no Git metadata. Commit history, deployment history, actual production secrets/configuration, database indexes, real-user performance metrics, and existing production data were outside the available evidence.

## Suggested implementation sequence

1. Repair image saving, address input, cart constraints, and checkout confirmation/retry flow. Make server idempotency transactional and verify the database RPC/RLS/grants.
2. Isolate the development backend and update vulnerable dependencies with compatibility checks.
3. Correct cache freshness/invalidation, remove the database dependency from first paint, and reduce/cancel frame loading.
4. Lazy-load admin routes, add pagination and visible error/retry states, then pin/migrate the Python upload runtime.
5. Add focused regression tests and reproducible environment/database setup, then measure performance with production-like data on a mobile connection.
