import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import AuthShell from '../components/AuthShell';

/** Landing page of the "reset your password" email: the link signs the user in for this one step. */
export default function ResetPassword() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  // Supabase reads the token from the link a moment after the page opens.
  const [waited, setWaited] = useState(false);
  useEffect(() => { const t = setTimeout(() => setWaited(true), 2500); return () => clearTimeout(t); }, []);

  const save = async (e) => {
    e.preventDefault();
    if (password.length < 6) { setError('At least 6 characters.'); return; }
    if (password !== confirm) { setError("The two passwords don't match."); return; }
    setBusy(true); setError(null);
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (err) { setError(err.message); return; }
    setDone(true);
    setTimeout(() => navigate('/dashboard', { replace: true }), 1500);
  };

  if (!user && (loading || !waited)) return <AuthShell title="Reset password" subtitle="Checking your link…" />;
  if (!user) return (
    <AuthShell title="Link expired" subtitle="This reset link is no longer valid.">
      <Link to="/forgot-password" className="block text-center bg-red-600 text-white p-3 rounded-lg font-bold">Send a new link</Link>
    </AuthShell>
  );
  return (
    <AuthShell title="Set a new password" subtitle={user.email}>
      {error && <div className="bg-red-100 text-red-700 p-3 mb-4 rounded text-sm">{error}</div>}
      {done ? <div className="bg-green-100 text-green-700 p-3 rounded text-sm">Password changed. Taking you to your dashboard…</div> : (
        <form onSubmit={save}>
          <label className="block text-xs font-semibold uppercase tracking-wider text-knurl mb-1">New password</label>
          <input type="password" required minLength="6" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password"
            className="w-full p-3 mb-4 rounded-lg border border-line bg-iron text-chalk focus:ring-2 focus:ring-red-600 focus:border-transparent" />
          <label className="block text-xs font-semibold uppercase tracking-wider text-knurl mb-1">Repeat it</label>
          <input type="password" required minLength="6" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password"
            className="w-full p-3 mb-6 rounded-lg border border-line bg-iron text-chalk focus:ring-2 focus:ring-red-600 focus:border-transparent" />
          <button type="submit" disabled={busy} className="w-full bg-red-600 hover:bg-red-700 text-white p-3 rounded-lg font-bold tracking-wide disabled:opacity-50">{busy ? 'Saving…' : 'SAVE NEW PASSWORD'}</button>
        </form>
      )}
    </AuthShell>
  );
}
