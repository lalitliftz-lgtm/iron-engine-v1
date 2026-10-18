import { createClient } from '@supabase/supabase-js';
import { profileToForm, buildProgram, toSnapshot, LIFT_NAMES, calToday } from '../src/lib/engine.js';
import { evaluateBlock, applyAdjustments } from '../src/lib/autoreg.js';
import { bridgeWeek } from '../src/lib/bridge.js';

const supabaseAdmin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Features the free tier cannot use (mirrors the landing-page free sample).
// Injury flags are deliberately NOT here: safety is never a premium feature.
const ENGINE_VERSION = '2.0';
const PRO_ONLY = { focus: 'bal', weak: 'none', sticking: null, variationIdx: 0, accIdx: 0 };
const ENUMS = {
  goal: ['hyp', 'str', 'peak'], focus: ['bal', 'squat', 'bench', 'dead'], weak: ['none', 'squat', 'bench', 'deadlift'],
  weakType: ['strength', 'technique', 'fatigue'], sleep: ['high', 'mid', 'low'], stress: ['low', 'mid', 'high'],
  exp: ['beg', 'int', 'adv'], equipment: ['commercial', 'basic', 'minimal'], style: ['focused', 'balanced', 'full'],
};
const INJ_KEYS = ['back', 'knee', 'shoulder'];

