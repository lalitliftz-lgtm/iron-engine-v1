import { createClient } from '@supabase/supabase-js';
import { profileToForm, buildProgram, toSnapshot } from '../src/lib/engine.js';

const supabaseAdmin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Settings the dashboard may override on top of the assessment defaults.
const OVERRIDE_KEYS = ['goal', 'focus', 'weak', 'sticking', 'injuries', 'sleep', 'stress', 'days', 'exp'];
// Features the free tier cannot use (mirrors the landing-page free sample).
const PRO_ONLY = { focus: 'bal', weak: 'none', sticking: null, injuries: { back: false, knee: false, shoulder: false } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: 'Invalid token' });

    const { data: profile, error: profileError } = await supabaseAdmin.from('athlete_profiles').select('*').eq('user_id', user.id).maybeSingle();
    if (profileError || !profile) return res.status(404).json({ error: 'Athlete profile not found' });
    if (!profile.squat_1rm || !profile.bench_1rm || !profile.deadlift_1rm) {
      return res.status(400).json({ error: 'Add all three 1RMs in your assessment first' });
    }

    const { data: activeSub } = await supabaseAdmin.from('subscriptions').select('id').eq('user_id', user.id).eq('status', 'active').gte('end_date', new Date().toISOString()).order('end_date', { ascending: false }).limit(1).maybeSingle();
    const { count: programCount } = await supabaseAdmin.from('generated_programs').select('id', { count: 'exact', head: true }).eq('user_id', user.id);

    const isPro = !!activeSub;
    if (!isPro && programCount >= 1) return res.status(403).json({ error: 'UPGRADE_REQUIRED' });

    const overrides = {};
    for (const k of OVERRIDE_KEYS) if (req.body?.[k] !== undefined) overrides[k] = req.body[k];
    if (!isPro) Object.assign(overrides, PRO_ONLY);

    const { form, maxes, decisions } = profileToForm(profile, overrides);
    const program = buildProgram(form, maxes);
    const snapshot = toSnapshot(program, form, maxes, decisions);

    const { data: engineVersion } = await supabaseAdmin.from('engine_versions').select('id, version_string').eq('is_active', true).maybeSingle();

    // Only one block is "active" at a time — the newest one.
    await supabaseAdmin.from('generated_programs').update({ is_active: false }).eq('user_id', user.id).eq('is_active', true);

    const { data: newProgram, error: saveError } = await supabaseAdmin.from('generated_programs').insert({
      user_id: user.id,
      athlete_profile_id: profile.id,
      engine_version_id: engineVersion?.id ?? null,
      program_snapshot: snapshot,
      is_active: true
    }).select('id').single();

    if (saveError) throw saveError;

    if (engineVersion?.id) {
      await supabaseAdmin.from('decision_audit_logs').insert({
        program_id: newProgram.id,
        engine_version_id: engineVersion.id,
        decision_log: decisions
      });
    }

    return res.status(200).json({ success: true, programId: newProgram.id, engineData: { blockType: snapshot.blockType, log: decisions } });

  } catch (error) {
    console.error('Engine Error:', error);
    return res.status(500).json({ error: 'Failed to generate program' });
  }
}
