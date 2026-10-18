-- ============================================================
--  v4 — PDF products: Powerlifting System 2.0 (₹1,499) + current system renamed to 1.0 (₹999)
--  Run once in Supabase → SQL Editor. Safe to run again.
--  Checkout finds products by NAME, so these names must match src/config/siteConfig.js exactly.
-- ============================================================

-- 1. The current system becomes "1.0". Same row (same id) → everyone who bought it keeps their access.
UPDATE public.products
SET name = 'All About Powerlifting System 1.0', price_cents = 99900, updated_at = NOW()
WHERE name = 'All About Powerlifting System';

-- 2. The new Powerlifting System 2.0 PDF.
--    The file itself goes in Storage → bucket "pdf_guides" → named exactly: powerlifting-system-2.pdf
INSERT INTO public.products (name, type, price_cents, short_description, version, storage_path, is_active)
SELECT 'Powerlifting System 2.0', 'pdf_guide', 149900,
       'The evolved Powerlifting System: programming, progression, periodization, fatigue, weak points, technique, building your own program and meet prep.',
       '1.0', 'powerlifting-system-2.pdf', true
WHERE NOT EXISTS (SELECT 1 FROM public.products WHERE name = 'Powerlifting System 2.0');

-- 3. Check: you should see both rows with these prices.
SELECT name, type, price_cents / 100 AS price_rupees, storage_path, is_active
FROM public.products WHERE type = 'pdf_guide' ORDER BY price_cents DESC;
