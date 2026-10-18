import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

/**
 * Redeem an invite code for one free month of Iron Engine Pro (testers, invite only).
 * All checks (valid, not expired, uses left, not used by this person before) and the grant happen
 * inside the redeem_invite database function in one locked step — see supabase_migration_v4_products.sql.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: 'Unauthorized' });

    const code = String(req.body?.code || '').trim();
    if (!code || code.length > 64) return res.status(400).json({ error: 'Enter your invite code.' });

    const { data, error: rpcError } = await supabaseAdmin.rpc('redeem_invite', { p_code: code, p_user: user.id });
    if (rpcError) throw rpcError;
    if (!data?.ok) return res.status(400).json({ error: data?.error || 'This invite code is not valid.' });
    return res.status(200).json({ success: true, endDate: data.end_date });
  } catch (err) {
    console.error('Invite redeem error:', err);
    return res.status(500).json({ error: 'Could not redeem the code right now. Please try again.' });
  }
}
