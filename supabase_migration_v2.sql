-- Iron Engine v2 — security + data migration
-- Run once in Supabase → SQL Editor. Safe to re-run (IF NOT EXISTS / DROP IF EXISTS everywhere).
--
-- WHY: the original schema left products, exercises, technique_lab, engine_versions,
-- decision_audit_logs, security_audit_logs, weak_point_mappings and progression_rules
-- WITHOUT row-level security. Anyone with the public anon key could UPDATE products.price_cents
-- and buy Pro for ₹1. The server (service role) bypasses RLS, so the app keeps working.

-- 1. Lock every reference table: read-only for logged-in users, no writes from the browser.
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read active products" ON public.products;
CREATE POLICY "Anyone can read active products" ON public.products FOR SELECT USING (is_active = true AND is_deleted = false);

ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read exercises" ON public.exercises;
CREATE POLICY "Anyone can read exercises" ON public.exercises FOR SELECT USING (is_deleted = false);

ALTER TABLE public.technique_lab ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read technique lab" ON public.technique_lab;
CREATE POLICY "Anyone can read technique lab" ON public.technique_lab FOR SELECT USING (is_deleted = false);

ALTER TABLE public.engine_versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read engine versions" ON public.engine_versions;
CREATE POLICY "Anyone can read engine versions" ON public.engine_versions FOR SELECT USING (true);

ALTER TABLE public.weak_point_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progression_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_audit_logs ENABLE ROW LEVEL SECURITY;
-- (no policies = no browser access at all; only the server reads/writes these)

-- 2. Decision logs contain the athlete's lift ratios — only the owner may read them.
ALTER TABLE public.decision_audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own decision logs" ON public.decision_audit_logs;
CREATE POLICY "Users can read own decision logs" ON public.decision_audit_logs FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.generated_programs gp WHERE gp.id = decision_audit_logs.program_id AND gp.user_id = auth.uid()));

-- 3. Engine version row for v2 (the API also creates it if missing).
INSERT INTO public.engine_versions (version_string, is_active, release_notes)
VALUES ('2.0', true, 'Iron Engine v2 — Lalit Lifts Powerlifting System: meet-date-driven phasing, weak-point variations, injury load caps')
ON CONFLICT (version_string) DO NOTHING;

-- 4. Helpful indexes for the dashboard queries.
CREATE INDEX IF NOT EXISTS idx_workout_logs_program ON public.workout_logs (user_id, program_id, date_completed DESC);
CREATE INDEX IF NOT EXISTS idx_generated_programs_active ON public.generated_programs (user_id, is_active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscriptions_active ON public.subscriptions (user_id, status, end_date DESC);
