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
