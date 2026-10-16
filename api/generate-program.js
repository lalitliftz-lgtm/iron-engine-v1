import { createClient } from '@supabase/supabase-js';
import { profileToForm, buildProgram, toSnapshot } from '../src/lib/engine.js';

const supabaseAdmin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Settings the dashboard may override on top of the assessment defaults.
const OVERRIDE_KEYS = ['goal', 'focus', 'weak', 'sticking', 'weakType', 'variationIdx', 'accIdx', 'injuries', 'sleep', 'stress', 'days', 'exp', 'equipment'];
// Features the free tier cannot use (mirrors the landing-page free sample).
const ENGINE_VERSION = '2.0';
const PRO_ONLY = { focus: 'bal', weak: 'none', sticking: null, variationIdx: 0, accIdx: 0, injuries: { back: false, knee: false, shoulder: false } };

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
    // The meet date is never overridable from the UI: the engine always plans around it.
    const program = buildProgram(form, maxes);
    program.notes.forEach((n) => decisions.push({ step: 'Engine Note', decision: program.blockLabel, reason: n }));
    const snapshot = toSnapshot(program, form, maxes, decisions);

    // The snapshot must reference an engine version (NOT NULL FK). A freshly restored
    // database may have no seed row, so create/activate one instead of failing the save.
    let { data: engineVersion } = await supabaseAdmin.from('engine_versions').select('id, version_string').eq('is_active', true).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (!engineVersion) {
      const { data: created, error: evError } = await supabaseAdmin.from('engine_versions')
        .upsert({ version_string: ENGINE_VERSION, is_active: true, release_notes: 'Iron Engine v2 — Lalit Lifts Powerlifting System' }, { onConflict: 'version_string' })
        .select('id, version_string').single();
      if (evError) throw evError;
      engineVersion = created;
    }

    // Only one block is "active" at a time — the newest one.
    await supabaseAdmin.from('generated_programs').update({ is_active: false }).eq('user_id', user.id).eq('is_active', true);

    const { data: newProgram, error: saveError } = await supabaseAdmin.from('generated_programs').insert({
      user_id: user.id,
      athlete_profile_id: profile.id,
      engine_version_id: engineVersion.id,
      program_snapshot: snapshot,
      is_active: true
    }).select('id').single();

    if (saveError) throw saveError;

    // Audit log is best-effort — never fail the save because of it.
    const { error: logError } = await supabaseAdmin.from('decision_audit_logs').insert({
      program_id: newProgram.id,
      engine_version_id: engineVersion.id,
      decision_log: decisions
    });
    if (logError) console.error('Decision log insert failed:', logError.message);

    return res.status(200).json({ success: true, programId: newProgram.id, engineData: { blockType: snapshot.blockType, log: decisions } });

  } catch (error) {
    console.error('Engine Error:', error);
    // Surface the database/engine reason so the athlete (and we) can see what actually failed.
    const detail = error?.message || error?.details || String(error);
    return res.status(500).json({ error: `Program could not be saved: ${detail}` });
  }
}
