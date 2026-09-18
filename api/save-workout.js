import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const token = req.headers.authorization?.split(' ')[1];
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: 'Unauthorized' });

    const { programId, weekNumber, dayNumber, loggedExercises, durationSeconds, sessionNotes } = req.body;

    if (!programId || !loggedExercises) return res.status(400).json({ error: 'Missing required workout data' });

    const { data, error: insertError } = await supabaseAdmin.from('workout_logs').insert({
      user_id: user.id,
      program_id: programId,
      week_number: weekNumber,
      day_number: dayNumber,
      logged_exercises: loggedExercises,
      duration_seconds: durationSeconds,
      recovery_checklist: { session_notes: sessionNotes }
    }).select('id').single();

    if (insertError) throw insertError;

    return res.status(200).json({ success: true, logId: data.id });

  } catch (error) {
    console.error('Save Workout Error:', error);
    return res.status(500).json({ error: 'Failed to save workout' });
  }
}
