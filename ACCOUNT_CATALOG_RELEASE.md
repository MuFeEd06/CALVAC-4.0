# Account, collections and product details

This release adds Google OAuth and email-verification resend to customer sign-in, repairs catalog filters and recommendations, and improves the mobile product page and social icons.

## Behavior

- Google sign-in uses the existing Supabase browser client and PKCE. The callback waits for the SDK's single code exchange, preserves a validated local destination, and handles cancelled/expired callbacks without treating an existing session as a successful new sign-in. Provider availability is checked using public Auth settings; the button is disabled with an email alternative until Google is enabled. No Google client secret belongs in the browser or repository. Admin authorization continues to be enforced by the verified API.
- `/verify-email` resends an existing signup confirmation through Supabase. Links from sign-in and registration carry the entered email using navigation state. No password is needed. The confirmation destination retains the original local route. A 60-second UI cooldown persists through reloads for the same email; Supabase's server delivery limits still apply. Responses do not disclose whether a registered account exists.
- Standalone PostgREST filters now URL-encode values without adding literal quotation marks. Values inside logical search expressions remain grammar-quoted. This repairs collection, brand and tag filtering, including admin brand filters. Collection links explicitly use `category=boots`, `category=crocs` and `category=girls`; previous `tag=...` links still work. Dragging collection cards does not trigger a link, and keyboard activation remains available after a drag.
- Similar products exclude the viewed item and duplicates. A bounded sequence tries the same brand, the same collection and then the general catalog, with a visible retry when all sources fail.
- Specifications use a native, keyboard-accessible rectangular disclosure and wrapping definition rows. Saved specification text is preserved. Products such as #33, which has no saved specification text, show known catalog facts (brand, size system, available sizes/colours and collection when assigned); material/care details are never invented. Admins can add those details in the existing product editor. The responsive product layout uses one column on mobile.
- The account text in the header is replaced with a labelled user icon. WhatsApp and Instagram marks are shared SVG components across the floating control, footer and contact page, removing low-resolution raster downloads.

## Google activation

The public production Auth settings currently report `external.google=false`. Website code alone cannot supply the store's Google OAuth credentials.

1. In [Google Auth Platform](https://console.cloud.google.com/auth/clients), create or select a **Web application** client owned by the store. Use `https://calvac.in` as an authorized JavaScript origin and `https://jjyysdxkoarjlxwttiak.supabase.co/auth/v1/callback` as the authorized redirect URI. Configure the consent screen/audience for the intended customers.
2. In [Supabase Google provider settings](https://supabase.com/dashboard/project/jjyysdxkoarjlxwttiak/auth/providers?provider=Google), enable Google and save that client's ID and secret directly in the dashboard. Do not put the secret in Vercel client variables, Git or chat.
3. Set the Supabase Auth Site URL to `https://calvac.in` and allow the application's `https://calvac.in/auth/callback` and `https://calvac.in/reset-password` destinations, including the callback's local redirect query. Add only intended preview/development URLs separately. Use the existing SMTP configuration for confirmation/reset mail; if SMTP is not configured, complete that setup before relying on production delivery.
4. Refresh sign-in and complete a normal Google sign-in with an intended account. The button reads the provider configuration automatically; no rebuild is needed after enabling it.

References: [Supabase Google OAuth](https://supabase.com/docs/guides/auth/social-login/auth-google), [resending confirmation email](https://supabase.com/docs/reference/javascript/auth-resend), [Auth redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls), [PostgREST filtering](https://docs.postgrest.org/en/stable/references/api/tables_views.html#horizontal-filtering).

## Validation

Production build and type checking pass. Thirteen targeted frontend/theme/product tests and 24 Python API tests pass. The full browser suite passes, including the new OAuth provider/PKCE callback fixtures, cancellation handling, resend/no-password/cooldown behavior, collection links, recommendation fallbacks, SVG controls and rendered mobile specification contrast. Existing checkout, payments, customer history, admin editing, hero switching and WhatsApp cooldown checks also pass. Browser fixtures send no real sign-ins, confirmation messages, orders, uploads or payments.

No database migration or product/customer data rewrite is needed. Live verification and deployment details are recorded after publishing.
