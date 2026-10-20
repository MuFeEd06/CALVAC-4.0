# Public caching and request audit

Public data uses a bounded memory cache with shared pending requests. Catalog query parameters are sorted so equivalent filters share a cache key. Errors are never cached. Expiry is checked when data is requested; there is no polling or timer that refetches an idle page.

| Response | Lifetime | Survives reload |
| --- | --- | --- |
| Product collection, filtered page, pagination | 60 seconds | Yes |
| Individual product details | 15 seconds | Yes |
| Public site settings and policies | 5 minutes | Yes |
| Offer ribbon | 60 seconds | Yes |
| Successful search results | 30 seconds | No, memory only |
| Checkout methods | Fresh when a nonempty cart opens, or on explicit retry | No |
| Account, order, payment, admin, assistant | Fresh requests; existing bounded payment-status polling only | No API response cache |

`calvac_public_cache_v1` allows only public products/settings/offer paths. It stores at most 40 entries and 512 KiB of serialized UTF-16 data. Memory has an LRU cap of 100 entries. Expired entries are discarded, storage failures fall back to memory, and clock anomalies cannot extend persisted data beyond its endpoint lifetime. Private API data and search text cannot be persisted through this cache. Supabase sessions, cart data, and the existing session-only checkout receipt have their separate lifecycle.

Successful orders and admin product/status changes invalidate product and search data, including persisted products. Admin offer/settings saves invalidate their public entries; settings saves also seed the new settings value. Storage events invalidate other tabs' in-memory views on their next request. Other browsers receive admin changes when the corresponding TTL expires. The old `calvac_settings_v8` value is only a pre-render theme bootstrap; API reads use the timed cache above. Server checkout still validates current prices, enabled payment methods, stock, and idempotency.

The previous project's `static/script.js` saved `claxxic_products` but still fetched on every `fetchProducts()` call; it had no timestamp expiry for that copy. The upgrade previously had only a 30-second in-memory catalog/settings/offer cache. The new cache adds reload reuse with explicit lifetimes.

## Requests removed or avoided

- Collection headers, empty search state, contact icons and collection-art fallbacks are inline SVGs, with no ImageKit request.
- The CALVAC mark is inline SVG. The 17 third-party brand marks remain their existing 80px ImageKit assets. CSS reverses their colors without requesting another image; collection and brand pages reuse the same brand URLs. Product photography and collection carousel artwork still intentionally use ImageKit with lazy loading and responsive sizes.
- New Arrivals does not request products when disabled. Layout/home settings reads share one request; reloads reuse unexpired public entries.
- New Arrivals' decorative blurred background now shares the foreground card's exact responsive URL instead of requesting a separate 80px/quality-50 transformation for every active shoe.
- Search keeps its 320ms debounce, cancels obsolete requests, and reuses completed identical queries for 30 seconds. Search text stays in memory. Short server searches return without a database read or a rate-limit database write; valid searches retain persistent rate limits.
- Contact policy links navigate within the app. Empty carts do not fetch payment configuration. Load-more clicks have a synchronous guard and merge product IDs without duplicate cards.

Catalog/search/settings/offer responses retain the existing short Vercel CDN cache (15 seconds plus 15 seconds of stale-while-revalidate). Inventory expiry maintenance remains bounded to once per 30 seconds per warm server instance; it is necessary to release unpaid reservations. Authenticated endpoints remain private/no-store. No schema changes, paid services, service workers, or unbounded catalog downloads are required.

## Price filter correction

The live `products.price` column is an integer. Sending `price=lte.1500.0` caused PostgREST to reject price collections. The server now validates finite bounded decimal inputs and emits whole-number comparisons (`lte.1500`). Decimal maximums round down and minimums round up, preserving the set of matching integer prices. Zero remains a valid bound, reversed/invalid ranges are rejected before database or inventory maintenance calls, and the browser no longer truncates decimal inputs or silently drops zero.
