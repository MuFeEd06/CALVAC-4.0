# Product guide and authentication email delivery

## Behavior

Product pages include an “Ask CALVAC” companion beside the product heading. The guide uses the selected colour, current product, and the previous three user questions. It can find shoes by name/model, brand, category, INR price range, colour, and listed UK/EU size. Cards link to the actual product pages. Stock and prices are refreshed from active public listings before answers are generated.

Gemini runs exclusively in `api/assistant.py` and `api/_lib/_assistant.py`. Set `GEMINI_API_KEY` as a sensitive Vercel environment variable for Production and Preview. The default model is `gemini-3.5-flash-lite`; `GEMINI_MODEL` can override it with a supported Gemini model ID. There is no key or direct Gemini request in the browser.

The retrieval implementation builds a 60-second text index of at most 1,000 active products, using bounded keyset reads. It ranks at most 32 candidates, refreshes their public details, and gives the model at most eight records. For a substantially larger catalog, replace this bounded scan with indexed server-side retrieval. It deliberately has no access to private orders, accounts, or customer records. Questions and public catalog text are treated as untrusted data. No model tools, SQL, browsing, ordering, or stock mutations are exposed.

Unrelated requests are declined. Missing size charts are stated explicitly; the guide does not guess cm/UK/EU conversions or guarantee fit. Stock and fit can change, so shoppers confirm options on the product page. Generative wording can still be imperfect; product cards and source facts remain authoritative. Invalid model IDs, ungrounded product references/prices, provider failures, and exhausted generation allowance fall back to deterministic catalog help.

Rate limits: 20 questions/minute and 200/day per IP; 300 model generations/day across the store. Production uses the existing atomic database rate limiter. This initial daily generation allowance bounds cost; catalog answers keep working after it is reached. Adjust these limits deliberately as traffic grows. Chat stays in page memory, and requests carry only three prior user questions. The application does not log prompts or provider credentials. Google receives the current question, this bounded history, and retrieved public product facts.

## Character and delivery

The supplied self-contained `character.glb` has been reduced from 5,934,516 bytes to 768,888 bytes, with an 11,064-byte WebP poster. It contains no skeletal animation; the interface adds subtle looking/bobbing reactions. The original file is untouched. Rebuild the optimized asset with:

```powershell
node scripts/optimize-companion.mjs 'C:\Users\ME\Downloads\character.glb'
```

The renderer is a separate dynamic chunk, loaded only when a product companion is visible. Reduced-motion and data-saver users receive the poster; chat stays fully available. Rendering stops while hidden or idle. Opening the guide transfers rendering to its header, and closing it returns rendering to the product tile. GPU resources are disposed on navigation; WebGL failure/context loss returns to the poster. The homepage does not download the assistant or character.

## Resend setup

Domain sending records are present in Vercel DNS for `calvac.in` (`resend._domainkey`, `send`, `rsend`). DNS records alone do not enable Supabase SMTP. Confirm the domain says **Verified** in Resend, then save the following in [Supabase SMTP settings](https://supabase.com/dashboard/project/jjyysdxkoarjlxwttiak/auth/smtp):

| Setting | Value |
| --- | --- |
| Custom SMTP | Enabled |
| Sender email | support@calvac.in |
| Sender name | CALVAC Support |
| Host | smtp.resend.com |
| Port | 465 |
| Username | resend |
| Password | A Resend sending API key, entered directly in Supabase |

Do not use the Gemini key as the SMTP password. Never commit the Resend key or put it in a `VITE_` variable. This sender configuration does not create an inbox for replies; receiving mail needs a mailbox/forwarder. Existing verification-resend and password-reset flows will use this SMTP provider after it is saved. No real email is sent by the automated fixture tests.

References: [Resend’s Supabase SMTP instructions](https://resend.com/docs/send-with-supabase-smtp), [Gemini model documentation](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite).

## Release checks

- Python tests cover budget/category/model retrieval, fresh active listings, selected-colour prices/stock, unknown sizes, scope guards, request validation, model output validation, quota/provider fallback, and fail-closed rate limiting.
- Browser fixtures cover keyboard/focus, double-send prevention, recoverable errors/retry, source links, both themes, mobile layout, reduced motion, actual WebGL rendering/context loss, and no companion downloads on the homepage.
- Existing checkout, duplicate-order cooldown, account, Google/verification UI, collection, specification, hero, and admin checks remain part of the regression suite.
- Before production, require the branch checks and Vercel preview to pass; make a bounded real Gemini request in preview and verify the production deployment afterward.

Rollback: redeploy the preceding `calvac-4-0` production deployment. This release adds no database migration and does not move domains or alter `claxxic-india`.
