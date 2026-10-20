-- v6: stop selling System 1.0 and Learn Lift Eat & Repeat (landing shows System 2.0 only).
-- People who already bought them keep them in My Library and can still download.
-- Run once in Supabase → SQL Editor.
UPDATE public.products
SET is_active = false
WHERE name IN ('All About Powerlifting System 1.0', 'Learn Lift Eat & Repeat');
