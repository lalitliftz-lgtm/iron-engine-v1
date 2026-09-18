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

**Razorpay** (payments)
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` — Razorpay dashboard → Settings → API
  Keys (use **test** keys first).
- `RAZORPAY_WEBHOOK_SECRET` — set after step 4.
- `PAYMENT_PROVIDER=razorpay`

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

## Step 4 — Wire the Razorpay webhook
1. After deploy you'll have a URL like `https://your-app.vercel.app`.
2. In Razorpay dashboard → Settings → Webhooks, add:
   `https://your-app.vercel.app/api/payments/webhook`
3. Copy the webhook signing secret into Vercel as `RAZORPAY_WEBHOOK_SECRET`,
   then redeploy.

## Step 5 — Custom domain (optional)
Vercel → Project → Settings → Domains → add your domain and follow the DNS
instructions.

## Env variable checklist
| Variable | Where | Secret? |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase API settings | No |
| `VITE_SUPABASE_ANON_KEY` | Supabase API settings | No |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase API settings | **Yes** |
| `PAYMENT_PROVIDER` | set to `razorpay` | No |
| `RAZORPAY_KEY_ID` | Razorpay API keys | No |
| `RAZORPAY_KEY_SECRET` | Razorpay API keys | **Yes** |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay webhook (step 4) | **Yes** |

## Before real payments go live
Edit `src/config/siteConfig.js`:
- `coachingFormUrl` is currently `"#"` — set your real Google Form link.
- Confirm each product's `productName` matches a row in the `products` table
  (see `supabase_schema.sql`) so checkout resolves the right price.
- Switch Razorpay from test keys to live keys.
