import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSubscription } from '../../context/SubscriptionContext';
import { supabase } from '../../lib/supabase';
import InstallApp from '../../components/dashboard/InstallApp';
import { useLang } from '../../lib/useLang';
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
  const { L } = useLang();
  const { status } = useSubscription();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(undefined);
  const [resetMsg, setResetMsg] = useState('');

  useEffect(() => {
    supabase.from('athlete_profiles').select('*').eq('user_id', user.id).maybeSingle().then(({ data }) => setProfile(data || null));
  }, [user]);

  const reset = async () => {
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, { redirectTo: `${window.location.origin}/reset-password` });
    setResetMsg(error ? error.message : L('Reset link sent to your email.', 'Reset link aapke email par bhej diya.'));
  };
  const out = async () => { await signOut(); navigate('/'); };

  const pro = status === 'pro_active';
  const a = profile?.assessment_data || {};
  const meet = profile?.competition_date ? `${parseYmd(profile.competition_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}${a.meet_date_status === 'approx' ? L(' (not confirmed)', ' (confirm nahi hai)') : ''}` : L('None booked', 'Koi meet book nahi');

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-8 py-8 md:py-12 space-y-6">
      <h1 onClick={tapForTestMode} className="text-2xl md:text-3xl font-semibold text-gray-900 tracking-tight select-none">{L('Account', 'Account')}</h1>

      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{L('Athlete profile', 'Athlete profile')}</h2>
          <Link to="/dashboard/assessment" className="text-sm font-semibold text-blue-600 hover:text-blue-800">{L('Edit assessment', 'Assessment edit karo')}</Link>
        </div>
        {profile === undefined ? <p className="text-sm text-gray-400">{L('Loading…', 'Load ho raha hai…')}</p> : profile ? (
          <div>
            <Row label={L('Name', 'Naam')} value={profile.full_name} />
            <Row label={L('Training age', 'Training age')} value={EXP[profile.experience_level] || profile.experience_level} />
            <Row label={L('Maxes (S / B / D)', 'Maxes (S / B / D)')} value={profile.squat_1rm ? `${profile.squat_1rm} / ${profile.bench_1rm} / ${profile.deadlift_1rm} kg${a.maxes_estimated ? L(' (est.)', ' (andaaza)') : ''}` : L('Not set', 'Set nahi hai')} />
            <Row label={L('Bodyweight', 'Bodyweight')} value={profile.bodyweight_kg ? `${profile.bodyweight_kg} kg` : null} />
            <Row label={L('Training days', 'Training ke din')} value={profile.training_days_per_week ? L(`${profile.training_days_per_week} / week`, `${profile.training_days_per_week} / week`) : null} />
            <Row label={L('Next meet', 'Agla meet')} value={meet} />
          </div>
        ) : (
          <div className="text-sm text-gray-500">{L('No assessment yet.', 'Abhi tak koi assessment nahi.')} <Link to="/dashboard/assessment" className="text-blue-600 font-semibold">{L('Start it (about 5 min)', 'Shuru karo (lagbhag 5 min)')}</Link></div>
        )}
      </section>

      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{L('Plan & purchases', 'Plan & purchases')}</h2>
          <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${pro ? 'bg-green-50 text-green-700' : status === 'pro_expired' ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>{pro ? L('Pro active', 'Pro active hai') : status === 'pro_expired' ? L('Pro expired', 'Pro khatam ho gaya') : L('Free', 'Free')}</span>
        </div>
        <LinkRow to="/dashboard/subscription" title={pro ? L('Manage Pro', 'Pro manage karo') : 'Iron Engine Pro'} sub={pro ? L('Validity, renewal, receipts', 'Validity, renewal, receipts') : L('Unlimited blocks, weak-point work, weekly check-ins', 'Unlimited blocks, weak-point work, weekly check-ins')} />
        <LinkRow to="/dashboard/library" title={L('My guides', 'Meri guides')} sub={L('Download the PDFs you bought', 'Jo PDFs kharide hain unhe download karo')} />
      </section>

      <OwnerLink />

      <CoachLanguage />

      <TestDateCard />

      <InstallApp />

      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{L('Login & security', 'Login & security')}</h2>
        <Row label={L('Email', 'Email')} value={user?.email} />
        <div className="flex flex-wrap gap-3 pt-4">
          <button onClick={reset} className="text-sm font-semibold border border-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50">{L('Send password reset link', 'Password reset link bhejo')}</button>
          <button onClick={out} className="text-sm font-semibold border border-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50">{L('Sign out', 'Sign out karo')}</button>
        </div>
        {resetMsg && <p className="text-xs text-gray-500 mt-2">{resetMsg}</p>}
      </section>
    </div>
  );
}

/** App language: every screen, tips, form cues and RPE help. Exercise names and numbers stay the same. */
function CoachLanguage() {
  const { lang, setLang } = useLang();
  const opt = (v, l, sub) => (
    <button type="button" onClick={() => setLang(v)} className={`flex-1 text-left border rounded-lg px-3 py-2.5 ${lang === v ? 'border-gray-900 bg-gray-50' : 'border-gray-200'}`}>
      <span className="block text-sm font-semibold text-gray-900">{l}</span>
      <span className="block text-xs text-gray-500">{sub}</span>
    </button>
  );
  return (
    <section className="bg-white border border-gray-200 rounded-xl p-5">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{lang === 'hi' ? 'App ki bhasha' : 'App language'}</h2>
      <p className="text-sm text-gray-500 mb-3">{lang === 'hi' ? 'Poora app — menu, buttons, tips aur form cues. Exercise ke naam aur numbers same rehte hain. Kisi bhi tip par अ / A button se bhi badal sakte ho.' : 'The whole app — menus, buttons, tips and form cues. Exercise names and numbers stay the same. You can also switch on any tip with the अ / A button.'}</p>
      <div className="flex gap-2">
        {opt('en', 'English', 'Simple English')}
        {opt('hi', 'Hinglish', 'Aasaan Hinglish')}
      </div>
    </section>
  );
}

/** Shown only to the owner (the server checks the login email against OWNER_EMAIL). */
function OwnerLink() {
  const { L } = useLang();
  const [owner, setOwner] = useState(false);
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/admin?action=check', { headers: { Authorization: `Bearer ${session?.access_token}` } }).catch(() => null);
      if (res?.ok) setOwner(true);
    })();
  }, []);
  if (!owner) return null;
  return (
    <section className="bg-white border border-gray-200 rounded-xl p-5">
      <LinkRow to="/dashboard/owner" title={L('Owner panel', 'Owner panel')} sub={L('All users, lifting data, payments, invites — only you see this', 'Saare users, lifting data, payments, invites — yeh sirf aap dekhte ho')} />
    </section>
  );
}
