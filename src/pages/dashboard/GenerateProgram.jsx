import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useSubscription } from '../../context/SubscriptionContext';
import UpgradeModal from '../../components/UpgradeModal';
import { motion, AnimatePresence } from 'framer-motion';
import { profileToForm, STICKING, LIFT_NAMES, daysToMeet, SCHEMES, buildProgram, localYmd } from '../../lib/engine';
import { evaluateBlock } from '../../lib/autoreg';
import { appNow } from '../../lib/schedule';
import BlockReady from '../../components/dashboard/BlockReady';
import { useLang } from '../../lib/useLang';

// Settings the athlete can tune on top of the assessment defaults.
const GOALS = [
  { v: 'hyp', l: 'Base Block', hi: 'Base block', s: 'muscle + capacity', shi: 'muscle + capacity' },
  { v: 'str', l: 'Strength Block', hi: 'Strength block', s: 'heavy 2–4s at 80–90%', shi: '80–90% pe heavy 2–4 reps' },
  { v: 'peak', l: 'Peaking', hi: 'Peaking', s: 'meet / 1RM prep', shi: 'meet / 1RM ki taiyari' },
];
const FOCUS = [
  { v: 'bal', l: 'Balanced', hi: 'Balanced' }, { v: 'squat', l: 'Squat Focus', hi: 'Squat pe focus' }, { v: 'bench', l: 'Bench Focus', hi: 'Bench pe focus' }, { v: 'dead', l: 'Deadlift Focus', hi: 'Deadlift pe focus' },
];
const WEAK = [
  { v: 'none', l: 'Balanced' }, { v: 'squat', l: 'Squat' }, { v: 'bench', l: 'Bench' }, { v: 'deadlift', l: 'Deadlift' },
];
const DAYS = [3, 4, 5, 6].map((d) => ({ v: d, l: `${d}` }));
const SLEEP = [{ v: 'high', l: '7+ hrs', hi: '7+ ghante' }, { v: 'mid', l: '6–7 hrs', hi: '6–7 ghante' }, { v: 'low', l: '< 6 hrs', hi: '< 6 ghante' }];
const STRESS = [{ v: 'low', l: 'Low', hi: 'Kam' }, { v: 'mid', l: 'Moderate', hi: 'Thoda' }, { v: 'high', l: 'High', hi: 'Zyada' }];
const INJ = [{ v: 'back', l: 'Lower Back', hi: 'Lower back' }, { v: 'knee', l: 'Knee', hi: 'Ghutna' }, { v: 'shoulder', l: 'Shoulder', hi: 'Shoulder' }];
const WEAK_TYPE = [
  { v: 'strength', l: 'Strength', s: 'form fine, bar slows when heavy', shi: 'form theek, heavy pe bar slow' },
  { v: 'technique', l: 'Technique', s: 'form breaks even light', shi: 'halke weight pe bhi form tootta hai' },
  { v: 'fatigue', l: 'Fatigue', s: 'warm-ups feel heavy', shi: 'warm-up bhi heavy lagta hai' },
];
const EQUIP = [{ v: 'commercial', l: 'Commercial gym' }, { v: 'basic', l: 'Barbell + DB' }, { v: 'minimal', l: 'Barbell only', hi: 'Sirf barbell' }];
const PHASE_LABEL = { base: 'Base Block', strength: 'Strength Block', peak: 'Peaking Block', taper: 'Taper → Meet', meetweek: 'Meet Week', post: 'Post-meet Deload', beginner: 'Beginner Linear' };
const PHASE_LABEL_HI = { base: 'Base block', strength: 'Strength block', peak: 'Peaking block', taper: 'Taper → Meet', meetweek: 'Meet wala hafta', post: 'Meet ke baad deload', beginner: 'Beginner linear' };

