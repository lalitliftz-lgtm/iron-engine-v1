import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSubscription } from '../../context/SubscriptionContext';
import { supabase } from '../../lib/supabase';
import { LIFT_NAMES } from '../../lib/engine';
import UpgradeModal from '../../components/UpgradeModal';
import { useLang } from '../../lib/useLang';

const MOOD = [{ v: 'pos', l: 'Positive', hi: 'Positive', s: 'motivated, good', shi: 'motivated, accha' }, { v: 'neu', l: 'Neutral', hi: 'Neutral', s: 'normal', shi: 'normal' }, { v: 'neg', l: 'Negative', hi: 'Negative', s: 'irritable, flat', shi: 'chidchida, thanda' }];
const MOTIV = [{ v: 'high', l: 'High', hi: 'High', s: "can't wait to train", shi: 'train karne ka bahut mann' }, { v: 'mid', l: 'Moderate', hi: 'Theek-thaak', s: 'will train', shi: 'train kar lunga' }, { v: 'low', l: 'Low', hi: 'Low', s: 'resistance to training', shi: 'train karne ka mann nahi' }];
const LIGHT_STYLE = { green: 'bg-green-50 border-green-300 text-green-900', yellow: 'bg-amber-50 border-amber-300 text-amber-900', red: 'bg-red-50 border-red-300 text-red-900' };

