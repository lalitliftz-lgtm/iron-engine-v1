import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const int = (v, min, max) => { const n = Number(v); return Number.isInteger(n) && n >= min && n <= max ? n : null; };

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
      })) : [],
    }));

    const { data, error: insertError } = await supabaseAdmin.from('workout_logs').insert({
      user_id: user.id,
      program_id: programId,
      week_number: weekNumber,
      day_number: dayNumber,
      logged_exercises: exercises,
      duration_seconds: int(durationSeconds, 0, 6 * 3600) ?? 0,
      recovery_checklist: { session_notes: String(sessionNotes || '').slice(0, 2000) }
    }).select('id').single();

    if (insertError) throw insertError;

    return res.status(200).json({ success: true, logId: data.id });

  } catch (error) {
    console.error('Save Workout Error:', error);
    return res.status(500).json({ error: `Workout could not be saved: ${error?.message || error}` });
  }
}
