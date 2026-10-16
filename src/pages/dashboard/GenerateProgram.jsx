import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useSubscription } from '../../context/SubscriptionContext';
import UpgradeModal from '../../components/UpgradeModal';
import { motion } from 'framer-motion';
import { profileToForm, STICKING, LIFT_NAMES, daysToMeet, SCHEMES } from '../../lib/engine';

// Settings the athlete can tune on top of the assessment defaults.
const GOALS = [
  { v: 'hyp', l: 'Base Block', s: 'muscle + capacity' },
  { v: 'str', l: 'Strength Block', s: 'heavy 2–4s at 80–90%' },
  { v: 'peak', l: 'Peaking', s: 'meet / 1RM prep' },
];
const FOCUS = [
  { v: 'bal', l: 'Balanced' }, { v: 'squat', l: 'Squat Focus' }, { v: 'bench', l: 'Bench Focus' }, { v: 'dead', l: 'Deadlift Focus' },
];
const WEAK = [
  { v: 'none', l: 'Balanced' }, { v: 'squat', l: 'Squat' }, { v: 'bench', l: 'Bench' }, { v: 'deadlift', l: 'Deadlift' },
];
const DAYS = [3, 4, 5, 6].map((d) => ({ v: d, l: `${d}` }));
const SLEEP = [{ v: 'high', l: '7+ hrs' }, { v: 'mid', l: '6–7 hrs' }, { v: 'low', l: '< 6 hrs' }];
const STRESS = [{ v: 'low', l: 'Low' }, { v: 'mid', l: 'Moderate' }, { v: 'high', l: 'High' }];
const INJ = [{ v: 'back', l: 'Lower Back' }, { v: 'knee', l: 'Knee' }, { v: 'shoulder', l: 'Shoulder' }];
const WEAK_TYPE = [
  { v: 'strength', l: 'Strength', s: 'form fine, bar slows when heavy' },
  { v: 'technique', l: 'Technique', s: 'form breaks even light' },
  { v: 'fatigue', l: 'Fatigue', s: 'warm-ups feel heavy' },
];
const EQUIP = [{ v: 'commercial', l: 'Commercial gym' }, { v: 'basic', l: 'Barbell + DB' }, { v: 'minimal', l: 'Barbell only' }];
const PHASE_LABEL = { base: 'Base Block', strength: 'Strength Block', peak: 'Peaking Block', taper: 'Taper → Meet', meetweek: 'Meet Week', post: 'Post-meet Deload', beginner: 'Beginner Linear' };

function Seg({ options, value, onChange, multi, locked }) {
  return (
    <div className={`flex flex-wrap gap-2 ${locked ? 'opacity-50' : ''}`}>
      {options.map((o) => {
        const active = multi ? !!value[o.v] : value === o.v;
        return (
          <button key={o.v} type="button" disabled={locked}
            onClick={() => (multi ? onChange({ ...value, [o.v]: !value[o.v] }) : onChange(o.v))}
            className={`px-3.5 py-2 rounded-lg text-sm font-semibold border transition-colors text-left ${active ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'} ${locked ? 'cursor-not-allowed' : ''}`}>
            {o.l}
            {o.s && <span className="block text-[11px] font-normal opacity-75">{o.s}</span>}
          </button>
        );
      })}
    </div>
  );
}

