-- ============================================================
--  v4 — Products: Powerlifting System 2.0 (₹1,499) + current system renamed to 1.0 (₹999)
--       + Iron Engine Pro plans: 1 / 3 / 6 / 12 months
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

-- 3. Iron Engine Pro plans: 1 month ₹1,499 · 3 months ₹3,499 · 6 months ₹5,999 · 1 year ₹9,999.
--    duration_days = how long one payment unlocks Pro. The existing "Iron Engine Pro" row becomes the 1-month plan
--    (same id). People who already paid for a year keep their full year.
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS duration_days INTEGER;
UPDATE public.products SET price_cents = 149900, duration_days = 30, updated_at = NOW() WHERE name = 'Iron Engine Pro';
INSERT INTO public.products (name, type, price_cents, duration_days, short_description, version, is_active)
SELECT v.name, 'subscription', v.price_cents, v.days, v.descr, '1.0', true
FROM (VALUES
  ('Iron Engine Pro — 3 Months', 349900, 90,  'Iron Engine Pro for 3 months.'),
  ('Iron Engine Pro — 6 Months', 599900, 180, 'Iron Engine Pro for 6 months.'),
  ('Iron Engine Pro — 1 Year',   999900, 365, 'Iron Engine Pro for 1 year.')
) AS v(name, price_cents, days, descr)
WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.name = v.name);

-- 4. Check: 2 PDF rows + 4 Pro plans with these prices.
SELECT name, type, price_cents / 100 AS price_rupees, duration_days, storage_path, is_active
FROM public.products
WHERE name IN ('Powerlifting System 2.0', 'All About Powerlifting System 1.0') OR name LIKE 'Iron Engine Pro%'
ORDER BY type, price_cents;

-- 5. Invite-only free Pro (testers): one code = one free month (30 days) per person.
--    Create a code (change the text and how many people may use it):
--      INSERT INTO public.invite_codes (code, max_uses, note) VALUES ('LALIT-TEST-01', 10, 'Gym testers batch 1');
--    Stop a code:   UPDATE public.invite_codes SET is_active = false WHERE code = 'LALIT-TEST-01';
--    Who used it:   SELECT * FROM public.invite_redemptions ORDER BY redeemed_at DESC;
CREATE TABLE IF NOT EXISTS public.invite_codes (
    code TEXT PRIMARY KEY,
    max_uses INTEGER NOT NULL DEFAULT 1 CHECK (max_uses > 0),
    uses INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    expires_at TIMESTAMPTZ,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.invite_redemptions (
    code TEXT NOT NULL REFERENCES public.invite_codes(code),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (code, user_id)
);
-- No browser access at all: codes are checked only by the server.
ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invite_redemptions ENABLE ROW LEVEL SECURITY;

-- The free month is its own product row: price 0, never sold (is_active = false), shows as "Iron Engine Pro — Invite".
INSERT INTO public.products (name, type, price_cents, duration_days, short_description, version, is_active)
SELECT 'Iron Engine Pro — Invite', 'subscription', 0, 30, 'Free month of Iron Engine Pro by invite.', '1.0', false
WHERE NOT EXISTS (SELECT 1 FROM public.products WHERE name = 'Iron Engine Pro — Invite');

-- Redeem in one locked step, so a code can never be used more times than allowed.
CREATE OR REPLACE FUNCTION public.redeem_invite(p_code TEXT, p_user UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c public.invite_codes;
  prod UUID;
  base TIMESTAMPTZ;
  ends TIMESTAMPTZ;
BEGIN
  SELECT * INTO c FROM public.invite_codes WHERE upper(code) = upper(trim(p_code)) FOR UPDATE;
  IF NOT FOUND OR NOT c.is_active THEN RETURN jsonb_build_object('ok', false, 'error', 'This invite code is not valid.'); END IF;
  IF c.expires_at IS NOT NULL AND c.expires_at < NOW() THEN RETURN jsonb_build_object('ok', false, 'error', 'This invite code has expired.'); END IF;
  IF c.uses >= c.max_uses THEN RETURN jsonb_build_object('ok', false, 'error', 'This invite code has already been used up.'); END IF;
  IF EXISTS (SELECT 1 FROM public.invite_redemptions WHERE code = c.code AND user_id = p_user) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You have already used this invite code.');
  END IF;
  SELECT id INTO prod FROM public.products WHERE name = 'Iron Engine Pro — Invite';
  IF prod IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Invites are not set up yet.'); END IF;
  -- Already Pro? The free month starts when the current Pro ends.
  SELECT max(end_date) INTO base FROM public.subscriptions WHERE user_id = p_user AND status = 'active' AND end_date > NOW();
  base := COALESCE(base, NOW());
  ends := base + INTERVAL '30 days';
  INSERT INTO public.subscriptions (user_id, product_id, status, start_date, end_date, razorpay_payment_id)
  VALUES (p_user, prod, 'active', base, ends, 'invite:' || c.code || ':' || p_user);
  INSERT INTO public.invite_redemptions (code, user_id) VALUES (c.code, p_user);
  UPDATE public.invite_codes SET uses = uses + 1 WHERE code = c.code;
  INSERT INTO public.security_audit_logs (user_id, action, metadata) VALUES (p_user, 'INVITE_REDEEMED', jsonb_build_object('code', c.code));
  RETURN jsonb_build_object('ok', true, 'end_date', ends);
END $$;
REVOKE ALL ON FUNCTION public.redeem_invite(TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_invite(TEXT, UUID) TO service_role;
