import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const int = (v, min, max) => { const n = Number(v); return Number.isInteger(n) && n >= min && n <= max ? n : null; };

/** When the session was finished, as the phone saw it (an offline save can arrive hours later; the coach's
 *  test mode moves the day). Anything unparseable or more than a year off → now. */
function completedAt(v) {
  const t = Date.parse(v);
  return Number.isFinite(t) && Math.abs(t - Date.now()) <= 366 * 864e5 ? new Date(t).toISOString() : new Date().toISOString();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: 'Unauthorized' });

    const { programId, loggedExercises, durationSeconds, sessionNotes } = req.body || {};
    const weekNumber = int(req.body?.weekNumber, 1, 20);
    const dayNumber = int(req.body?.dayNumber, 1, 7);

    if (!programId || !Array.isArray(loggedExercises) || weekNumber === null || dayNumber === null) {
      return res.status(400).json({ error: 'Missing or invalid workout data (program, week, day, exercises)' });
    }

    // The program must belong to this athlete.
    const { data: program } = await supabaseAdmin.from('generated_programs').select('id').eq('id', programId).eq('user_id', user.id).maybeSingle();
    if (!program) return res.status(404).json({ error: 'Program not found' });

    // Keep only what the logger actually produces — never store arbitrary payloads.
    const exercises = loggedExercises.slice(0, 30).map((ex) => ({
      name: String(ex.name || '').slice(0, 80),
      type: ex.type === 'Main' ? 'Main' : 'Accessory',
      lift: ['squat', 'bench', 'deadlift'].includes(ex.lift) ? ex.lift : null,
      sets: int(ex.sets, 0, 20) ?? 0,
      reps: String(ex.reps ?? '').slice(0, 10),
      rpe: String(ex.rpe ?? '').slice(0, 12),      // planned RPE — the weekly decision matrix compares against it
      pct: ex.pct === null || ex.pct === undefined ? null : Number(ex.pct) || null,
      weight: ex.weight === '' || ex.weight === null || ex.weight === undefined ? '' : Number(ex.weight) || '',
      skipped: ex.skipped === true,
      loggedSets: Array.isArray(ex.loggedSets) ? ex.loggedSets.slice(0, 20).map((st) => ({
        weight: st.weight === '' ? '' : Number(st.weight) || '',
        reps: st.reps === '' ? '' : Number(st.reps) || '',
        rpe: st.rpe === '' || st.rpe === undefined ? '' : Number(st.rpe) || '',
        pain: st.pain === true,
        completed: st.completed === true,
        ...(st.planned === true ? { planned: true } : {}), // "marked done" without details — not used for e1RM
      })) : [],
    }));

    // Skipped session (sick, busy, gym closed…) or "did it, didn't log details".
    const SKIP_REASONS = ['sick', 'busy', 'gym_closed', 'injury', 'travel', 'other'];
    const skipReason = SKIP_REASONS.includes(req.body?.skipReason) ? req.body.skipReason : null;
    const quick = req.body?.quick === true;

    // A retry after a dropped connection must not create a second log for the same session.
    const clientId = typeof req.body?.clientId === 'string' ? req.body.clientId.slice(0, 64) : null;
    if (clientId) {
      const { data: existing } = await supabaseAdmin.from('workout_logs').select('id')
        .eq('user_id', user.id).eq('program_id', programId).eq('is_deleted', false).eq('recovery_checklist->>client_id', clientId).limit(1).maybeSingle();
      if (existing) return res.status(200).json({ success: true, logId: existing.id, duplicate: true });
    }

    const { data, error: insertError } = await supabaseAdmin.from('workout_logs').insert({
      user_id: user.id,
      program_id: programId,
      week_number: weekNumber,
      day_number: dayNumber,
      logged_exercises: exercises,
      duration_seconds: int(durationSeconds, 0, 6 * 3600) ?? 0,
      date_completed: completedAt(req.body?.completedAt),
      recovery_checklist: { session_notes: String(sessionNotes || '').slice(0, 2000), ...(clientId ? { client_id: clientId } : {}), ...(skipReason ? { skip_reason: skipReason } : {}), ...(quick ? { quick: true } : {}) }
    }).select('id').single();

    if (insertError) throw insertError;

    return res.status(200).json({ success: true, logId: data.id });

  } catch (error) {
    console.error('Save Workout Error:', error);
    return res.status(500).json({ error: 'Workout could not be saved. Please try again.' });
  }
}
