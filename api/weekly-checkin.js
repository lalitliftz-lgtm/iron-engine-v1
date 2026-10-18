import { createClient } from '@supabase/supabase-js';
import { trafficLight, liftDecisions, nextWeekAdjustment } from '../src/lib/autoreg.js';

const supabaseAdmin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const num = (v, min, max) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : null; };
const oneOf = (v, arr, dflt) => (arr.includes(v) ? v : dflt);

/** POST { programId, week, checkin: { sleepHours, soreness, mood, motivation, pain, painWhere, painPersistent, rhrUp } }
 *  Pro feature (System 2.0 Ch 10 weekly fatigue checklist + Ch 8 load decision matrix).
 *  Writes program_snapshot.adjustments = { checkins: { [week]: … }, loads: { [week+1]: overlay } } — weeks are never mutated. */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: 'Invalid token' });

    const { data: activeSub } = await supabaseAdmin.from('subscriptions').select('id').eq('user_id', user.id).eq('status', 'active').gte('end_date', new Date().toISOString()).order('end_date', { ascending: false }).limit(1).maybeSingle();
    if (!activeSub) return res.status(403).json({ error: 'UPGRADE_REQUIRED' });

    const { programId } = req.body || {};
    const week = num(req.body?.week, 1, 20);
    const c = req.body?.checkin || {};
    if (!programId || !week) return res.status(400).json({ error: 'programId and week are required' });

    const { data: program } = await supabaseAdmin.from('generated_programs').select('id, program_snapshot').eq('id', programId).eq('user_id', user.id).eq('is_deleted', false).maybeSingle();
    if (!program) return res.status(404).json({ error: 'Program not found' });
    const snap = program.program_snapshot;
    const weekPlan = snap.weeks.find((w) => w.week === week);
    if (!weekPlan) return res.status(400).json({ error: 'That week is not in this block' });

    const checkin = {
      sleepHours: num(c.sleepHours, 0, 14) ?? 7,
      soreness: num(c.soreness, 0, 10) ?? 4,
      mood: oneOf(c.mood, ['pos', 'neu', 'neg'], 'neu'),
      motivation: oneOf(c.motivation, ['high', 'mid', 'low'], 'mid'),
      pain: c.pain === true,
      painWhere: String(c.painWhere || '').slice(0, 40),
      painPersistent: c.painPersistent === true,
      rhrUp: c.rhrUp === true,
      notes: String(c.notes || '').slice(0, 500),
    };

    const { data: logs } = await supabaseAdmin.from('workout_logs').select('week_number, day_number, date_completed, logged_exercises').eq('program_id', program.id).eq('user_id', user.id).eq('is_deleted', false).eq('week_number', week).limit(20);
    const adjustments = snap.adjustments || {};
    const prevCheckin = adjustments.checkins?.[String(week - 1)];
    const missHistory = {};
    for (const l of ['squat', 'bench', 'deadlift']) missHistory[l] = prevCheckin?.decisions?.[l]?.missed || 0;

    const light = trafficLight(checkin);
    const decisions = liftDecisions(weekPlan, logs || [], light.light, missHistory);
    const nextWeek = snap.weeks.find((w) => w.week === week + 1 && !w.meetWeek);
    const adj = nextWeek ? nextWeekAdjustment(week + 1, light.light, decisions, light.reason) : null;

    const newAdjustments = {
      ...adjustments,
      checkins: { ...(adjustments.checkins || {}), [String(week)]: { ...checkin, light: light.light, reason: light.reason, signs: light.signs, decisions, at: new Date().toISOString() } },
      loads: { ...(adjustments.loads || {}), ...(adj ? { [String(week + 1)]: adj } : {}) },
    };
    const { error: upError } = await supabaseAdmin.from('generated_programs').update({ program_snapshot: { ...snap, adjustments: newAdjustments } }).eq('id', program.id);
    if (upError) throw upError;

    return res.status(200).json({ success: true, light, decisions, adjustment: adj, nextWeek: nextWeek ? week + 1 : null, sessionsLogged: (logs || []).length });
  } catch (error) {
    console.error('Weekly check-in error:', error);
    return res.status(500).json({ error: `Check-in could not be saved: ${error?.message || error}` });
  }
}
