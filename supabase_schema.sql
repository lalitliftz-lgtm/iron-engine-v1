-- Run this in your Supabase SQL Editor

-- 1. Profiles & Auth Extensions
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    is_deleted BOOLEAN NOT NULL DEFAULT false,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Commerce & Subscriptions
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('subscription', 'pdf_guide')),
    price_cents INTEGER NOT NULL,
    razorpay_link TEXT,
    is_active BOOLEAN DEFAULT true,
    short_description TEXT,
    version TEXT DEFAULT '1.0',
    cover_image_url TEXT,
    storage_path TEXT,
    release_notes JSONB DEFAULT '[]'::jsonb,
    is_deleted BOOLEAN NOT NULL DEFAULT false,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id),
    status TEXT NOT NULL CHECK (status IN ('active', 'expired', 'cancelled')),
    start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    end_date TIMESTAMPTZ NOT NULL,
    razorpay_payment_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id),
    razorpay_payment_id TEXT,
    purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    product_id UUID REFERENCES public.products(id),
    provider TEXT NOT NULL,
    provider_order_id TEXT,
    provider_payment_id TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL,
    currency TEXT NOT NULL,
    amount_paid DECIMAL(10,2) NOT NULL,
    raw_payload JSONB NOT NULL,
    payment_timestamp TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Athlete Data & Logging
CREATE TABLE IF NOT EXISTS public.athlete_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
    full_name TEXT,
    age INTEGER,
    sex TEXT,
    height_cm INTEGER,
    bodyweight_kg DECIMAL(5,2),
    experience_level TEXT,
    squat_1rm DECIMAL(5,2),
    bench_1rm DECIMAL(5,2),
    deadlift_1rm DECIMAL(5,2),
    training_days_per_week INTEGER,
    primary_goal TEXT,
    competition_status BOOLEAN DEFAULT false,
    competition_date DATE,
    assessment_data JSONB,
    is_deleted BOOLEAN NOT NULL DEFAULT false,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.workout_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    program_id UUID NOT NULL,
    week_number INTEGER NOT NULL,
    day_number INTEGER NOT NULL,
    date_completed TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    logged_exercises JSONB NOT NULL,
    recovery_checklist JSONB,
    duration_seconds INTEGER DEFAULT 0,
    is_deleted BOOLEAN NOT NULL DEFAULT false,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES auth.users(id)
);