/** Coerce and clamp dashboard overrides — a bad value is dropped, never crashes the engine. */
function cleanOverrides(body) {
  const out = {};
  if (!body || typeof body !== 'object') return out;
  for (const k of Object.keys(ENUMS)) if (ENUMS[k].includes(body[k])) out[k] = body[k];
  if (typeof body.sticking === 'string' && /^[a-z]{1,20}$/.test(body.sticking)) out.sticking = body.sticking;
  for (const k of ['variationIdx', 'accIdx']) { const n = Number(body[k]); if (Number.isInteger(n) && n >= 0 && n < 10) out[k] = n; }
  const days = Number(body.days); if (Number.isInteger(days) && days >= 3 && days <= 6) out.days = days;
  // The athlete's local calendar date — sessions are dated from it, not from the server's UTC clock.
  // (Up to a year either way, so the coach's test-date mode can build blocks for any day; it only moves
  // the athlete's own plan.)
  if (typeof body.today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.today)) {
    const diff = Math.abs(Date.parse(`${body.today}T00:00:00Z`) - Date.now()) / 864e5;
    if (diff <= 366) out.today = body.today;
  }
  if (body.injuries && typeof body.injuries === 'object') {
    out.injuries = {};
    for (const k of INJ_KEYS) out.injuries[k] = body.injuries[k] === true;
  }
  return out;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: 'Invalid token' });

    const { data: profile, error: profileError } = await supabaseAdmin.from('athlete_profiles').select('*').eq('user_id', user.id).maybeSingle();
    if (profileError || !profile) return res.status(404).json({ error: 'Athlete profile not found' });
    // Beginners can train without maxes (working weights are given instead); everyone else needs them.
    if (profile.experience_level !== 'Beginner' && (!profile.squat_1rm || !profile.bench_1rm || !profile.deadlift_1rm)) {
      return res.status(400).json({ error: 'Add your three lifts (a 1RM or a recent heavy set) in your assessment first' });
    }

    const { data: activeSub } = await supabaseAdmin.from('subscriptions').select('id').eq('user_id', user.id).eq('status', 'active').gte('end_date', new Date().toISOString()).order('end_date', { ascending: false }).limit(1).maybeSingle();
    const { count: programCount } = await supabaseAdmin.from('generated_programs').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_deleted', false);

    const isPro = !!activeSub;
    if (!isPro && programCount >= 1) return res.status(403).json({ error: 'UPGRADE_REQUIRED' });

    const overrides = cleanOverrides(req.body);
    if (!isPro) Object.assign(overrides, PRO_ONLY);

    // ---- Block-end evaluation of the previous block (System 2.0 Ch 8/9): what did the logs say?
    const { data: prev } = await supabaseAdmin.from('generated_programs').select('id, created_at, program_snapshot').eq('user_id', user.id).eq('is_active', true).eq('is_deleted', false).order('created_at', { ascending: false }).limit(1).maybeSingle();
    let evaluation = null;
    if (prev?.program_snapshot?.weeks) {
      const { data: logs } = await supabaseAdmin.from('workout_logs').select('week_number, day_number, date_completed, logged_exercises').eq('program_id', prev.id).eq('user_id', user.id).eq('is_deleted', false).limit(200);
      if (logs && logs.length >= 4) { // fewer than 4 sessions is a re-generate, not a finished block
        evaluation = evaluateBlock(prev.program_snapshot, logs, prev.program_snapshot.adjustments?.checkins || {});
        // Remember the verdict on the finished block (only the `adjustments` key is ever written; weeks stay immutable).
        await supabaseAdmin.from('generated_programs').update({ program_snapshot: { ...prev.program_snapshot, adjustments: { ...(prev.program_snapshot.adjustments || {}), evaluation } } }).eq('id', prev.id);
      }
    }
    const prevGoal = prev?.program_snapshot?.meta?.form?.goal;
    if (evaluation) {
      if (evaluation.volumeDelta) overrides.volumeDelta = evaluation.volumeDelta;
      // Advance the phase only when there is no meet (the meet date decides otherwise) and the athlete didn't pick a goal.
      if (evaluation.verdict === 'advance' && req.body?.goal === undefined && !profile.competition_date) overrides.goal = prevGoal === 'hyp' ? 'str' : 'hyp';
      if (evaluation.verdict !== 'advance' && req.body?.goal === undefined && prevGoal && !profile.competition_date) overrides.goal = prevGoal;
    }

    const { form, maxes, decisions } = profileToForm(profile, overrides);
    if (evaluation) {
      decisions.unshift({ step: 'Last Block Review', decision: { advance: 'Next phase', repeat: 'Repeat the block', 'repeat-lighter': 'Repeat, 5–10% lighter', 'repeat-less-volume': 'Repeat, less volume' }[evaluation.verdict], reason: evaluation.reason });
      // e1RM trend from clean ≤5-rep sets replaces max testing (Ch 8): update maxes conservatively (+2.5 to +10%).
      const profileUpdate = {};
      for (const l of ['squat', 'bench', 'deadlift']) {
        const e = evaluation.e1rm?.[l];
        if (e && maxes[l] && e.e1rm >= maxes[l] + 2.5 && e.e1rm <= maxes[l] * 1.1) {
          decisions.push({ step: 'Max Update', decision: `${LIFT_NAMES[l]} ${maxes[l]} → ${e.e1rm} kg`, reason: `From training: ${e.from}. No max test needed — the logs are the test.` });
          maxes[l] = e.e1rm; form.maxes[l] = e.e1rm; profileUpdate[`${l}_1rm`] = e.e1rm;
        }
      }
      if (evaluation.loadDelta) {
        for (const l of ['squat', 'bench', 'deadlift']) if (maxes[l]) { maxes[l] = Math.round((maxes[l] * (1 + evaluation.loadDelta / 100)) / 2.5) * 2.5; form.maxes[l] = maxes[l]; }
        decisions.push({ step: 'Start Load', decision: `${evaluation.loadDelta}%`, reason: 'Working maxes lowered for this block so week 1 is clean, not a grind. Your profile 1RMs are unchanged.' });
      }
      if (Object.keys(profileUpdate).length) await supabaseAdmin.from('athlete_profiles').update({ ...profileUpdate, assessment_data: { ...(profile.assessment_data || {}), maxes_estimated: false } }).eq('id', profile.id);
      if (Object.keys(profileUpdate).length) maxes.estimated = false;
    }
    // The meet date is never overridable from the UI: the engine always plans around it.
    const program = buildProgram(form, maxes);
    program.notes.forEach((n) => decisions.push({ step: 'Engine Note', decision: program.blockLabel, reason: n }));
    let snapshot = toSnapshot(program, form, maxes, decisions);
    // Rebuilt mid-week? The rest of this week keeps the previous block's sessions; the new block starts Monday.
    if (prev?.program_snapshot?.weeks) {
      const { data: prevLogs } = await supabaseAdmin.from('workout_logs').select('week_number, day_number').eq('program_id', prev.id).eq('user_id', user.id).eq('is_deleted', false).limit(300);
      const prevSnap = applyAdjustments(prev.program_snapshot, prev.program_snapshot.adjustments);
      snapshot = bridgeWeek(snapshot, prevSnap, prevLogs || [], prev.created_at, calToday(form.today));
    }

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

    const { data: newProgram, error: saveError } = await supabaseAdmin.from('generated_programs').insert({
      user_id: user.id,
      athlete_profile_id: profile.id,
      engine_version_id: engineVersion.id,
      program_snapshot: snapshot,
      is_active: true
    }).select('id, created_at').single();

    if (saveError) throw saveError;

    // Only one block is "active" at a time — the newest one. Done AFTER the insert so a failed
    // save never leaves the athlete with no active program; only OLDER blocks are switched off, so two
    // requests at once (double tap, two tabs) can't switch each other off.
    await supabaseAdmin.from('generated_programs').update({ is_active: false }).eq('user_id', user.id).eq('is_active', true).lt('created_at', newProgram.created_at);

    // Audit log is best-effort — never fail the save because of it.
    const { error: logError } = await supabaseAdmin.from('decision_audit_logs').insert({
      program_id: newProgram.id,
      engine_version_id: engineVersion.id,
      decision_log: decisions
    });
    if (logError) console.error('Decision log insert failed:', logError.message);

    return res.status(200).json({ success: true, programId: newProgram.id, snapshot, engineData: { blockType: snapshot.blockType, log: decisions, evaluation } });

  } catch (error) {
    console.error('Engine Error:', error);
    // Surface the database/engine reason so the athlete (and we) can see what actually failed.
    const detail = error?.message || error?.details || String(error);
    return res.status(500).json({ error: `Program could not be saved: ${detail}` });
  }
}
