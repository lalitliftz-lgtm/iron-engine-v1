# LalitLifts — Deploy Guide (go live)

Your app builds cleanly and is ready to deploy. Follow these steps.

## What was fixed
- **App no longer goes blank when env vars are missing.** `src/lib/supabase.js`
  used to `throw` at startup, which blanked the *entire* site (even the public
  landing page). It now warns in the console instead, so the storefront always
  renders — only login/checkout stay inactive until keys are added.
- **SPA routing for production.** Added `vercel.json` so deep links like
  `/login`, `/dashboard`, `/terms` and page refreshes don't 404 on Vercel,
  while `/api/*` serverless functions keep working.
- **Favicon + SEO meta.** Added `public/favicon.svg` (was pointing at a missing
  file) plus a real page title, description, and theme color in `index.html`.

## Step 1 — Get your keys ready
You need two services:

**Supabase** (auth + database)
- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` — from Supabase → Project
  Settings → API.
- `SUPABASE_SERVICE_ROLE_KEY` — same page (keep secret, server-side only).
- Run `supabase_schema.sql` in the Supabase SQL editor to create the tables.

**PayU** (payments)
- `PAYU_KEY` and `PAYU_SALT` — PayU dashboard → Integrations / API keys
  (Merchant Key + Merchant Salt). Use **test** credentials first.
- `PAYU_MODE=test` while testing, `PAYU_MODE=live` when going live.
- `PAYMENT_PROVIDER=payu` (optional — this is the default).

## Step 2 — Test locally first
```bash
cp .env.example .env      # then fill in the values above
npm install
npm run dev               # opens http://localhost:5173
```
Open the site — the dark landing page should load. Test signup/login once
Supabase keys are in.

## Step 3 — Deploy to Vercel
1. Push this folder to a GitHub repo.
2. On vercel.com → **Add New → Project** → import that repo.
   Vercel auto-detects Vite (build `npm run build`, output `dist`).
3. In **Project → Settings → Environment Variables**, add **every** variable
   from your `.env` (both the `VITE_` ones and the secret server ones).
4. Click **Deploy**.

## Step 4 — Test a payment
No webhook setup is needed: the server passes the return URL
(`/api/payments/payu-callback`) to PayU on every checkout. After deploy,
log in, open Subscription, buy a product with PayU test cards, and confirm
you land on `/payment/processing` and then see access granted.

## Step 5 — Custom domain (optional)
Vercel → Project → Settings → Domains → add your domain and follow the DNS
instructions.

## Env variable checklist
| Variable | Where | Secret? |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase API settings | No |
| `VITE_SUPABASE_ANON_KEY` | Supabase API settings | No |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase API settings | **Yes** |
| `PAYMENT_PROVIDER` | `payu` (default, optional) | No |
| `PAYU_KEY` | PayU dashboard (Merchant Key) | No |
| `PAYU_SALT` | PayU dashboard (Merchant Salt) | **Yes** |
| `PAYU_MODE` | `test` or `live` | No |

## Before real payments go live
Edit `src/config/siteConfig.js`:
- `coachingFormUrl` is currently `"#"` — set your real Google Form link.
- Confirm each product's `productName` matches a row in the `products` table
  (see `supabase_schema.sql`) so checkout resolves the right price.
- Switch PayU to live credentials and set `PAYU_MODE=live`.

## Security migration (v2) — run once

Open Supabase → SQL Editor → paste and run `supabase_migration_v2.sql`. It enables row-level
security on the reference tables (products, exercises, engine_versions, …) so the public anon
key can only read them, never change prices. The app keeps working because the Vercel functions
use the service role key.

## Database setup order (fresh Supabase project) — run each file once, in this order
1. `supabase_schema.sql`
2. `supabase_migration_v2.sql` (reference tables read-only)
3. `supabase_migration_v3.sql` (removes browser write access to programs/logs/profiles — security)
4. `supabase_migration_v4_products.sql` (PDF products, Pro 1/3/6/12-month plans, invite codes)
5. `supabase_migration_v5_security.sql` (one payment = one grant, one free invite month per person)

All four migrations are safe to run again.

## Storage (PDF guides)
Supabase → Storage → New bucket **`pdf_guides`**, **Public OFF**. Upload, with exactly these names:
`powerlifting-system-2.pdf`, `powerlifting-system.pdf`, `learn-lift-eat.pdf` (free plan limit: 50 MB per file).

## Email (sign-up confirmation + password reset) — needed before real users
- Supabase → Authentication → **URL Configuration**: Site URL = your live URL
  (e.g. `https://iron-engine-v1.vercel.app`), and add `https://iron-engine-v1.vercel.app/**` (and your custom
  domain `/**`) to **Redirect URLs**. Otherwise verify/reset links point at localhost.
- Supabase → Authentication → **Emails → SMTP Settings**: connect a real sender (Resend, Brevo, Amazon SES…).
  Supabase's built-in sender is rate-limited to a few emails an hour and is meant for testing only.
- Keep **Confirm email** ON (the owner panel relies on a confirmed email).

## More environment variables
| Variable | What | Secret? |
|---|---|---|
| `OWNER_EMAIL` | The owner's login email — opens the Owner panel | No |
| `OWNER_USER_ID` | Optional: the owner's Supabase user id — extra lock on the Owner panel | No |

Set `PAYU_MODE=live` before launch — the Owner panel shows a warning while it is `test`.

## Hosting
Vercel's free **Hobby** plan is for non-commercial use; taking payments needs **Pro**. Server logs
(Vercel → Logs) are where API errors are written.