-- 4. Engine Versioning & Rules
CREATE TABLE IF NOT EXISTS public.engine_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_string TEXT NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT false,
    release_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.exercises (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL CHECK (category IN ('Main', 'Variation', 'Accessory', 'Core', 'Prehab')),
    movement_pattern TEXT,
    equipment_required TEXT[],
    is_bilateral BOOLEAN DEFAULT true,
    is_deleted BOOLEAN NOT NULL DEFAULT false,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.technique_lab (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exercise_id UUID NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
    video_url TEXT,
    coaching_cues TEXT[],
    common_mistakes TEXT[],
    setup_instructions TEXT,
    is_deleted BOOLEAN NOT NULL DEFAULT false,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.weak_point_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    engine_version_id UUID NOT NULL REFERENCES public.engine_versions(id) ON DELETE CASCADE,
    lift TEXT NOT NULL,
    weak_point TEXT NOT NULL,
    target_muscle TEXT NOT NULL,
    recommended_exercise_ids UUID[] NOT NULL,
    is_deleted BOOLEAN NOT NULL DEFAULT false,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.progression_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    engine_version_id UUID NOT NULL REFERENCES public.engine_versions(id) ON DELETE CASCADE,
    block_type TEXT NOT NULL,
    week_number INTEGER NOT NULL,
    sets INTEGER NOT NULL,
    reps TEXT NOT NULL,
    percentage DECIMAL(5,2),
    rpe_target DECIMAL(3,1),
    is_deleted BOOLEAN NOT NULL DEFAULT false,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Generated Programs & Audit Logs
CREATE TABLE IF NOT EXISTS public.generated_programs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    athlete_profile_id UUID NOT NULL REFERENCES public.athlete_profiles(id),
    engine_version_id UUID NOT NULL REFERENCES public.engine_versions(id),
    program_snapshot JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    is_deleted BOOLEAN NOT NULL DEFAULT false,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.workout_logs ADD CONSTRAINT fk_program_log FOREIGN KEY (program_id) REFERENCES public.generated_programs(id) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS public.decision_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id UUID NOT NULL REFERENCES public.generated_programs(id) ON DELETE CASCADE,
    engine_version_id UUID NOT NULL REFERENCES public.engine_versions(id),
    decision_log JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.security_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    metadata JSONB,
    ip_address INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.download_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    version_string TEXT,
    downloaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. RLS Policies (Basic User Access)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id AND is_deleted = false);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

ALTER TABLE public.athlete_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own athlete profile" ON public.athlete_profiles FOR SELECT USING (auth.uid() = user_id AND is_deleted = false);
CREATE POLICY "Users can insert own athlete profile" ON public.athlete_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own athlete profile" ON public.athlete_profiles FOR UPDATE USING (auth.uid() = user_id);

ALTER TABLE public.workout_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own logs" ON public.workout_logs FOR SELECT USING (auth.uid() = user_id AND is_deleted = false);
CREATE POLICY "Users can insert own logs" ON public.workout_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own logs" ON public.workout_logs FOR UPDATE USING (auth.uid() = user_id);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own subscriptions" ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);

ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own purchases" ON public.purchases FOR SELECT USING (auth.uid() = user_id);

ALTER TABLE public.generated_programs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own programs" ON public.generated_programs FOR SELECT USING (auth.uid() = user_id AND is_deleted = false);
CREATE POLICY "Users can insert own programs" ON public.generated_programs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own programs" ON public.generated_programs FOR UPDATE USING (auth.uid() = user_id);

ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own transactions" ON public.payment_transactions FOR SELECT USING (auth.uid() = user_id);

ALTER TABLE public.download_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own downloads" ON public.download_history FOR SELECT USING (auth.uid() = user_id);

-- 7. Auth Trigger for Profile Creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (NEW.id, NEW.email, 'user');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 8. Seed Initial Data
INSERT INTO public.engine_versions (version_string, is_active, release_notes)
VALUES ('v1.0', true, 'Initial Iron Engine Release')
ON CONFLICT (version_string) DO NOTHING;

INSERT INTO public.exercises (name, category, movement_pattern) VALUES
('Squat', 'Main', 'Squat'),
('Bench Press', 'Main', 'Horizontal Push'),
('Deadlift', 'Main', 'Hinge'),
('Pause Squat', 'Variation', 'Squat'),
('Close-Grip Bench', 'Variation', 'Horizontal Push'),
('Deficit Deadlift', 'Variation', 'Hinge'),
('Leg Press', 'Accessory', 'Squat'),
('Barbell Row', 'Accessory', 'Horizontal Pull'),
('RDL', 'Accessory', 'Hinge')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.products (name, type, price_cents, short_description, version, storage_path) VALUES
('Iron Engine Pro', 'subscription', 199900, 'Unlimited program generation and advanced features.', '1.0', NULL),
('Powerlifting System 2.0', 'pdf_guide', 149900, 'The evolved Powerlifting System: programming, progression, periodization, fatigue, weak points, technique, building your own program and meet prep.', '1.0', 'powerlifting-system-2.pdf'),
('All About Powerlifting System 1.0', 'pdf_guide', 99900, 'Complete guide to powerlifting mechanics.', '1.0', 'powerlifting-system.pdf'),
('Learn Lift Eat & Repeat', 'pdf_guide', 69900, 'Nutrition and training handbook.', '1.0', 'learn-lift-eat.pdf')
ON CONFLICT (name) DO NOTHING;
