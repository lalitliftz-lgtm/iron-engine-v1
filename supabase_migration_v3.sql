-- Iron Engine — migration v3 (security hardening). Run once in Supabase → SQL Editor.
-- Safe to run more than once.
--
-- Every write to programs and workout logs already goes through the app's server (/api/*), which uses the
-- service role and is not affected by these policies. The browser should not be able to write them
-- directly: today a logged-in user could insert unlimited "Pro" programs from the browser console
-- (bypassing the free-tier limit), edit their saved programs, or set profiles.role = 'admin'.

DROP POLICY IF EXISTS "Users can insert own programs" ON public.generated_programs;
DROP POLICY IF EXISTS "Users can update own programs" ON public.generated_programs;
DROP POLICY IF EXISTS "Users can insert own logs" ON public.workout_logs;
DROP POLICY IF EXISTS "Users can update own logs" ON public.workout_logs;
-- The app never updates `profiles` from the browser; this policy let a user change their own role.
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- One purchase row per user and product (a double checkout could create two and break the download).
-- Created only when no duplicates exist yet; otherwise a notice tells you to clean them up first.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.purchases GROUP BY user_id, product_id HAVING count(*) > 1) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS purchases_user_product_uniq ON public.purchases (user_id, product_id);
  ELSE
    RAISE NOTICE 'purchases has duplicate (user_id, product_id) rows — remove the extras, then run this again.';
  END IF;
END $$;
