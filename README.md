# LalitLifts — Iron Engine (merged build)

Premium **dark** LalitLifts storefront + the full GLM backend
(Supabase auth, PayU payments, member dashboard) in one Vite/React app.

## What's inside
- **Public landing (`/`)** — dark LalitLifts branding, hero, 4 products,
  and the real **Iron Engine** free Week-1 sample (no login needed).
- **Auth** — Supabase email/password (login, signup, reset). The signup/login
  flow carries the product a visitor picked on the landing page straight
  through to checkout.
- **Payments** — PayU hosted checkout: server signs the order → browser is
  redirected to PayU → PayU posts back to `/api/payments/payu-callback` →
  hash verified → access granted → `/payment/processing` double-checks.
- **Dashboard** — everything from the backend: generated programs, athlete
  profile, technique lab, workout logging, library, billing, settings.
- **Dark theme** — one global layer (`tailwind.config.js` tokens +
  `src/index.css` override layer) flips the whole app to the iron palette
  (iron/steel/chalk/knurl · red `#C8102E` · brass `#C9A24B`), so every
  dashboard page inherits the look without page-by-page rewrites.

## Edit your brand in one place
`src/config/siteConfig.js` — brand name, Instagram, prices, product names.
Each product's `productName` must match a row in `products` (see the seed in
`supabase_schema.sql`) so checkout resolves the right PayU amount.

## Setup
1. Copy `.env.example` → `.env`, fill Supabase + PayU **test** keys.
2. `npm install`
3. Run `supabase_schema.sql` in the Supabase SQL editor.
4. `npm run dev`

## Deploy (Vercel)
1. Push to GitHub, import into Vercel.
2. Add every `.env` variable in Vercel project settings.
3. Deploy. No webhook setup needed — PayU returns to
   `/api/payments/payu-callback` automatically.

## Key files added/changed in the merge
```
src/config/siteConfig.js            brand + product catalogue
src/lib/engine.js                   Iron Engine logic (ported, deterministic)
src/components/engine/EngineUI.jsx  3-step wizard + result view
src/components/engine/EngineGate.jsx free sample → real checkout routing
src/pages/Landing.jsx               dark public storefront (new front door)
src/components/AuthShell.jsx        branded dark auth wrapper
src/pages/{Login,Signup,ForgotPassword}.jsx  restyled dark
src/components/{Footer,dashboard/DashboardLayout}.jsx  dark chrome
src/pages/dashboard/Subscription.jsx  real PayU checkout wired in
tailwind.config.js + src/index.css  dark palette + global flip layer
```