function Seg({ options, value, onChange }) {
  const { L } = useLang();
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button key={o.v} type="button" onClick={() => onChange(o.v)} className={`px-3.5 py-2 rounded-lg text-sm font-semibold border text-left ${value === o.v ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}>
          {L(o.l, o.hi)}{o.s && <span className="block text-[11px] font-normal opacity-75">{L(o.s, o.shi)}</span>}
        </button>
      ))}
    </div>
  );
}

export default function WeeklyCheckin() {
  const { user } = useAuth();
  const { L } = useLang();
  const { status } = useSubscription();
  const isPro = status === 'pro_active';
  const [params] = useSearchParams();
  const [program, setProgram] = useState(undefined);
  const [week, setWeek] = useState(parseInt(params.get('week')) || 1);
  const [form, setForm] = useState({ sleepHours: 7, soreness: 4, mood: 'pos', motivation: 'high', pain: false, painWhere: '', painPersistent: false, rhrUp: false, notes: '' });
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showUpgrade, setShowUpgrade] = useState(false);

  useEffect(() => {
    supabase.from('generated_programs').select('id, program_snapshot').eq('user_id', user.id).eq('is_active', true).order('created_at', { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => setProgram(data || null));
  }, [user]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const existing = program?.program_snapshot?.adjustments?.checkins?.[String(week)];

  const submit = async () => {
    if (!isPro) { setShowUpgrade(true); return; }
    setBusy(true); setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/weekly-checkin', { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ programId: program.id, week, checkin: form }) });
      const body = await res.json().catch(() => ({}));
      if (res.status === 403 && body.error === 'UPGRADE_REQUIRED') { setShowUpgrade(true); return; }
      if (!res.ok) throw new Error(body.error || L('Could not save the check-in', 'Check-in save nahi ho paaya'));
      setResult(body);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  if (program === undefined) return <div className="flex justify-center items-center min-h-[60vh]"><div className="animate-spin h-8 w-8 border-2 border-gray-900 rounded-full border-t-transparent"></div></div>;
  if (!program) return <div className="max-w-xl mx-auto px-4 py-20 text-center text-gray-500">{L('No active block.', 'Koi active block nahi hai.')} <Link to="/dashboard/generate" className="text-gray-900 underline">{L('Build one first.', 'Pehle ek block banao.')}</Link></div>;

  const weeks = program.program_snapshot.weeks.filter((w) => !w.meetWeek);

  if (result) {
    const l = result.light;
    return (
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className={`border rounded-2xl p-6 mb-6 ${LIGHT_STYLE[l.light]}`}>
          <p className="text-xs font-bold uppercase tracking-wider mb-1">{L(`Week ${week} · ${l.light} light`, `Week ${week} · ${l.light} light`)}</p>
          <p className="text-sm">{l.reason}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">{result.nextWeek ? L(`What changes in week ${result.nextWeek}`, `Week ${result.nextWeek} mein kya badlega`) : L('What the logs said', 'Logs ne kya bataya')}</h2>
          <div className="space-y-2">
            {Object.entries(result.decisions).map(([lift, d]) => (
              <p key={lift} className="text-sm text-gray-800"><b>{LIFT_NAMES[lift]}:</b> {d.reason.replace(`${LIFT_NAMES[lift]}: `, '')}</p>
            ))}
          </div>
          {result.sessionsLogged === 0 && <p className="text-xs text-amber-700 mt-4">{L('No sessions were logged for this week, so only the recovery light was applied. Log your sessions (with RPE) and the engine steers the kg too.', 'Is week koi session log nahi hua, isliye sirf recovery light lagayi gayi. Apne sessions (RPE ke saath) log karo, phir engine kg bhi set karega.')}</p>}
          {!result.nextWeek && <p className="text-xs text-gray-500 mt-4">{L('This was the last training week of the block. Build the next block — the engine reviews the whole block first.', 'Yeh block ka last training week tha. Agla block banao — engine pehle poora block review karega.')}</p>}
        </div>
        <div className="flex gap-3 flex-wrap">
          <Link to="/dashboard/programs" className="bg-gray-900 hover:bg-gray-800 text-white px-6 py-3 rounded-lg text-sm font-semibold">{L('See the updated program →', 'Updated program dekho →')}</Link>
          <Link to="/dashboard" className="text-gray-600 hover:text-gray-900 px-4 py-3 text-sm font-medium">{L('Dashboard', 'Dashboard')}</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-semibold text-gray-900 tracking-tight">{L('Weekly check-in', 'Weekly check-in')}</h1>
        <p className="text-gray-500 mt-1 text-sm">{L("60 seconds. Tell us how the week felt — the engine reads it with your logged RPE and sets next week's weights.", 'Bas 60 second. Batao week kaisa gaya — engine ise aapke logged RPE ke saath padhta hai aur agle week ke weights set karta hai.')}</p>
        {!isPro && <p className="mt-3 text-sm bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3">🔒 {L("Weekly check-ins are a Pro feature — Pro reads your week and sets next week's kg. You can look at the questions; submitting needs Pro.", 'Weekly check-in Pro feature hai — Pro aapka week padhta hai aur agle week ka kg set karta hai. Sawaal dekh sakte ho; submit karne ke liye Pro chahiye.')}</p>}
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-7">
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{L('Which week just finished?', 'Kaunsa week abhi khatam hua?')}</p>
          <div className="flex flex-wrap gap-2">
            {weeks.map((w) => <button key={w.week} type="button" onClick={() => setWeek(w.week)} className={`px-4 py-2 rounded-lg text-sm font-semibold border ${week === w.week ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200'}`}>{w.label || L(`Week ${w.week}`, `Week ${w.week}`)}{program.program_snapshot.adjustments?.checkins?.[String(w.week)] ? ' ✓' : ''}</button>)}
          </div>
          {existing && <p className="text-xs text-gray-500 mt-2">{L(`Already checked in for this week (${existing.light} light). Submitting again replaces it.`, `Is week ka check-in ho chuka hai (${existing.light} light). Dobara submit karoge to purana replace ho jayega.`)}</p>}
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{L('Average sleep this week:', 'Is week average neend:')} <b className="text-gray-900">{form.sleepHours} h</b></p>
          <input type="range" min="4" max="10" step="0.5" value={form.sleepHours} onChange={(e) => set('sleepHours', Number(e.target.value))} className="w-full accent-gray-900" />
          <div className="flex justify-between text-[11px] text-gray-400"><span>4 h</span><span>{L('7 h = green', '7 h = green')}</span><span>10 h</span></div>
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{L('Soreness:', 'Soreness (dard/akdan):')} <b className="text-gray-900">{form.soreness}/10</b></p>
          <input type="range" min="0" max="10" step="1" value={form.soreness} onChange={(e) => set('soreness', Number(e.target.value))} className="w-full accent-gray-900" />
          <div className="flex justify-between text-[11px] text-gray-400"><span>{L('0 = none', '0 = bilkul nahi')}</span><span>{L('3–5 = normal', '3–5 = normal')}</span><span>{L("10 = can't move", '10 = hil bhi nahi sakte')}</span></div>
        </div>
        <div><p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{L('General mood', 'Overall mood')}</p><Seg options={MOOD} value={form.mood} onChange={(v) => set('mood', v)} /></div>
        <div><p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{L('Motivation to train', 'Train karne ka motivation')}</p><Seg options={MOTIV} value={form.motivation} onChange={(v) => set('motivation', v)} /></div>
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{L('Joint pain? (pain, not soreness)', 'Joint mein dard? (dard, soreness nahi)')}</p>
          <Seg options={[{ v: false, l: 'No', hi: 'Nahi' }, { v: true, l: 'Yes', hi: 'Haan' }]} value={form.pain} onChange={(v) => set('pain', v)} />
          {form.pain && (
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input value={form.painWhere} onChange={(e) => set('painWhere', e.target.value)} placeholder={L('where? knee, shoulder, lower back…', 'kahan? knee, shoulder, lower back…')} className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={form.painPersistent} onChange={(e) => set('painPersistent', e.target.checked)} /> {L('It has been there all week (persistent)', 'Poore week se hai (persistent)')}</label>
            </div>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={form.rhrUp} onChange={(e) => set('rhrUp', e.target.checked)} /> {L('Resting heart rate 5+ bpm above normal (only if you track it)', 'Resting heart rate normal se 5+ bpm zyada (sirf agar aap track karte ho)')}</label>
        <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2} placeholder={L('Anything else? (optional)', 'Aur kuch? (optional)')} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button onClick={submit} disabled={busy} className="w-full bg-gray-900 hover:bg-gray-800 text-white py-3.5 rounded-xl text-sm font-semibold disabled:opacity-50">{busy ? L('Reading your week…', 'Aapka week padh rahe hain…') : isPro ? L('Submit check-in →', 'Check-in submit karo →') : L('Unlock weekly check-ins (Pro)', 'Weekly check-in unlock karo (Pro)')}</button>
      </div>
      <UpgradeModal isOpen={showUpgrade} onClose={() => setShowUpgrade(false)} />
    </div>
  );
}