function Field({ label, hint, pro, locked, onLockedClick, children }) {
  return (
    <div className="mb-6" onClick={locked ? onLockedClick : undefined}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</span>
        {pro && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">🔒 PRO</span>}
      </div>
      {hint && <p className="text-xs text-gray-400 mb-2">{hint}</p>}
      {children}
    </div>
  );
}

export default function GenerateProgram() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { status } = useSubscription();
  const isPro = status === 'pro_active';

  const [profile, setProfile] = useState(undefined); // undefined = loading, null = none
  const [defaults, setDefaults] = useState(null);
  const [settings, setSettings] = useState(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [appStatus, setAppStatus] = useState('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('athlete_profiles').select('*').eq('user_id', user.id).maybeSingle();
      setProfile(data || null);
      if (data) {
        const d = profileToForm(data);
        setDefaults(d);
        const { goal, focus, weak, sticking, weakType, variationIdx, accIdx, injuries, sleep, stress, days, equipment } = d.form;
        setSettings({ goal, focus, weak, sticking, weakType, variationIdx, accIdx, injuries, sleep, stress, days, equipment });
      }
    };
    load();
  }, [user]);

  const set = (k, v) => setSettings((s) => ({ ...s, [k]: v }));
  const setWeak = (v) => setSettings((s) => ({ ...s, weak: v, sticking: v === 'none' ? null : Object.keys(STICKING[v])[0], variationIdx: 0, accIdx: 0 }));
  const setSticking = (v) => setSettings((s) => ({ ...s, sticking: v, variationIdx: 0, accIdx: 0 }));
  const lockedClick = () => { if (!isPro) setShowUpgradeModal(true); };

  const handleGenerate = async () => {
    setAppStatus('generating');
    setError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch('/api/generate-program', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(settings || {}),
      });

      if (response.status === 403) {
        const data = await response.json();
        if (data.error === 'UPGRADE_REQUIRED') {
          setShowUpgradeModal(true);
          setAppStatus('idle');
          return;
        }
      }

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Engine failed to generate program');
      }

      await response.json();
      navigate('/dashboard/programs');
    } catch (err) {
      setError(err.message);
      setAppStatus('error');
    }
  };

  if (profile === undefined) {
    return <div className="flex justify-center items-center min-h-[60vh]"><div className="animate-spin h-8 w-8 border-2 border-gray-900 rounded-full border-t-transparent"></div></div>;
  }

  const needsMaxes = profile && profile.experience_level !== 'Beginner' && (!profile.squat_1rm || !profile.bench_1rm || !profile.deadlift_1rm);
  if (profile === null || needsMaxes) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-12">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Assessment first</h1>
          <p className="text-gray-500 mb-8">The engine needs your experience, training days, your three lifts (a 1RM or a recent heavy set) and weak points before it can build a block. 2–3 minutes.</p>
          <Link to="/dashboard/assessment" className="inline-flex items-center justify-center bg-gray-900 hover:bg-gray-800 text-white px-8 py-3.5 rounded-lg text-sm font-medium transition-colors">
            {profile ? 'Complete Assessment' : 'Start Assessment'}
          </Link>
        </div>
      </div>
    );
  }

  const isBeg = defaults?.form.exp === 'beg';
  const dtm = daysToMeet(profile);
  const meet = defaults?.meet || { phase: 'none' };
  // With a meet booked, the engine owns the block choice; the athlete can't pick a goal that fights the timeline.
  const meetLocked = meet.phase !== 'none';
  const st = settings?.weak && settings.weak !== 'none' && settings.sticking ? STICKING[settings.weak][settings.sticking] : null;

  return (
    <>
      <div className="max-w-3xl mx-auto px-4 md:px-8 py-8 md:py-12">
        {appStatus === 'idle' && settings && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="mb-8">
              <h1 className="text-2xl md:text-3xl font-semibold text-gray-900 tracking-tight">Build your next block</h1>
              <p className="text-gray-500 mt-1 text-sm md:text-base">
                Defaults come from your assessment — {profile.experience_level || 'Intermediate'}, {profile.training_days_per_week || 4} days/week,
                {profile.squat_1rm ? `${profile.assessment_data?.maxes_estimated ? 'est. ' : ''}1RM ${profile.squat_1rm}/${profile.bench_1rm}/${profile.deadlift_1rm} kg` : 'no maxes yet (beginner working weights)'}
                {dtm !== null && dtm > 0 ? ` · meet in ${dtm} days` : ''}.
                {' '}<Link to="/dashboard/assessment" className="text-blue-600 hover:text-blue-800 font-medium">Edit assessment</Link>
              </p>
            </div>

            {meetLocked && (
              <div className={`border rounded-xl p-5 mb-6 ${['meetweek', 'taper'].includes(meet.phase) ? 'bg-amber-50 border-amber-300' : 'bg-white border-gray-200'}`}>
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Meet-aware plan · {PHASE_LABEL[meet.phase]}</h2>
                <p className="text-sm text-gray-800">{meet.reason}</p>
              </div>
            )}

            {/* What the engine already decided */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 mb-6">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Engine read of your assessment</h2>
              <div className="space-y-2">
                {defaults.decisions.map((d, i) => (
                  <div key={i} className="text-sm">
                    <span className="font-semibold text-gray-900">{d.decision}</span>
                    <span className="text-gray-500"> — {d.reason}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
              {isBeg ? (
                <div className="mb-6 text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <b className="text-gray-900">Beginner Linear Block.</b> Three full-body days (squat + bench every session, deadlift once), +2.5 kg per week while RPE stays under 8. Extra days become technique + GPP. Block goal and focus unlock once you're intermediate.
                </div>
              ) : (
                <>
                  <Field label="Block Goal" hint={meetLocked ? 'Locked — the meet date decides the block' : 'The adaptation this 4-week block is chasing'}>
                    <Seg options={GOALS.filter((g) => g.v !== 'peak' || meetLocked)} value={settings.goal} onChange={(v) => set('goal', v)} locked={meetLocked} />
                  </Field>
                  <Field label="Block Focus" hint="Which lift gets the extra frequency" pro={!isPro} locked={!isPro} onLockedClick={lockedClick}>
                    <Seg options={FOCUS} value={settings.focus} onChange={(v) => set('focus', v)} locked={!isPro} />
                  </Field>
                </>
              )}

              <Field label="Days Per Week" hint="Be realistic — pick what you can actually sustain">
                <Seg options={DAYS} value={settings.days} onChange={(v) => set('days', v)} />
              </Field>

              <Field label="Weakest Lift" hint="Gets +1 set and a targeted variation" pro={!isPro} locked={!isPro} onLockedClick={lockedClick}>
                <Seg options={WEAK} value={settings.weak} onChange={setWeak} locked={!isPro} />
              </Field>
              {isPro && settings.weak !== 'none' && (
                <>
                  <Field label={`${LIFT_NAMES[settings.weak]} — where does it fail?`} hint="Symptom → test → hypothesis → intervention → reassess in 4–6 weeks">
                    <Seg options={Object.entries(STICKING[settings.weak]).map(([k, v]) => ({ v: k, l: v.l }))} value={settings.sticking} onChange={setSticking} />
                  </Field>
                  <Field label="Is it strength, technique or fatigue?" hint="Technique → lighter variation, no extra accessories. Fatigue → less volume, nothing new.">
                    <Seg options={WEAK_TYPE} value={settings.weakType || 'strength'} onChange={(v) => set('weakType', v)} />
                  </Field>
                  {st && settings.weakType !== 'fatigue' && (
                    <Field label="Variation (secondary lift)" hint="Default is first; pick what fits you and your gym">
                      <Seg options={st.variations.map((v, i) => ({ v: i, l: v.name }))} value={settings.variationIdx || 0} onChange={(v) => set('variationIdx', v)} />
                    </Field>
                  )}
                  {st && settings.weakType === 'strength' && (
                    <Field label="Weak-point accessory" hint={st.note}>
                      <Seg options={st.accessories.map((a, i) => ({ v: i, l: a.name, s: a.sr }))} value={settings.accIdx || 0} onChange={(v) => set('accIdx', v)} />
                    </Field>
                  )}
                </>
              )}

              <Field label="Gym Setup" hint="Machine/cable accessories are swapped for what you actually have">
                <Seg options={EQUIP} value={settings.equipment || 'commercial'} onChange={(v) => set('equipment', v)} />
              </Field>

              <Field label="Injury / Issue" hint="Swaps risky accessories and caps RPE on the affected lifts" pro={!isPro} locked={!isPro} onLockedClick={lockedClick}>
                <Seg multi options={INJ} value={settings.injuries} onChange={(v) => set('injuries', v)} locked={!isPro} />
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Sleep Average" hint="Volume auto-adjusts to recovery">
                  <Seg options={SLEEP} value={settings.sleep} onChange={(v) => set('sleep', v)} />
                </Field>
                <Field label="Stress Level">
                  <Seg options={STRESS} value={settings.stress} onChange={(v) => set('stress', v)} />
                </Field>
              </div>

              <button onClick={handleGenerate} className="w-full bg-gray-900 hover:bg-gray-800 text-white px-10 py-4 rounded-xl text-sm font-semibold transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5">
                {meetLocked ? 'Build my plan to the meet →' : 'Build my block →'}
              </button>
              {!isPro && (
                <p className="text-xs text-gray-400 mt-3 text-center">Free tier: one program, balanced focus. <button onClick={() => setShowUpgradeModal(true)} className="text-blue-600 hover:text-blue-800 font-medium">Unlock Pro</button> for sticking-point work, injury-aware swaps and unlimited blocks.</p>
              )}
            </div>
          </motion.div>
        )}

        {appStatus === 'generating' && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-10 text-center shadow-2xl">
            <div className="w-10 h-10 rounded-full border-2 border-white border-t-transparent animate-spin mx-auto mb-6"></div>
            <h2 className="text-lg font-semibold text-white mb-2">Building your block</h2>
            <p className="text-sm text-gray-400">Reading your assessment, the meet date and your weak points — then saving the plan.</p>
          </div>
        )}

        {appStatus === 'error' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-gray-900 border border-red-900 rounded-2xl p-10 text-center shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-2">Engine Error</h2>
            <p className="text-gray-500 mb-6 text-sm">{error}</p>
            <button onClick={() => setAppStatus('idle')} className="text-gray-400 hover:text-white font-medium text-sm border border-gray-700 px-6 py-2 rounded-lg">Back to settings</button>
          </motion.div>
        )}
      </div>
      <UpgradeModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} />
    </>
  );
}
