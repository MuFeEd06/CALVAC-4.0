# Particle hero, shared themes and WhatsApp duplicate protection

The supplied `calvac-shoe-hero (1).zip` design is adapted to the existing React/Python application. Its standalone server, account system, dependencies and Git history are not installed or executed. The separate Retro Court Hi images are included as the default particle shoe. Required image attribution remains visible when selecting the other supplied credited photos.

## Admin controls

Open **Site Settings → Hero Studio** at `/manage-store-x9k2/settings`.

- Select **Particles**, **Scroll animation**, or **Hidden**, then **Save hero experience**. Particles is the new saved default. Existing scroll controls are preserved and shown when that mode is selected.
- Choose separate laptop/desktop and mobile/tablet shoes. The breakpoint is 1024 px. Each device has its own scale and horizontal/vertical offsets, with a live image preview.
- Choose a supplied shoe or upload an image. Uploads use the existing authenticated ImageKit API and are prepared as WebP files under the server's 200 KB limit. Optional dark-mode image URLs are supported separately for each device. Custom URLs are restricted to HTTPS ImageKit hosts.
- Change the eyebrow, multiline headline, italic phrase and supporting copy. These settings are validated on the server.

The default palette follows the reference's warm off-white/black appearance, Geist typography, italic Instrument Serif accents and restrained rounded controls. Primary-color controls remain available in **Theme**. Foreground/background pairs are adjusted for readable contrast. The light/dark switch appears in the public header, admin header and admin login; the preference persists across navigation and reloads. First-paint and React theme logic share the same source, and the settings cache is versioned to prevent stale green/blue styling.

Only the selected hero module loads. Particles use device-appropriate sampling, pause off-screen/in hidden tabs, stop at rest, and release GPU resources on navigation. Reduced-motion/data-saving users and browsers without WebGL2 receive the still image. The scroll sequence remains buffered and lazy-loaded only when selected.

## WhatsApp cooldown

Matching WhatsApp carts from the same normalized phone number have a **five-minute cooldown**. Item comparison includes product, size/unit, color and quantity and ignores cart ordering. Changing a name/address does not bypass the guard. A transaction-level lock serializes concurrent matching requests, including requests with different idempotency keys. The indexed lookup also covers recent orders from the preceding deployment.

Retries using the original idempotency key still replay their confirmation. A blocked duplicate creates no order and deducts no stock; it returns a bounded retry interval without exposing an existing order/customer record. The browser shows a focused cooldown dialog and prevents another request during that interval. Different carts/customers remain valid, and cancelled orders do not block a new order. Existing order history is preserved.

The migration adds a private fingerprint column, a partial recent-order index and service-only `create_order_with_stock_v4`. It also selects the particle hero and monochrome default palette while preserving other store settings and scroll controls. Apply it before publishing the matching checkout API.

## Validation and rollout

Local checks cover input validation, separate device settings, safe upload preparation, first-paint theme consistency, contrast with bright primary colors, payment/stock transactions, distinct-key duplicate prevention, prior-deployment compatibility, cooldown expiry and cancellation. Browser checks cover actual WebGL particle rendering, mobile fallback, navigation/reload themes, rendered contrast, admin settings persistence, upload request compatibility, and the cooldown popup. Fixtures send no real orders, payments, emails or ImageKit uploads.

Release branch: `codex/hero-particles-theme`. Deploy a preview in the existing `calvac-4-0` project, verify it, then fast-forward `main` for production at `https://calvac.in`. To switch the homepage back, choose **Scroll animation** in admin and save. A full application rollback must retain the compatible database changes or restore the preceding API alongside the frontend; it does not require deleting any customer/order data.
