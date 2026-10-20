# CALVAC authentication emails

These replace the default-looking signup verification and password-reset emails with CALVAC's monochrome palette and a text wordmark. They use a table layout, inline fallback styles, system fonts, responsive spacing, dark-mode styles, and a copyable backup link. No remote images, web fonts, scripts, or tracking pixels are required.

| Supabase template | Subject | HTML file |
| --- | --- | --- |
| Confirm signup | Confirm your email for CALVAC | `confirm-signup.html` |
| Reset password | Reset your CALVAC password | `reset-password.html` |

## Activate in the hosted project

The files are ready for activation. Committing or deploying the website does **not** update Supabase's hosted email templates.

1. Open the [project's email templates](https://supabase.com/dashboard/project/jjyysdxkoarjlxwttiak/auth/templates) in Supabase: Authentication → Email → Templates.
2. Open **Confirm signup**, set the subject from the table, replace the HTML body with the complete contents of `confirm-signup.html`, preview it, and save.
3. Open **Reset password**, set its subject, replace the HTML body with the complete contents of `reset-password.html`, preview it, and save.

Both templates retain `{{ .ConfirmationURL }}` in the button and backup link. Keep this variable intact so Supabase generates the correct single-use action and redirect. They do not hardcode an expiry duration or change the existing PKCE authentication flow. Customers should use the browser where they initiated the action. The footer links to the website's contact page; it does not assume a receiving inbox exists at the SMTP sender address.

The existing Resend SMTP configuration handles delivery separately. These designs do not change SMTP credentials, email delivery limits, Google sign-in, redirect allowlists, other templates, or security notification settings. Branded design does not guarantee Inbox placement.

`auth-email-templates.json` is a reviewable Management API payload containing only the two subjects and two HTML bodies. It contains no credentials or SMTP settings. The connected MCP server has no email-template editing operation; the browser connection also failed during this task, so the files have **not** been saved into hosted Supabase automatically. Use the dashboard steps above.

## Maintain and verify

Edit the shared layout and copy in `scripts/build-auth-emails.mjs`, then run:

```text
npm run build:emails
npm run test:emails
```

To check generated files without overwriting them, use `npm run build:emails -- --check`. The visual check renders both templates at 800, 390 and 320 pixels, in light and dark modes, with a long fake action URL. It checks readable contrast, horizontal overflow, keyboard access and preservation of the action URL. It makes no external requests and sends no email. Previews and screenshots are written to `test-results/auth-emails/`.

These browser renders are not a substitute for testing actual Gmail, Apple Mail and Outlook recipients after activation. Older email clients may show square corners or use their own dark-mode handling; the text and action link remain usable. Disable provider link tracking for Supabase authentication emails, as documented by Supabase.

Reference: [Supabase email templates](https://supabase.com/docs/guides/auth/auth-email-templates).
