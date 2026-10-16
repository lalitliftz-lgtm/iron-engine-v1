import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

/**
 * Soft-delete one of the athlete's own workout logs (is_deleted = true).
 * Done server-side: the table's RLS hides deleted rows, so a browser UPDATE that
 * hides the row is rejected ("new row violates row-level security policy").
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: 'Unauthorized' });

    const logId = req.body?.logId;
    if (!logId || typeof logId !== 'string') return res.status(400).json({ error: 'Missing session id' });

    // Only the owner's own, not-yet-removed log can be touched.
    const { data, error: updError } = await supabaseAdmin
      .from('workout_logs')
      .update({ is_deleted: true })
      .eq('id', logId)
      .eq('user_id', user.id)
      .eq('is_deleted', false)
      .select('id');
    if (updError) throw updError;
    if (!data?.length) return res.status(404).json({ error: 'Session not found' });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('remove-workout failed:', err);
    return res.status(500).json({ error: 'Could not remove the session' });
  }
}
