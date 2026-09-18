import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Flag other parts of the app can read to show a friendly notice
// instead of silently failing when auth/payments aren't configured yet.
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  // Do NOT throw here. Throwing at import time blanks the ENTIRE app
  // (including the public landing + legal pages that don't need auth),
  // which looks like the site is "broken". Warn loudly instead so the
  // storefront still renders; only the auth/checkout flows are inert
  // until the env vars are filled in.
  console.error(
    "[LalitLifts] Missing Supabase env vars (VITE_SUPABASE_URL / " +
    "VITE_SUPABASE_ANON_KEY). Auth and checkout are disabled until these " +
    "are set in your .env (local) or Vercel project settings (production)."
  );
}

// Fall back to harmless placeholder values so createClient doesn't throw.
// Any real auth call will simply fail gracefully instead of crashing the app.
export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "public-anon-key-placeholder",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);