function Seg({ options, value, onChange, multi, locked }) {
  const { L } = useLang();
  return (
    <div className={`flex flex-wrap gap-2 ${locked ? 'opacity-50' : ''}`}>
      {options.map((o) => {
        const active = multi ? !!value[o.v] : value === o.v;
        return (
          <button key={o.v} type="button" aria-disabled={locked || undefined}
            onClick={() => { if (locked) return; (multi ? onChange({ ...value, [o.v]: !value[o.v] }) : onChange(o.v)); }}
            className={`px-3.5 py-2 rounded-lg text-sm font-semibold border transition-colors text-left ${active ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'} ${locked ? 'cursor-not-allowed' : ''}`}>
            {L(o.l, o.hi)}
            {o.s && <span className="block text-[11px] font-normal opacity-75">{L(o.s, o.shi)}</span>}
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

/** The "engine at work" slides. Every line is computed from this athlete's real data and the real
 *  engine output (the same pure function the server runs) — dramatic presentation, nothing invented. */
function buildSlides(profile, settings, L = (en) => en) {
  const { form, maxes, decisions } = profileToForm(profile, settings || {});
  const program = buildProgram(form, maxes);
  const find = (step) => decisions.find((d) => d.step === step);
  const bw = Number(profile.bodyweight_kg) || 0;
  const lifts = ['squat', 'bench', 'deadlift'];
  const slides = [];
  slides.push({
    kicker: L('Step 1 · Your numbers', 'Step 1 · Aapke numbers'),
    title: maxes.squat ? `${maxes.squat} / ${maxes.bench} / ${maxes.deadlift} kg` : L('Working weights mode', 'Working weights mode'),
    lines: [
      maxes.squat ? `Total ${maxes.squat + maxes.bench + maxes.deadlift} kg${maxes.estimated ? L(' (estimated — loads stay ≤ 87.5% until confirmed)', ' (estimated — confirm hone tak loads ≤ 87.5% rahenge)') : L(' (tested)', ' (tested)')}` : L('No maxes needed — the engine prescribes working weights you can do with reps left.', 'Max ki zaroorat nahi — engine aise working weights dega jo aap kuch reps bacha ke kar sako.'),
      ...(bw && maxes.squat ? [`${L('Strength-to-bodyweight', 'Strength-to-bodyweight')}: ${lifts.map((l) => `${LIFT_NAMES[l].split(' ')[0]} ${(maxes[l] / bw).toFixed(2)}×`).join(' · ')}`] : []),
    ],
  });
  slides.push({
    kicker: L('Step 2 · Training age', 'Step 2 · Training age'),
    title: { beg: L('Novice progression', 'Novice progression'), int: L('Intermediate progression', 'Intermediate progression'), adv: L('Advanced progression', 'Advanced progression') }[form.exp],
    lines: [find('Training Age')?.reason || ({ beg: L('Load goes up every week on each day while reps stay clean.', 'Har din ka load har hafte badhega, jab tak reps clean rahein.'), int: L('Weekly waves: reps down, load up, then a lighter week.', 'Weekly waves: reps kam, load zyada, phir ek halka hafta.'), adv: L('Blocks of accumulation and intensification, autoregulated by RPE.', 'Accumulation aur intensification ke blocks, RPE se autoregulate.') }[form.exp])],
  });
  const block = find('Block Selection');
  slides.push({
    kicker: L('Step 3 · Timeline', 'Step 3 · Timeline'),
    title: program.blockLabel,
    lines: [block?.reason || '', ...(form.compLifts?.length < 3 ? [L(`Platform: ${form.compLifts.map((l) => LIFT_NAMES[l]).join(' + ')} only — the other lifts are maintained.`, `Platform: sirf ${form.compLifts.map((l) => LIFT_NAMES[l]).join(' + ')} — baaki lifts maintain honge.`)] : [])].filter(Boolean),
  });
  const wp = find('Weak-Point Diagnosis');
  slides.push({ kicker: L('Step 4 · Weak point', 'Step 4 · Weak point'), title: wp?.decision || L('Balanced', 'Balanced'), lines: [wp?.reason || ''].filter(Boolean) });
  const inj = find('Injury Screen');
  slides.push({
    kicker: L('Step 5 · Recovery & safety', 'Step 5 · Recovery aur safety'),
    title: { good: L('Recovery: good', 'Recovery: achhi'), mid: L('Recovery: borderline', 'Recovery: borderline'), poor: L('Recovery: low — volume adjusted', 'Recovery: kam — volume adjust kiya') }[program.rec.level],
    lines: [
      program.rec.note || L('Sleep and stress support the full plan.', 'Neend aur stress poore plan ke liye theek hain.'),
      inj ? L(`Injury flags: ${inj.decision} → loads capped on that lift, joint-safe swaps.`, `Injury flags: ${inj.decision} → us lift pe load capped, joint-safe swaps.`) : L('No injury flags.', 'Koi injury flag nahi.'),
      ...(find('Weight Cut') ? [L('Weight-class cut → one level less volume, deload every block.', 'Weight-class cut → ek level kam volume, har block mein deload.')] : []),
    ],
  });
  slides.push({
    kicker: L('Step 6 · Volume & frequency', 'Step 6 · Volume aur frequency'),
    title: program.freq,
    lines: [L(`${program.budget[0]}–${program.budget[1]} hard sets per movement per week for your level.`, `Aapke level ke liye har movement pe hafte mein ${program.budget[0]}–${program.budget[1]} hard sets.`), ...(program.notes.filter((n) => n.startsWith('Deadlift')).slice(0, 1))],
  });
  const w1 = program.weeks[0];
  const tops = lifts.map((l) => {
    const all = (w1?.days || []).flatMap((d) => d.main).filter((x) => x.lift === l && !/Technique|maintenance|Paused|Variation/i.test(x.name));
    const m = all.sort((a, b) => (b.kg || 0) - (a.kg || 0))[0];
    return m ? `${LIFT_NAMES[l]} ${m.sets}×${m.reps}${m.kg ? ` @ ${m.kg} kg` : ''}` : null;
  }).filter(Boolean);
  const sessions = program.weeks.reduce((n, w) => n + w.days.filter((d) => !d.meetDay && !d.rest).length, 0);
  slides.push({ kicker: L('Step 7 · Your block', 'Step 7 · Aapka block'), title: L(`${program.weeks.length} weeks · ${sessions} sessions`, `${program.weeks.length} hafte · ${sessions} sessions`), lines: [L(`Week 1 heavy work: ${tops.join(' · ') || 'see program'}`, `Week 1 ka heavy kaam: ${tops.join(' · ') || 'program dekho'}`), L('Every load rounded to real plates. Every day dated on your calendar.', 'Har load asli plates ke hisaab se round. Har din aapke calendar pe date ke saath.')] });
  return slides;
}

export default function GenerateProgram() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { status } = useSubscription();
  const { L } = useLang();
  const isPro = status === 'pro_active';

  const [profile, setProfile] = useState(undefined); // undefined = loading, null = none
  const [defaults, setDefaults] = useState(null);
  const [settings, setSettings] = useState(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [appStatus, setAppStatus] = useState('idle');
  const [error, setError] = useState('');
  const [slides, setSlides] = useState([]);
  const [slideIdx, setSlideIdx] = useState(0);
  const [saved, setSaved] = useState(false);
  const [result, setResult] = useState(null); // the saved snapshot, for the "block ready" screen
  const [lastBlock, setLastBlock] = useState(null);
  const [levelChoice, setLevelChoice] = useState(null); // null | 'saving' | 'done' | 'stay' | error text

  const applyProfile = (data) => {
    setProfile(data || null);
    if (data) {
      const d = profileToForm(data, { today: localYmd(appNow()) });
      setDefaults(d);
      const { goal, focus, weak, sticking, weakType, variationIdx, accIdx, injuries, sleep, stress, days, equipment } = d.form;
      setSettings({ goal, focus, weak, sticking, weakType, variationIdx, accIdx, injuries, sleep, stress, days, equipment, style: d.form.style });
    }
  };

  // The block's data says linear progression has run out → the athlete confirms the move to intermediate.
  const moveToIntermediate = async () => {
    setLevelChoice('saving');
    const assessment_data = { ...(profile?.assessment_data || {}), progress_rate: 'week', level_unsure: false };
    const { data, error } = await supabase.from('athlete_profiles')
      .update({ experience_level: 'Intermediate', assessment_data, updated_at: new Date().toISOString() })
      .eq('user_id', user.id).select('*').maybeSingle();
    if (error || !data) { setLevelChoice(`Could not save: ${error?.message || 'please try again'}`); return; }
    applyProfile(data);
    setLevelChoice('done');
  };

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('athlete_profiles').select('*').eq('user_id', user.id).maybeSingle();
      applyProfile(data);
      // Review of the current block (same function the API uses) so the athlete sees what the engine will do with it.
      const { data: prev } = await supabase.from('generated_programs').select('id, program_snapshot').eq('user_id', user.id).eq('is_active', true).order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (prev?.program_snapshot?.weeks) {
        const { data: logs } = await supabase.from('workout_logs').select('week_number, day_number, date_completed, logged_exercises').eq('program_id', prev.id).eq('is_deleted', false).limit(200);
        if (logs?.length) setLastBlock({ block: prev.program_snapshot.blockType, ...evaluateBlock(prev.program_snapshot, logs, prev.program_snapshot.adjustments?.checkins || {}) });
      }
    };
    load();
  }, [user]);

  const set = (k, v) => setSettings((s) => ({ ...s, [k]: v }));
  const setWeak = (v) => setSettings((s) => ({ ...s, weak: v, sticking: v === 'none' ? null : Object.keys(STICKING[v])[0], variationIdx: 0, accIdx: 0 }));
  const setSticking = (v) => setSettings((s) => ({ ...s, sticking: v, variationIdx: 0, accIdx: 0 }));
  const lockedClick = () => { if (!isPro) setShowUpgradeModal(true); };

  // Advance the slides; leave for the program only when the last slide was shown AND the save finished.
  useEffect(() => {
    if (appStatus !== 'generating' || !slides.length) return;
    if (slideIdx < slides.length - 1) { const t = setTimeout(() => setSlideIdx((i) => i + 1), 1600); return () => clearTimeout(t); }
    if (saved) { const t = setTimeout(() => setAppStatus('ready'), 900); return () => clearTimeout(t); }
  }, [appStatus, slides, slideIdx, saved, navigate]);

  const handleGenerate = async () => {
    setError('');
    setSaved(false);
    setSlideIdx(0);
    const today = localYmd(appNow()); // test mode builds the block as of the test date
    try { setSlides(buildSlides(profile, { ...(settings || {}), today }, L)); } catch { setSlides([]); }
    setAppStatus('generating');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch('/api/generate-program', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...(settings || {}), today }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({})); // read the body once
        if (response.status === 403 && errData.error === 'UPGRADE_REQUIRED') {
          setShowUpgradeModal(true);
          setAppStatus('idle');
          return;
        }
        throw new Error(errData.error || 'Engine failed to generate program');
      }

      const out = await response.json();
      setResult(out.snapshot || null);
      setSaved(true);
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
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{L('Assessment first', 'Pehle assessment')}</h1>
          <p className="text-gray-500 mb-8">{L('The engine needs your experience, training days, your three lifts (a 1RM or a recent heavy set) and weak points before it can build a block. About 5 minutes.', 'Block banane se pehle engine ko aapka experience, training days, teeno lifts (1RM ya koi recent heavy set) aur weak points chahiye. Bas 5 minute lagenge.')}</p>
          <Link to="/dashboard/assessment" className="inline-flex items-center justify-center bg-gray-900 hover:bg-gray-800 text-white px-8 py-3.5 rounded-lg text-sm font-medium transition-colors">
            {profile ? L('Complete Assessment', 'Assessment poora karo') : L('Start Assessment', 'Assessment shuru karo')}
          </Link>
        </div>
      </div>
    );
  }

  const isBeg = defaults?.form.exp === 'beg';
  const dtm = daysToMeet(profile, localYmd(appNow()));
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
              <h1 className="text-2xl md:text-3xl font-semibold text-gray-900 tracking-tight">{L('Build your next block', 'Apna agla block banao')}</h1>
              <p className="text-gray-500 mt-1 text-sm md:text-base">
                {L('Defaults come from your assessment — ', 'Defaults aapke assessment se aaye hain — ')}{profile.experience_level || 'Intermediate'}, {profile.training_days_per_week || 4} {L('days/week', 'din/hafta')},
                {profile.squat_1rm ? `${profile.assessment_data?.maxes_estimated ? 'est. ' : ''}1RM ${profile.squat_1rm}/${profile.bench_1rm}/${profile.deadlift_1rm} kg` : L('no maxes yet (beginner working weights)', 'abhi max nahi (beginner working weights)')}
                {dtm !== null && dtm > 0 ? L(` · meet in ${dtm} days`, ` · meet ${dtm} din mein`) : ''}.
                {' '}<Link to="/dashboard/assessment" className="text-blue-600 hover:text-blue-800 font-medium">{L('Edit assessment', 'Assessment edit karo')}</Link>
              </p>
            </div>

            {meetLocked && (
              <div className={`border rounded-xl p-5 mb-6 ${['meetweek', 'taper'].includes(meet.phase) ? 'bg-amber-50 border-amber-300' : 'bg-white border-gray-200'}`}>
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{L('Meet-aware plan', 'Meet ke hisaab se plan')} · {L(PHASE_LABEL[meet.phase], PHASE_LABEL_HI[meet.phase])}{defaults.form.compLifts?.length < 3 ? L(` · ${defaults.form.compLifts.map((l) => LIFT_NAMES[l]).join(' + ')} only`, ` · sirf ${defaults.form.compLifts.map((l) => LIFT_NAMES[l]).join(' + ')}`) : ''}</h2>
                <p className="text-sm text-gray-800">{meet.reason}</p>
              </div>
            )}

            {lastBlock && (
              <div className={`border rounded-xl p-5 mb-6 ${lastBlock.verdict === 'advance' ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{L('Review of your current block', 'Aapke current block ka review')} · {lastBlock.block}</h2>
                <p className="text-sm text-gray-800">{lastBlock.reason}</p>
                {Object.entries(lastBlock.e1rm || {}).filter(([, v]) => v).length > 0 && (
                  <p className="text-xs text-gray-600 mt-2">{L('Training-based maxes:', 'Training se nikle max:')} {Object.entries(lastBlock.e1rm).filter(([, v]) => v).map(([l, v]) => `${LIFT_NAMES[l]} ~${v.e1rm} kg (${v.from})`).join(' · ')}. {L('If higher than your profile, the engine updates it — no max test needed.', 'Agar profile se zyada hai to engine update kar dega — max test ki zaroorat nahi.')}</p>
                )}
              </div>
            )}

            {lastBlock?.levelUp && (isBeg || levelChoice === 'done') && levelChoice !== 'stay' && (
              <div className="border border-blue-200 bg-blue-50 rounded-xl p-5 mb-6">
                {levelChoice === 'done' ? (
                  <>
                    <h2 className="text-base font-semibold text-gray-900">{L("You're an intermediate lifter now 🎉", 'Ab aap intermediate lifter ho 🎉')}</h2>
                    <p className="text-sm text-gray-700 mt-1">{L('Your next block is built as an intermediate block. The settings below have been updated.', 'Aapka agla block intermediate block ki tarah banega. Neeche ki settings update ho gayi hain.')}</p>
                  </>
                ) : (
                  <>
                    <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">{L('Level up', 'Level up')}</p>
                    <h2 className="text-base font-semibold text-gray-900 mt-0.5">{L('Your data says: time to train as an intermediate', 'Aapka data keh raha hai: ab intermediate ki tarah train karne ka time hai')}</h2>
                    <p className="text-sm text-gray-700 mt-1">{lastBlock.levelUp.reason}</p>
                    <p className="text-xs text-gray-500 mt-2">{L('Life got in the way this block (illness, bad sleep, missed food)? Stay a beginner one more block — the app checks again at the end of it.', 'Is block mein life beech mein aa gayi (bimaari, kharab neend, khana miss)? Ek block aur beginner raho — app uske end mein phir check karega.')}</p>
                    {typeof levelChoice === 'string' && levelChoice.startsWith('Could not') && <p className="text-xs text-red-600 mt-2">{L(levelChoice, levelChoice.replace('Could not save:', 'Save nahi hua:'))}</p>}
                    <div className="flex flex-wrap gap-2 mt-3">
                      <button type="button" disabled={levelChoice === 'saving'} onClick={moveToIntermediate} className="bg-gray-900 text-white text-sm font-semibold px-4 py-2.5 rounded-lg disabled:opacity-60">{levelChoice === 'saving' ? L('Saving…', 'Save ho raha hai…') : L('Yes, move me to Intermediate', 'Haan, mujhe Intermediate mein daalo')}</button>
                      <button type="button" onClick={() => setLevelChoice('stay')} className="border border-gray-300 text-gray-700 text-sm font-semibold px-4 py-2.5 rounded-lg">{L('Stay beginner one more block', 'Ek block aur beginner rehna hai')}</button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* What the engine already decided */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 mb-6">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">{L('Engine read of your assessment', 'Engine ne aapke assessment se kya samjha')}</h2>
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
                  <b className="text-gray-900">{L('Novice block.', 'Novice block.')}</b> {L("A volume day, a technique + deadlift day and a strength day (4th day = accessories). Each day adds load every week — squat/deadlift +5 kg, bench +2.5 kg — while every rep stays clean. Block goal and focus unlock once you're intermediate.", 'Ek volume day, ek technique + deadlift day aur ek strength day (4th day = accessories). Har din ka load har hafte badhega — squat/deadlift +5 kg, bench +2.5 kg — jab tak har rep clean rahe. Intermediate bante hi block goal aur focus unlock honge.')}
                </div>
              ) : (
                <>
                  <Field label={L('Block Goal', 'Block goal')} hint={meetLocked ? L('Locked — the meet date decides the block', 'Locked — meet ki date block decide karti hai') : L('The adaptation this 4-week block is chasing', 'Yeh 4-week block kis adaptation ke peeche hai')}>
                    <Seg options={GOALS.filter((g) => g.v !== 'peak' || meetLocked)} value={settings.goal} onChange={(v) => set('goal', v)} locked={meetLocked} />
                  </Field>
                  <Field label={L('Block Focus', 'Block focus')} hint={L('Which lift gets the extra frequency', 'Kis lift ko extra frequency milegi')} pro={!isPro} locked={!isPro} onLockedClick={lockedClick}>
                    <Seg options={FOCUS} value={settings.focus} onChange={(v) => set('focus', v)} locked={!isPro} />
                  </Field>
                </>
              )}

              <Field label={L('Days Per Week', 'Hafte mein din')} hint={['taper', 'meetweek'].includes(meet.phase) ? L('Locked — in the last 2 weeks the meet date decides the sessions (fewer sessions, same heavy weights). Other days show as rest / optional recovery.', 'Locked — last 2 hafton mein meet ki date sessions decide karti hai (kam sessions, wahi heavy weights). Baaki din rest / optional recovery dikhenge.') : meet.phase === 'peak' ? L('Used for the peaking weeks. The taper and meet week will have fewer sessions on purpose.', 'Peaking weeks ke liye use hoga. Taper aur meet week mein jaan-boojh ke kam sessions honge.') : L('Be realistic — pick what you can actually sustain', 'Realistic raho — woh chuno jo sach mein nibha sako')}>
                <Seg options={DAYS} value={settings.days} onChange={(v) => set('days', v)} locked={['taper', 'meetweek'].includes(meet.phase)} />
              </Field>

              <Field label={L('Accessory Work', 'Accessory work')} hint={L('Main lifts stay the same — this sets how much extra work surrounds them. Session length still caps it.', 'Main lifts same rahenge — isse sirf unke aas-paas ka extra kaam set hota hai. Session length phir bhi limit lagati hai.')}>
                <Seg options={[{ v: 'focused', l: 'Focused', s: 'essentials only', shi: 'sirf zaroori' }, { v: 'balanced', l: 'Balanced', s: '3–4 a day', shi: 'din mein 3–4' }, { v: 'full', l: 'Full', s: 'more pump work', shi: 'zyada pump work' }]} value={settings.style || 'balanced'} onChange={(v) => set('style', v)} />
              </Field>

              {!isBeg && (
                <>
                <Field label={L('Weakest Lift', 'Sabse weak lift')} hint={L('Gets +1 set and a targeted variation', 'Isko +1 set aur ek targeted variation milega')} pro={!isPro} locked={!isPro} onLockedClick={lockedClick}>
                  <Seg options={WEAK} value={settings.weak} onChange={setWeak} locked={!isPro} />
                </Field>
                {isPro && settings.weak !== 'none' && (
                  <>
                    <Field label={L(`${LIFT_NAMES[settings.weak]} — where does it fail?`, `${LIFT_NAMES[settings.weak]} — kahan fail hota hai?`)} hint={L('Symptom → test → hypothesis → intervention → reassess in 4–6 weeks', 'Symptom → test → hypothesis → intervention → 4–6 hafte mein dobara check')}>
                      <Seg options={Object.entries(STICKING[settings.weak]).map(([k, v]) => ({ v: k, l: v.l }))} value={settings.sticking} onChange={setSticking} />
                    </Field>
                    <Field label={L('Is it strength, technique or fatigue?', 'Strength hai, technique ya fatigue?')} hint={L('Technique → lighter variation, no extra accessories. Fatigue → less volume, nothing new.', 'Technique → halka variation, extra accessories nahi. Fatigue → kam volume, kuch naya nahi.')}>
                      <Seg options={WEAK_TYPE} value={settings.weakType || 'strength'} onChange={(v) => set('weakType', v)} />
                    </Field>
                    {st && settings.weakType !== 'fatigue' && (
                      <Field label={L('Variation (secondary lift)', 'Variation (secondary lift)')} hint={L('Default is first; pick what fits you and your gym', 'Pehla wala default hai; jo aapko aur aapke gym ko suit kare woh chuno')}>
                        <Seg options={st.variations.map((v, i) => ({ v: i, l: v.name }))} value={settings.variationIdx || 0} onChange={(v) => set('variationIdx', v)} />
                      </Field>
                    )}
                    {st && settings.weakType === 'strength' && (
                      <Field label={L('Weak-point accessory', 'Weak-point accessory')} hint={st.note}>
                        <Seg options={st.accessories.map((a, i) => ({ v: i, l: a.name, s: a.sr }))} value={settings.accIdx || 0} onChange={(v) => set('accIdx', v)} />
                      </Field>
                    )}
                  </>
                )}
                </>
              )}

              <Field label={L('Gym Setup', 'Gym setup')} hint={L('Machine/cable accessories are swapped for what you actually have', 'Machine/cable accessories ko woh cheez se badla jaayega jo aapke paas sach mein hai')}>
                <Seg options={EQUIP} value={settings.equipment || 'commercial'} onChange={(v) => set('equipment', v)} />
              </Field>

              {/* Safety is never a paid extra: injury caps and swaps work on the free plan too. */}
              <Field label={L('Injury / Issue', 'Injury / problem')} hint={L('Swaps risky accessories and caps RPE on the affected lifts', 'Risky accessories badal deta hai aur affected lifts pe RPE cap karta hai')}>
                <Seg multi options={INJ} value={settings.injuries} onChange={(v) => set('injuries', v)} />
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label={L('Sleep Average', 'Average neend')} hint={L('Volume auto-adjusts to recovery', 'Volume recovery ke hisaab se khud adjust hota hai')}>
                  <Seg options={SLEEP} value={settings.sleep} onChange={(v) => set('sleep', v)} />
                </Field>
                <Field label={L('Stress Level', 'Stress level')}>
                  <Seg options={STRESS} value={settings.stress} onChange={(v) => set('stress', v)} />
                </Field>
              </div>

              <button onClick={handleGenerate} className="w-full bg-gray-900 hover:bg-gray-800 text-white px-10 py-4 rounded-xl text-sm font-semibold transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5">
                {meetLocked ? L('Build my plan to the meet →', 'Meet tak ka plan banao →') : L('Build my block →', 'Mera block banao →')}
              </button>
              {!isPro && (
                <p className="text-xs text-gray-400 mt-3 text-center">{L('Free tier: Week 1 of one program, balanced focus.', 'Free tier: ek program ka sirf Week 1, balanced focus.')} <button onClick={() => setShowUpgradeModal(true)} className="text-blue-600 hover:text-blue-800 font-medium">{L('Unlock Pro', 'Pro unlock karo')}</button> {L('for sticking-point work, block focus and unlimited blocks.', 'sticking-point work, block focus aur unlimited blocks ke liye.')}</p>
              )}
            </div>
          </motion.div>
        )}

        {appStatus === 'generating' && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 md:p-10 shadow-2xl min-h-[340px] flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-500">{L('Iron Engine · analysing', 'Iron Engine · analyse ho raha hai')}</span>
              <div className="flex gap-1.5">{slides.map((_, i) => <span key={i} className={`h-1.5 rounded-full transition-all ${i <= slideIdx ? 'w-5 bg-white' : 'w-1.5 bg-gray-700'}`}></span>)}</div>
            </div>
            <div className="flex-1">
              <AnimatePresence mode="wait">
                {slides[slideIdx] ? (
                  <motion.div key={slideIdx} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.35 }}>
                    <p className="text-xs font-semibold uppercase tracking-wider text-red-400 mb-2">{slides[slideIdx].kicker}</p>
                    <h2 className="text-2xl md:text-3xl font-bold text-white mb-4 leading-tight">{slides[slideIdx].title}</h2>
                    <div className="space-y-2">{slides[slideIdx].lines.map((l, i) => (
                      <motion.p key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 + i * 0.25 }} className="text-sm md:text-base text-gray-300">{l}</motion.p>
                    ))}</div>
                  </motion.div>
                ) : (
                  <div className="text-gray-400 text-sm">{L('Building your block…', 'Aapka block ban raha hai…')}</div>
                )}
              </AnimatePresence>
            </div>
            <div className="mt-6 flex items-center gap-3 text-sm">
              {saved ? <span className="text-green-400 font-semibold">{L('✓ Block saved', '✓ Block save ho gaya')}{slideIdx >= slides.length - 1 ? L(' — opening your program…', ' — aapka program khul raha hai…') : ''}</span>
                : <><span className="w-4 h-4 rounded-full border-2 border-gray-400 border-t-transparent animate-spin"></span><span className="text-gray-400">{L('Writing every set, rep and kilo to your account…', 'Har set, rep aur kilo aapke account mein likha ja raha hai…')}</span></>}
            </div>
          </div>
        )}

        {appStatus === 'ready' && (result
          ? <BlockReady snapshot={result} athlete={profile?.full_name} />
          : <div className="text-center py-16"><Link to="/dashboard/programs" className="bg-gray-900 text-white px-6 py-3 rounded-lg font-semibold">{L('Open my program', 'Mera program kholo')}</Link></div>)}

        {appStatus === 'error' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-gray-900 border border-red-900 rounded-2xl p-10 text-center shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-2">{L('Engine Error', 'Engine mein error')}</h2>
            <p className="text-gray-500 mb-6 text-sm">{error}</p>
            <button onClick={() => setAppStatus('idle')} className="text-gray-400 hover:text-white font-medium text-sm border border-gray-700 px-6 py-2 rounded-lg">{L('Back to settings', 'Settings pe wapas')}</button>
          </motion.div>
        )}
      </div>
      <UpgradeModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} />
    </>
  );
}
