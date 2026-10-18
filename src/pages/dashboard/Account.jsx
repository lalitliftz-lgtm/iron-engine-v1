import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSubscription } from '../../context/SubscriptionContext';
import { supabase } from '../../lib/supabase';
import InstallApp from '../../components/dashboard/InstallApp';
import { TestDateCard, tapForTestMode } from '../../components/dashboard/TestDate';
import { parseYmd } from '../../lib/schedule';

const EXP = { Beginner: 'Novice', Intermediate: 'Intermediate', Advanced: 'Advanced' };

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-4 py-2 border-b border-gray-100 last:border-0 text-sm">
      <span className="text-gray-500">{label}</span><span className="text-gray-900 font-medium text-right">{value ?? '—'}</span>
    </div>
  );
}

function LinkRow({ to, title, sub }) {
  return (
    <Link to={to} className="flex items-center justify-between gap-4 py-3 border-b border-gray-100 last:border-0 group">
      <span><span className="block text-sm font-semibold text-gray-900">{title}</span>{sub && <span className="block text-xs text-gray-500">{sub}</span>}</span>
      <span className="text-gray-400 group-hover:text-gray-900">→</span>
    </Link>
  );
}

export default function Account() {
  const { user, signOut } = useAuth();
  const { status } = useSubscription();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(undefined);
  const [resetMsg, setResetMsg] = useState('');

  useEffect(() => {
    supabase.from('athlete_profiles').select('*').eq('user_id', user.id).maybeSingle().then(({ data }) => setProfile(data || null));
  }, [user]);

  const reset = async () => {
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, { redirectTo: `${window.location.origin}/forgot-password` });
    setResetMsg(error ? error.message : 'Reset link sent to your email.');
  };
  const out = async () => { await signOut(); navigate('/'); };

  const pro = status === 'pro_active';
  const a = profile?.assessment_data || {};
  const meet = profile?.competition_date ? `${parseYmd(profile.competition_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}${a.meet_date_status === 'approx' ? ' (not confirmed)' : ''}` : 'None booked';

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-8 py-8 md:py-12 space-y-6">
      <h1 onClick={tapForTestMode} className="text-2xl md:text-3xl font-semibold text-gray-900 tracking-tight select-none">Account</h1>

      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Athlete profile</h2>
          <Link to="/dashboard/assessment" className="text-sm font-semibold text-blue-600 hover:text-blue-800">Edit assessment</Link>
        </div>
        {profile === undefined ? <p className="text-sm text-gray-400">Loading…</p> : profile ? (
          <div>
            <Row label="Name" value={profile.full_name} />
            <Row label="Training age" value={EXP[profile.experience_level] || profile.experience_level} />
            <Row label="Maxes (S / B / D)" value={profile.squat_1rm ? `${profile.squat_1rm} / ${profile.bench_1rm} / ${profile.deadlift_1rm} kg${a.maxes_estimated ? ' (est.)' : ''}` : 'Not set'} />
            <Row label="Bodyweight" value={profile.bodyweight_kg ? `${profile.bodyweight_kg} kg` : null} />
            <Row label="Training days" value={profile.training_days_per_week ? `${profile.training_days_per_week} / week` : null} />
            <Row label="Next meet" value={meet} />
          </div>
        ) : (
          <div className="text-sm text-gray-500">No assessment yet. <Link to="/dashboard/assessment" className="text-blue-600 font-semibold">Start it (2–3 min)</Link></div>
        )}
      </section>

      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Plan & purchases</h2>
          <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${pro ? 'bg-green-50 text-green-700' : status === 'pro_expired' ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>{pro ? 'Pro active' : status === 'pro_expired' ? 'Pro expired' : 'Free'}</span>
        </div>
        <LinkRow to="/dashboard/subscription" title={pro ? 'Manage Pro' : 'Iron Engine Pro'} sub={pro ? 'Validity, renewal, receipts' : 'Unlimited blocks, weak-point work, weekly check-ins'} />
        <LinkRow to="/dashboard/library" title="My guides" sub="Download the PDFs you bought" />
      </section>

      <TestDateCard />

      <InstallApp />

      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Login & security</h2>
        <Row label="Email" value={user?.email} />
        <div className="flex flex-wrap gap-3 pt-4">
          <button onClick={reset} className="text-sm font-semibold border border-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50">Send password reset link</button>
          <button onClick={out} className="text-sm font-semibold border border-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50">Sign out</button>
        </div>
        {resetMsg && <p className="text-xs text-gray-500 mt-2">{resetMsg}</p>}
      </section>
    </div>
  );
}
