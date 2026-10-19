-- ============================================================
--  v5 — Payment & invite hardening. Run once in Supabase → SQL Editor. Safe to run again.
-- ============================================================

-- 1. One payment = one Pro grant, even if PayU's callback and the status check arrive at the same moment.
--    (Removes accidental duplicates first: keeps the earliest row per payment.)
DELETE FROM public.subscriptions s
USING public.subscriptions d
WHERE s.razorpay_payment_id IS NOT NULL
  AND s.razorpay_payment_id = d.razorpay_payment_id
  AND s.ctid > d.ctid;
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_payment_uniq
  ON public.subscriptions (razorpay_payment_id) WHERE razorpay_payment_id IS NOT NULL;

-- 2. People can read the products they own (the free-invite month is a hidden product, so its name
--    showed as blank in "My subscription" / history).
DROP POLICY IF EXISTS "Users can view products they own" ON public.products;
CREATE POLICY "Users can view products they own" ON public.products FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.product_id = products.id AND s.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.purchases p WHERE p.product_id = products.id AND p.user_id = auth.uid())
);

-- 3. Invites: ONE free month per person, whichever code they use.
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
  IF EXISTS (SELECT 1 FROM public.invite_redemptions WHERE user_id = p_user) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You have already used a free month invite.');
  END IF;
  SELECT id INTO prod FROM public.products WHERE name = 'Iron Engine Pro — Invite';
  IF prod IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Invites are not set up yet.'); END IF;
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

-- 4. Check: should list the new index.
SELECT indexname FROM pg_indexes WHERE tablename = 'subscriptions' AND indexname = 'subscriptions_payment_uniq';
