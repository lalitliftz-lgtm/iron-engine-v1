import { useState, useEffect, useCallback, useRef } from 'react';
import { epley, round25 } from '../../lib/engine';
import { useForm } from 'react-hook-form';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { Input, TextArea, Choice, Hint } from '../../components/ui/FormControls';
import { useNavigate, Link } from 'react-router-dom';
import { parseYmd } from '../../lib/schedule';
import { useLang } from '../../lib/useLang';

const LIFTS = [['squat', 'Squat'], ['bench', 'Bench Press'], ['deadlift', 'Deadlift']];
const NUMERIC = ['age', 'height_cm', 'bodyweight_kg', 'squat_1rm', 'bench_1rm', 'deadlift_1rm', 'training_days_per_week'];
const num = (v) => (v === '' || v === null || v === undefined || Number.isNaN(Number(v)) ? null : Number(v));
/** 1RM from a recent heavy set (Epley), rounded to the plates. */
const e1rm = (w, r) => { const W = num(w), R = num(r); return W && R ? round25(epley(W, Math.min(R, 10))) : null; };

// Answers the old dropdowns pre-selected; radios need them explicitly.
const DEFAULTS = { training_style: 'balanced', competition_status: 'false', meet_date_status: 'exact', meet_events: 'full', cutting: 'no', session_minutes: '', progress_rate: '',
  squat_weak_point: 'None', bench_weak_point: 'None', deadlift_weak_point: 'None', weak_type: 'strength', squat_bar: '', deadlift_stance: '',
  rpe_experience: 'true', equipment_level: 'commercial' };

const steps = [
  { id: 'basics', title: 'Basic Info', hi: 'Basic jaankari', fields: ['full_name', 'age', 'sex', 'height_cm', 'bodyweight_kg', 'experience_level'] },
  { id: 'strength', title: 'Strength Metrics', hi: 'Strength numbers', fields: ['squat_1rm', 'bench_1rm', 'deadlift_1rm', 'training_days_per_week', 'session_minutes', 'training_style', 'progress_rate', 'squat_set_w', 'squat_set_r', 'bench_set_w', 'bench_set_r', 'deadlift_set_w', 'deadlift_set_r'] },
  { id: 'goals', title: 'Goals & Competition', hi: 'Goal aur competition', fields: ['primary_goal', 'competition_status', 'competition_date', 'meet_date_status', 'meet_events', 'cutting'] },
  { id: 'recovery', title: 'Recovery & Life', hi: 'Recovery aur life', fields: ['sleep_level', 'stress_level', 'max_tested', 'other_sport'] },
  { id: 'diagnostics', title: 'Diagnostics', hi: 'Diagnostics', fields: ['squat_weak_point', 'bench_weak_point', 'deadlift_weak_point', 'squat_bar', 'deadlift_stance', 'rpe_experience'] },
  { id: 'constraints', title: 'Constraints & Equipment', hi: 'Limits aur equipment', fields: ['current_injuries', 'equipment_level', 'available_equipment', 'restricted_exercises', 'coach_notes'] },
  { id: 'review', title: 'Review', hi: 'Check karo', fields: [] }
];

/** The level a "Not sure" answer is saved as: whatever "how fast do your lifts go up" implies, else Beginner (safe start). */
function unsureLevel(progressRate, level = 'Not sure') {
  if (level !== 'Not sure') return level;
  return { week: 'Intermediate', month: 'Advanced' }[progressRate] || 'Beginner';
}

export default function AssessmentWizard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { L } = useLang();
  const [currentStep, setCurrentStep] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [loadState, setLoadState] = useState(true);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const { register, handleSubmit, watch, trigger, formState: { errors }, reset, getValues } = useForm({ mode: 'onChange', defaultValues: DEFAULTS });
  const saveTimer = useRef(null);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      const { data } = await supabase.from('athlete_profiles').select('*').eq('user_id', user.id).maybeSingle();
      if (data) {
        const a = data.assessment_data || {};
        const formData = { ...data, ...a };
        // Radio values are strings: stored booleans/numbers must match them to show as selected.
        for (const k of ['competition_status', 'training_days_per_week', 'rpe_experience', 'session_minutes']) if (formData[k] !== undefined && formData[k] !== null) formData[k] = String(formData[k]);
        for (const k of Object.keys(formData)) if (formData[k] === null || formData[k] === undefined) delete formData[k];
        // Recent-set inputs live inside assessment_data.recent_sets
        for (const [l] of LIFTS) { formData[`${l}_set_w`] = a.recent_sets?.[l]?.w ?? ''; formData[`${l}_set_r`] = a.recent_sets?.[l]?.r ?? ''; }
        // Estimated maxes are shown in the "recent set" row, not as a typed 1RM
        if (a.maxes_estimated) for (const [l] of LIFTS) if (a.recent_sets?.[l]?.w) formData[`${l}_1rm`] = '';
        if (a.level_unsure) formData.experience_level = 'Not sure';
        delete formData.assessment_data; delete formData.id; delete formData.created_at; delete formData.updated_at; delete formData.user_id;
        reset({ ...DEFAULTS, ...formData });
      }
      setLoadState(false);
    };
    fetchProfile();
  }, [user, reset]);

  const saveData = useCallback(async (formData) => {
    setIsSaving(true);
    setSaveError('');
    const dbFields = {
      full_name: formData.full_name || null, sex: formData.sex || null, experience_level: formData.experience_level === 'Not sure' ? unsureLevel(formData.progress_rate) : formData.experience_level || null,
      primary_goal: formData.primary_goal || null,
      competition_status: formData.competition_status === 'true',
      competition_date: formData.competition_status === 'true' && formData.competition_date ? formData.competition_date : null,
    };
    for (const k of NUMERIC) dbFields[k] = num(formData[k]);
    // Lift numbers: a typed 1RM wins; otherwise estimate from the recent heavy set.
    const recent_sets = {};
    let estimated = false;
    for (const [l] of LIFTS) {
      recent_sets[l] = { w: num(formData[`${l}_set_w`]), r: num(formData[`${l}_set_r`]) };
      if (!dbFields[`${l}_1rm`]) { const est = e1rm(recent_sets[l].w, recent_sets[l].r); if (est) { dbFields[`${l}_1rm`] = est; estimated = true; } }
    }
    const jsonFields = {
      squat_weak_point: formData.squat_weak_point, bench_weak_point: formData.bench_weak_point, deadlift_weak_point: formData.deadlift_weak_point,
      current_injuries: formData.current_injuries, available_equipment: formData.available_equipment, restricted_exercises: formData.restricted_exercises,
      rpe_experience: formData.rpe_experience, coach_notes: formData.coach_notes,
      weak_type: formData.weak_type, equipment_level: formData.equipment_level,
      recent_sets, maxes_estimated: estimated,
      progress_rate: formData.progress_rate || '', session_minutes: formData.session_minutes || '', training_style: formData.training_style || 'balanced',
      meet_events: formData.meet_events || 'full', cutting: formData.cutting || 'no',
      squat_bar: formData.squat_bar || '', deadlift_stance: formData.deadlift_stance || '',
      meet_date_status: formData.meet_date_status || 'exact', sleep_level: formData.sleep_level || '', stress_level: formData.stress_level || '',
      max_tested: formData.max_tested || '', other_sport: formData.other_sport || '',
      // "Not sure" is saved as the level their progress answer implies (Beginner when that's unknown too) + this flag;
      // the block-end review moves a beginner up when their logs say so.
      level_unsure: formData.experience_level === 'Not sure',
    };
    const payload = { ...dbFields, user_id: user.id, assessment_data: jsonFields, updated_at: new Date().toISOString() };
    const { error } = await supabase.from('athlete_profiles').upsert(payload, { onConflict: 'user_id' });
    if (error) setSaveError(error.message);
    setIsSaving(false);
    return !error;
  }, [user.id]);

  // Debounced autosave: one save 1.5 s after the last keystroke, not one per keystroke.
  useEffect(() => {
    let pending = null;
    const subscription = watch((value) => {
      pending = value;
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => { pending = null; saveData(value); }, 1500);
    });
    // Leaving the page within 1.5 s of an edit (tap a menu link) saves it now instead of dropping it.
    return () => { subscription.unsubscribe(); clearTimeout(saveTimer.current); if (pending) saveData(pending); };
  }, [watch, saveData]);

  useEffect(() => {
    const handleBeforeUnload = (e) => { if (isSaving) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isSaving]);

  const nextStep = async () => {
    const isStepValid = await trigger(steps[currentStep].fields);
    if (isStepValid) { setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  };

  const prevStep = () => { setCurrentStep((prev) => Math.max(prev - 1, 0)); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  const onSubmit = async (data) => { clearTimeout(saveTimer.current); const ok = await saveData(data); if (ok) setIsSubmitted(true); };
  // A lift is "known" when a 1RM is typed OR a recent set (weight + reps) is given. Beginners may leave it blank.
  const liftKnown = (l) => { const v = getValues(); return !!num(v[`${l}_1rm`]) || (!!num(v[`${l}_set_w`]) && !!num(v[`${l}_set_r`])); };
  const liftRule = (l) => ({ validate: () => unsureLevel(getValues('progress_rate'), getValues('experience_level')) === 'Beginner' || liftKnown(l) || L('Enter a 1RM or a recent set', '1RM ya koi recent set daalo') });

  if (loadState) return <div className="flex justify-center min-h-[60vh] items-center"><div className="animate-spin h-8 w-8 border-2 border-gray-900 rounded-full border-t-transparent"></div></div>;

  if (isSubmitted) {
    const formData = getValues();
    return (
      <div className="max-w-xl mx-auto px-4 py-20 min-h-[80vh] flex flex-col items-center justify-center text-center">
        <motion.div initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 260, damping: 20 }} className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-8">
          <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
        </motion.div>
        <h1 className="text-3xl font-bold text-gray-900 mb-3">{L('Profile saved', 'Profile save ho gayi')}</h1>
        <p className="text-gray-500 mb-8 max-w-md">{L(`Welcome to the team, ${formData.full_name?.split(' ')[0]}. Your baseline is set — one more step and your block is ready.`, `Team mein swagat hai, ${formData.full_name?.split(' ')[0]}. Aapka baseline set ho gaya — bas ek step aur, phir aapka block ready.`)}</p>
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 w-full mb-8 text-left">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">{L('Profile Summary', 'Profile summary')}</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-gray-500">{L('Experience:', 'Experience:')}</span> <span className="font-medium text-gray-900">{formData.experience_level}</span></div>
            <div><span className="text-gray-500">{L('Days/Week:', 'Din/Hafta:')}</span> <span className="font-medium text-gray-900">{formData.training_days_per_week}</span></div>
            {LIFTS.map(([l, label]) => <div key={l}><span className="text-gray-500">{label}:</span> <span className="font-medium text-gray-900">{num(formData[`${l}_1rm`]) || (e1rm(formData[`${l}_set_w`], formData[`${l}_set_r`]) ? `~${e1rm(formData[`${l}_set_w`], formData[`${l}_set_r`])}` : '—')} kg</span></div>)}
            <div><span className="text-gray-500">{L('Goal:', 'Goal:')}</span> <span className="font-medium text-gray-900">{formData.primary_goal}</span></div>
          </div>
        </div>
        <Link to="/dashboard/generate" className="bg-gray-900 hover:bg-gray-800 text-white px-8 py-3.5 rounded-lg text-sm font-medium transition-colors w-full md:w-auto">{L('Build my block →', 'Mera block banao →')}</Link>
      </div>
    );
  }

  const progress = ((currentStep + 1) / steps.length) * 100;
  const formData = watch();
  const isBeginner = unsureLevel(watch('progress_rate'), watch('experience_level')) === 'Beginner';
  // The engine treats "lifts go up almost every session" as a beginner too.
  const noviceLike = isBeginner || watch('progress_rate') === 'session';
  const hasMeet = watch('competition_status') === 'true';

  return (
    <div className="max-w-2xl mx-auto w-full px-4 pt-5 md:pt-10 min-h-full flex flex-col">
      <div className="mb-8">
        <div className="flex justify-between items-center mb-3">
          <Link to="/dashboard" className="text-xs text-gray-400 hover:text-gray-900">{L('✕ Exit', '✕ Bahar niklo')}</Link>
          <span className="text-xs text-gray-500">
            {isSaving ? <span className="text-gray-400">{L('Saving…', 'Save ho raha hai…')}</span> : saveError ? <span className="text-red-600">{L('Not saved:', 'Save nahi hua:')} {saveError}</span> : <span className="text-green-600">{L('✓ Saved', '✓ Save ho gaya')}</span>}
          </span>
        </div>
        <div className="h-1 w-full bg-gray-100 rounded-full overflow-hidden">
          <motion.div className="h-full rounded-full" style={{ background: 'var(--ll-red)' }} initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.4, ease: 'easeInOut' }} />
        </div>
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mt-2">{L(`Step ${currentStep + 1} of ${steps.length}`, `Step ${currentStep + 1} / ${steps.length}`)} · {L(steps[currentStep].title, steps[currentStep].hi)}</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col">
        <AnimatePresence mode="wait">
          <motion.div key={currentStep} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25, ease: 'easeInOut' }} className="flex-1">
            {currentStep === 0 && (
              <div>
                <Heading title={L("Let's start with the basics.", 'Chalo basics se shuru karte hain.')} sub={L('Your coach-level plan starts with who you are. About 5 minutes; everything saves as you go.', 'Coach-level plan aapko jaan ke banta hai. Bas 5 minute lagenge; sab kuch saath-saath save hota hai.')} />
                <Input label={L('Full name', 'Poora naam')} {...register('full_name', { required: L('Name is required', 'Naam zaroori hai') })} error={errors.full_name} placeholder="Lalit Sharma" />
                <div className="grid grid-cols-3 gap-3">
                  <Input label={L('Age', 'Umar')} type="number" inputMode="numeric" {...register('age', { required: L('Required', 'Zaroori hai'), valueAsNumber: true })} error={errors.age} placeholder="25" />
                  <Input label={L('Height (cm)', 'Height (cm)')} type="number" inputMode="numeric" {...register('height_cm', { required: L('Required', 'Zaroori hai'), valueAsNumber: true })} error={errors.height_cm} placeholder="175" />
                  <Input label={L('Weight (kg)', 'Weight (kg)')} type="number" inputMode="decimal" step="0.1" {...register('bodyweight_kg', { required: L('Required', 'Zaroori hai'), valueAsNumber: true })} error={errors.bodyweight_kg} placeholder="82.5" />
                </div>
                <Choice label={L('Sex', 'Gender')} cols={3} {...register('sex', { required: L('Please pick one', 'Koi ek chuno') })} error={errors.sex}
                  options={[['Male', L('Male', 'Male')], ['Female', L('Female', 'Female')], ['Other', L('Other', 'Other')]]} />
                <Choice label={L('Training experience', 'Training experience')} {...register('experience_level', { required: L('Please pick one', 'Koi ek chuno') })} error={errors.experience_level}
                  hint={L('Rough guide only — the next step asks how fast you progress, which matters more.', 'Bas ek rough idea — agle step mein poochenge aap kitni tezi se progress karte ho, woh zyada matter karta hai.')}
                  options={[['Beginner', 'Beginner', L('0–2 years of real barbell training', '0–2 saal ki asli barbell training')], ['Intermediate', 'Intermediate', L('2–4 years', '2–4 saal')], ['Advanced', 'Advanced', L('4+ years, progress is slow now', '4+ saal, ab progress slow hai')], ['Not sure', L('Not sure', 'Pakka nahi pata'), L('Start safe — the app checks your level from your training data', 'Safe shuru karo — app aapke training data se level check karega')]]} />
              </div>
            )}
            {currentStep === 1 && (
              <div>
                <Heading title={L('What are your current numbers?', 'Aapke abhi ke numbers kya hain?')} sub={L(`Your heaviest single (1RM) if you've tested one. Don't know it? Give a recent heavy set — e.g. 100 kg × 5 — and the engine estimates it, staying a little conservative until you prove it.${isBeginner ? ' Beginners can leave these blank — you get working weights, not percentages.' : ''}`, `Agar test kiya hai to aapka sabse heavy single (1RM). Nahi pata? Koi recent heavy set daalo — jaise 100 kg × 5 — engine estimate kar lega, aur jab tak aap prove nahi karte thoda safe rahega.${isBeginner ? ' Beginners ise khaali chhod sakte hain — aapko percentage nahi, seedha working weights milenge.' : ''}`)} />
                <div className="space-y-3 mb-6">
                  {LIFTS.map(([l, label]) => {
                    const est = !num(watch(`${l}_1rm`)) ? e1rm(watch(`${l}_set_w`), watch(`${l}_set_r`)) : null;
                    return (
                      <div key={l} className="bg-white border border-gray-200 rounded-xl p-4 pb-0">
                        <div className="flex justify-between items-baseline mb-2">
                          <p className="text-sm font-semibold text-gray-900">{label}</p>
                          {est && <p className="text-xs text-gray-500">≈ <b className="text-gray-900">{est} kg</b> 1RM</p>}
                        </div>
                        <div className="grid grid-cols-3 gap-3 items-start">
                          <Input label="1RM (kg)" type="number" inputMode="decimal" step="0.5" {...register(`${l}_1rm`, liftRule(l))} error={errors[`${l}_1rm`]} placeholder={L('tested', 'tested')} />
                          <Input label={L('or set: kg', 'ya set: kg')} type="number" inputMode="decimal" step="0.5" {...register(`${l}_set_w`)} placeholder="100" />
                          <Input label="× reps" type="number" inputMode="numeric" {...register(`${l}_set_r`)} placeholder="5" />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <Choice label={L('Training days per week', 'Hafte mein kitne din training')} cols={4} {...register('training_days_per_week', { required: L('Please pick one', 'Koi ek chuno') })} error={errors.training_days_per_week}
                  hint={L('Pick what you can do every week for months, not your best week. Consistency beats the “perfect” plan.', 'Woh chuno jo aap mahino tak har hafte kar sako, sirf best week nahi. Consistency “perfect” plan se zyada kaam aati hai.')}
                  options={[['3', '3'], ['4', '4'], ['5', '5'], ['6', '6']]} />
                <Choice label={L('How long can one session be?', 'Ek session kitna lamba ho sakta hai?')} cols={2} {...register('session_minutes')}
                  hint={L('Decides how many accessories fit in a day. Main lifts always come first.', 'Isse decide hota hai ek din mein kitni accessories fit hongi. Main lifts hamesha pehle aate hain.')}
                  options={[['', L('No real limit', 'Koi khaas limit nahi')], ['45', '~45 min'], ['60', L('~1 hour', '~1 ghanta')], ['90', L('~1.5 hours', '~1.5 ghante')], ['120', L('2 hours', '2 ghante')]]} />
                <Choice label={L('How much accessory work do you like?', 'Kitna accessory work pasand hai?')} {...register('training_style')}
                  hint={L('Main lifts and their sets are the same in all three — this only changes the extra work around them.', 'Teeno mein main lifts aur unke sets same hain — isse sirf unke aas-paas ka extra kaam badalta hai.')}
                  options={[['focused', 'Focused', L('Main lifts + the essentials · shortest sessions', 'Main lifts + zaroori cheezein · sabse chhote sessions')], ['balanced', L('Balanced (recommended)', 'Balanced (recommended)'), L('3–4 accessories a day, arms & shoulders included', 'Din mein 3–4 accessories, arms aur shoulders bhi')], ['full', 'Full', L('More accessories and pump work · longer sessions', 'Zyada accessories aur pump work · lambe sessions')]]} />
                <Choice label={L('How often do your lifts go up?', 'Aapke lifts kitni jaldi badhte hain?')} {...register('progress_rate')}
                  hint={L('Training age is how fast you progress, not years in the gym. Quick check: can you add 2.5–5 kg to the bar every week without missing reps? Yes → almost every session. Only some weeks → week to week. Still not sure? Pick “Not sure” — your training data will tell.', 'Training age matlab aap kitni tezi se progress karte ho, gym mein kitne saal nahi. Quick check: kya har hafte bar pe 2.5–5 kg badha sakte ho bina reps miss kiye? Haan → almost every session. Sirf kuch hafton mein → week to week. Abhi bhi pakka nahi? “Pakka nahi pata” chuno — aapka training data bata dega.')}
                  options={[['session', L('Almost every session', 'Lagbhag har session'), L('I can still add weight each workout', 'Har workout mein abhi bhi weight badha leta hoon')], ['week', L('Week to week, or every few weeks', 'Hafte-hafte, ya kuch hafton mein'), L('Progress comes block by block', 'Progress block-by-block aata hai')], ['month', L('Only every month or two', 'Sirf mahine-do mahine mein'), L('Even when sleep, food and effort are right', 'Neend, khana aur mehnat sahi hone par bhi')], ['', L('Not sure', 'Pakka nahi pata')]]} />
              </div>
            )}
            {currentStep === 2 && (
              <div>
                <Heading title={L('What are we chasing?', 'Hum kya chase kar rahe hain?')} sub={L('The goal decides the phase: build, strength, or peak for a meet.', 'Goal se phase decide hota hai: build, strength, ya meet ke liye peak.')} />
                <Choice label={L('Primary goal', 'Main goal')} cols={2} {...register('primary_goal', { required: L('Please pick one', 'Koi ek chuno') })} error={errors.primary_goal}
                  options={[['Strength', L('Raw strength', 'Raw strength')], ['Hypertrophy', L('Muscle / size', 'Muscle / size')], ['General Powerlifting', L('General powerlifting', 'General powerlifting')], ['Meet Prep', L('Meet prep', 'Meet prep')]]} />
                <Choice label={L('Any meet coming up?', 'Koi meet aa raha hai?')} cols={2} {...register('competition_status', { required: L('Please pick one', 'Koi ek chuno') })} error={errors.competition_status}
                  options={[['false', L('No meet planned', 'Koi meet plan nahi hai')], ['true', L('Yes, I have a meet', 'Haan, meet hai')]]} />
                {hasMeet && (
                  <div className="border-l-2 pl-4 mb-2" style={{ borderColor: 'var(--ll-line)' }}>
                    <Choice label={L('Do you know the exact date?', 'Exact date pata hai?')} {...register('meet_date_status')}
                      options={[['exact', L('Yes — the date is confirmed', 'Haan — date confirm hai')], ['approx', L('Not yet — only roughly', 'Abhi nahi — bas andaza hai'), L('Enter the EARLIEST likely date below', 'Neeche SABSE PEHLE wali possible date daalo')]]} />
                    <Input label={watch('meet_date_status') === 'approx' ? L('Earliest likely meet date', 'Sabse pehli possible meet date') : L('Meet date', 'Meet ki date')} type="date" {...register('competition_date', { validate: (v) => getValues('competition_status') !== 'true' || !!v || L('Add the date — the earliest likely one is fine', 'Date daalo — sabse pehli possible date bhi chalegi') })} error={errors.competition_date} />
                    {watch('meet_date_status') === 'approx' && <Hint>{L("You get peaked for the earliest date and kept “ready” until it's announced. Update it here the moment you know — the taper is then rebuilt from the real date.", 'Aapko sabse pehli date ke liye peak karwayenge aur announce hone tak “ready” rakhenge. Jaise hi date pata chale, yahan update karo — phir taper asli date se dobara banega.')}</Hint>}
                    <Choice label={L('Which lifts are you competing in?', 'Kaun se lifts mein compete kar rahe ho?')} cols={2} {...register('meet_events')}
                      hint={L('Only the lifts you compete in get peaked and tapered; the others are kept healthy.', 'Sirf competition wale lifts peak aur taper honge; baaki ko healthy rakhenge.')}
                      options={[['full', 'Full power', 'Squat, bench, deadlift'], ['bench', L('Bench only', 'Sirf bench')], ['deadlift', L('Deadlift only', 'Sirf deadlift')], ['pushpull', 'Push-pull', 'Bench + deadlift']]} />
                  </div>
                )}
                <Choice label={L('Are you cutting weight?', 'Weight cut kar rahe ho?')} {...register('cutting')}
                  hint={L('A real cut lowers how much volume you can recover from, so the plan trims it.', 'Asli cut mein aap kam volume se recover kar paate ho, isliye plan volume kam kar deta hai.')}
                  options={[['no', L('No', 'Nahi')], ['mild', L('A little', 'Thoda sa'), L('Slow, easy diet', 'Slow, aasaan diet')], ['weightclass', L('Yes — a real cut', 'Haan — asli cut'), L('To make a weight class', 'Weight class banane ke liye')]]} />
              </div>
            )}
            {currentStep === 3 && (
              <div>
                <Heading title={L('Recovery & life outside the gym.', 'Recovery aur gym ke bahar ki life.')} sub={L('Training is only half the program — recovery decides how much of it you can use. Be honest; volume is set from this.', 'Training sirf aadha program hai — recovery decide karti hai aap usme se kitna use kar paoge. Sach batao; volume isi se set hota hai.')} />
                <Choice label={L('Average sleep', 'Average neend')} cols={3} {...register('sleep_level')}
                  options={[['high', L('7+ hours', '7+ ghante')], ['mid', L('6–7 hours', '6–7 ghante')], ['low', L('Under 6', '6 se kam')]]} />
                <Choice label={L('Life stress right now', 'Abhi life mein stress')} cols={3} {...register('stress_level')}
                  hint={L('Work, study, family — all of it counts against recovery.', 'Kaam, padhai, family — sab recovery pe asar daalta hai.')}
                  options={[['low', L('Low', 'Kam')], ['mid', L('Moderate', 'Thoda')], ['high', L('High', 'Zyada')]]} />
                <Choice label={L('When were your maxes last tested (or hit in training)?', 'Aapke max last kab test hue (ya training mein lage)?')} cols={2} {...register('max_tested')}
                  hint={L('Old or guessed maxes → the plan stays at or below 87.5% until a clean heavy single confirms them.', 'Purane ya andaze wale max → jab tak ek clean heavy single confirm na kare, plan 87.5% ya usse neeche rahega.')}
                  options={[['recent', L('Last month', 'Pichhle mahine')], ['mid', L('1–3 months ago', '1–3 mahine pehle')], ['old', L('3+ months ago', '3+ mahine pehle')], ['never', L('Never — best guess', 'Kabhi nahi — andaza hai')]]} />
                <Input label={L('Other sport or cardio (optional)', 'Koi aur sport ya cardio (optional)')} {...register('other_sport')} placeholder={L('e.g., football twice a week, running 3 km daily', 'jaise, hafte mein 2 baar football, roz 3 km running')} />
              </div>
            )}
            {currentStep === 4 && (
              <div>
                {noviceLike ? (
                  <>
                    <Heading title={L('Your lifts, your style.', 'Aapke lifts, aapka style.')} sub={L('A few quick questions about how you squat and pull.', 'Aap squat aur pull kaise karte ho, uske baare mein kuch quick sawaal.')} />
                    <div className="mb-5 text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <b className="text-gray-900">{L('No weak point needed yet.', 'Abhi weak point ki zaroorat nahi.')}</b> {L('As a beginner every lift is still learning its movement — where it fails is usually technique, not a weak muscle. All three lifts get even work, and each lift shows form cues in the workout. Weak-point work starts once your progress slows.', 'Beginner ho to har lift abhi movement seekh raha hai — jahan fail hota hai woh aksar technique hoti hai, weak muscle nahi. Teeno lifts ko barabar kaam milega, aur workout mein har lift ke form cues dikhenge. Weak-point work tab shuru hoga jab progress slow hogi.')}
                    </div>
                  </>
                ) : (
                  <>
                    <Heading title={L('Where do you break down?', 'Aap kahan fail hote ho?')} sub={L("Weak points pick your variations and accessories. Not sure? Leave “No specific weakness” — that's a fine answer.", 'Weak points se aapke variations aur accessories chune jaate hain. Pakka nahi pata? “Koi khaas weakness nahi” chhod do — woh bhi sahi jawab hai.')} />
                    <Choice label="Squat" {...register('squat_weak_point')}
                      options={[['None', L('No specific weakness', 'Koi khaas weakness nahi')], ['Hole', L('Fails in the hole', 'Hole mein fail hota hai'), L('Bottom of the squat', 'Squat ke bottom pe')], ['Mid-range', L('Stalls mid-range', 'Mid-range mein ruk jaata hai'), L('Just above parallel', 'Parallel se thoda upar')], ['Lockout', L("Can't finish the lockout", 'Lockout poora nahi hota')], ['Core/Collapse', L('Chest drops / hips shoot up', 'Chest gir jaati hai / hips upar bhaagte hain')]]} />
                    <Choice label="Bench" {...register('bench_weak_point')}
                      options={[['None', L('No specific weakness', 'Koi khaas weakness nahi')], ['Chest/Off-chest', L('Off the chest', 'Chest se uthane mein'), L('Bottom of the bench', 'Bench ke bottom pe')], ['Mid-range', L('Stalls mid-range', 'Mid-range mein ruk jaata hai')], ['Lockout', L('Fails at lockout', 'Lockout pe fail hota hai')], ['Unstable', L('Bar path changes every rep', 'Har rep mein bar path badalta hai'), L('Touch point moves around', 'Touch point idhar-udhar hota hai')]]} />
                    <Choice label="Deadlift" {...register('deadlift_weak_point')}
                      options={[['None', L('No specific weakness', 'Koi khaas weakness nahi')], ['Off-floor', L("Can't break the floor", 'Floor se bar nahi uthta')], ['Mid-range', L('Stalls around the knee', 'Knee ke paas ruk jaata hai')], ['Lockout', L("Can't finish the lockout", 'Lockout poora nahi hota')]]} />
                    <Choice label={L('What kind of problem is it?', 'Problem kis type ki hai?')} {...register('weak_type')}
                      hint={L('Technique issue → lighter variations, not more accessories. Fatigue → less volume, not a new exercise.', 'Technique issue → halke variations, zyada accessories nahi. Fatigue → kam volume, naya exercise nahi.')}
                      options={[['strength', 'Strength', L('Form is fine, the bar just slows down when heavy', 'Form theek hai, bas heavy pe bar slow ho jaata hai')], ['technique', 'Technique', L('Form breaks even with light weight', 'Halke weight pe bhi form toot jaata hai')], ['fatigue', 'Fatigue', L('Even warm-ups feel heavy lately', 'Aajkal warm-up bhi heavy lagta hai')]]} />
                  </>
                )}
                <div className="grid grid-cols-2 gap-x-3">
                  <Choice label={L('Squat style', 'Squat style')} {...register('squat_bar')}
                    options={[['high', 'High-bar'], ['low', 'Low-bar'], ['', L('Not sure', 'Pakka nahi pata')]]} />
                  <Choice label={L('Deadlift style', 'Deadlift style')} {...register('deadlift_stance')}
                    options={[['conventional', 'Conventional'], ['sumo', 'Sumo'], ['', L('Not sure', 'Pakka nahi pata')]]} />
                </div>
                <Choice label={L('Do you know RPE?', 'RPE pata hai?')} cols={2} {...register('rpe_experience')}
                  hint={L('RPE = how hard a set felt (10 = nothing left). The plan uses it either way and explains it as you go.', 'RPE = set kitna tough laga (10 = kuch nahi bacha). Plan dono case mein ise use karta hai aur saath-saath samjhata hai.')}
                  options={[['true', L('Yes, I use it', 'Haan, use karta hoon')], ['false', L('No, explain it', 'Nahi, samjhao')]]} />
              </div>
            )}
            {currentStep === 5 && (
              <div>
                <Heading title={L('Any pain or limits?', 'Koi dard ya limit?')} sub={L('Pain changes exercise choice, never your effort. Write it plainly — e.g. “right shoulder hurts at the bottom of bench”.', 'Dard se exercise badalti hai, aapki mehnat nahi. Seedha likho — jaise “bench ke bottom pe right shoulder dukhta hai”.')} />
                <TextArea label={L('Current injuries or pain (optional)', 'Abhi koi injury ya dard (optional)')} {...register('current_injuries')} placeholder={L('e.g., Lower back tightness, right shoulder impingement…', 'jaise, lower back tight hai, right shoulder impingement…')} />
                <TextArea label={L("Exercises you can't or won't do (optional)", 'Jo exercises aap nahi kar sakte ya nahi karoge (optional)')} {...register('restricted_exercises')} placeholder={L('e.g., No barbell bench press due to shoulder…', 'jaise, shoulder ki wajah se barbell bench press nahi…')} />
                <Choice label={L('Gym setup', 'Gym setup')} {...register('equipment_level')}
                  hint={L('Accessories are picked from what your gym actually has.', 'Accessories wahi chune jaayenge jo aapke gym mein sach mein hai.')}
                  options={[['commercial', 'Commercial gym', L('Machines, cables, dumbbells — everything', 'Machines, cables, dumbbells — sab kuch')], ['basic', 'Basic gym', L('Barbell, rack, bench, dumbbells, pull-up bar', 'Barbell, rack, bench, dumbbells, pull-up bar')], ['minimal', 'Minimal', L('Barbell, rack, bench and plates only', 'Sirf barbell, rack, bench aur plates')]]} />
                <TextArea label={L('Anything else about equipment? (optional)', 'Equipment ke baare mein aur kuch? (optional)')} {...register('available_equipment')} placeholder={L('e.g., no leg press, have bands and a belt…', 'jaise, leg press nahi hai, bands aur belt hai…')} />
                <TextArea label={L('Note for your coach (optional)', 'Coach ke liye note (optional)')} {...register('coach_notes')} placeholder={L('Anything else I should know?', 'Aur kuch jo mujhe pata hona chahiye?')} />
              </div>
            )}
            {currentStep === 6 && (
              <div>
                <Heading title={L('Check and confirm.', 'Check karke confirm karo.')} sub={L("Tap Edit on anything that's wrong. You can change all of this later from Account.", 'Jo galat hai uspe Edit dabao. Yeh sab baad mein Account se bhi badal sakte ho.')} />
                <div className="space-y-3">
                  <ReviewSection title={L('You', 'Aap')} onEdit={() => setCurrentStep(0)}>
                    <ReviewItem label={L('Name', 'Naam')} value={formData.full_name} />
                    <ReviewItem label={L('Age / Sex', 'Umar / Gender')} value={`${formData.age || '—'} / ${formData.sex || '—'}`} />
                    <ReviewItem label={L('Weight / Height', 'Weight / Height')} value={`${formData.bodyweight_kg || '—'} kg / ${formData.height_cm || '—'} cm`} />
                    <ReviewItem label={L('Experience', 'Experience')} value={formData.experience_level} />
                  </ReviewSection>
                  <ReviewSection title={L('Strength & schedule', 'Strength aur schedule')} onEdit={() => setCurrentStep(1)}>
                    <ReviewItem label="Squat / Bench / Deadlift" value={LIFTS.map(([l]) => num(formData[`${l}_1rm`]) || (e1rm(formData[`${l}_set_w`], formData[`${l}_set_r`]) ? `~${e1rm(formData[`${l}_set_w`], formData[`${l}_set_r`])}` : '—')).join(' / ') + ' kg'} />
                    <ReviewItem label={L('Days per week', 'Hafte mein din')} value={formData.training_days_per_week} />
                    <ReviewItem label={L('Session length', 'Session ki length')} value={formData.session_minutes ? `${formData.session_minutes} min` : L('No limit', 'Koi limit nahi')} />
                    <ReviewItem label={L('Accessory work', 'Accessory work')} value={{ focused: 'Focused', balanced: 'Balanced', full: 'Full' }[formData.training_style] || 'Balanced'} />
                    <ReviewItem label={L('Progress speed', 'Progress ki speed')} value={{ session: L('Every session', 'Har session'), week: L('Weekly / per block', 'Har hafte / har block'), month: L('Monthly or slower', 'Mahine mein ya usse slow') }[formData.progress_rate] || L('Not sure', 'Pakka nahi pata')} />
                  </ReviewSection>
                  <ReviewSection title={L('Goal', 'Goal')} onEdit={() => setCurrentStep(2)}>
                    <ReviewItem label={L('Primary goal', 'Main goal')} value={formData.primary_goal} />
                    <ReviewItem label="Meet" value={hasMeet ? (formData.competition_date ? `${parseYmd(formData.competition_date).toLocaleDateString()}${formData.meet_date_status === 'approx' ? L(' (approx.)', ' (lagbhag)') : ''}` : L('Date missing', 'Date nahi daali')) : L('None', 'Koi nahi')} />
                    {hasMeet && <ReviewItem label="Events" value={{ full: 'Full power', bench: L('Bench only', 'Sirf bench'), deadlift: L('Deadlift only', 'Sirf deadlift'), pushpull: 'Push-pull' }[formData.meet_events || 'full']} />}
                    <ReviewItem label={L('Cutting', 'Cutting')} value={{ no: L('No', 'Nahi'), mild: L('Mild', 'Thoda'), weightclass: L('Weight-class cut', 'Weight-class cut') }[formData.cutting || 'no']} />
                  </ReviewSection>
                  <ReviewSection title={L('Recovery', 'Recovery')} onEdit={() => setCurrentStep(3)}>
                    <ReviewItem label={L('Sleep', 'Neend')} value={{ high: '7+ h', mid: '6–7 h', low: '< 6 h' }[formData.sleep_level] || '—'} />
                    <ReviewItem label="Stress" value={{ low: L('Low', 'Kam'), mid: L('Moderate', 'Thoda'), high: L('High', 'Zyada') }[formData.stress_level] || '—'} />
                    <ReviewItem label={L('Maxes tested', 'Max kab test hue')} value={{ recent: L('< 1 month', '< 1 mahina'), mid: L('1–3 months', '1–3 mahine'), old: L('3+ months', '3+ mahine'), never: L('Never (guess)', 'Kabhi nahi (andaza)') }[formData.max_tested] || '—'} />
                    <ReviewItem label={L('Other sport', 'Doosra sport')} value={formData.other_sport || L('None', 'Koi nahi')} />
                  </ReviewSection>
                  <ReviewSection title={L('Weak points', 'Weak points')} onEdit={() => setCurrentStep(4)}>
                    <ReviewItem label="Squat" value={formData.squat_weak_point} />
                    <ReviewItem label="Bench" value={formData.bench_weak_point} />
                    <ReviewItem label="Deadlift" value={formData.deadlift_weak_point} />
                    <ReviewItem label={L('Type', 'Type')} value={{ strength: 'Strength', technique: 'Technique', fatigue: 'Fatigue' }[formData.weak_type] || '—'} />
                  </ReviewSection>
                  <ReviewSection title={L('Limits & gym', 'Limits aur gym')} onEdit={() => setCurrentStep(5)}>
                    <ReviewItem label={L('Injuries', 'Injuries')} value={formData.current_injuries || L('None', 'Koi nahi')} />
                    <ReviewItem label={L('Gym setup', 'Gym setup')} value={{ commercial: 'Commercial', basic: 'Basic', minimal: 'Minimal' }[formData.equipment_level || 'commercial']} />
                  </ReviewSection>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Sticky on phones so Continue is always under the thumb */}
        <div className="sticky bottom-0 -mx-4 px-4 mt-8 py-3 bg-gray-50 border-t border-gray-200 flex gap-3" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))' }}>
          {currentStep > 0 && <button type="button" onClick={prevStep} className="px-5 py-3 rounded-lg text-sm font-medium text-gray-700 border border-gray-200 hover:bg-gray-100">{L('Back', 'Peeche')}</button>}
          {currentStep < steps.length - 1
            ? <button type="button" onClick={nextStep} className="flex-1 bg-gray-900 text-white py-3 rounded-lg text-sm font-semibold">{L('Continue', 'Aage')}</button>
            : <button type="submit" className="flex-1 bg-gray-900 text-white py-3 rounded-lg text-sm font-semibold">{L('Save profile', 'Profile save karo')}</button>}
        </div>
      </form>
    </div>
  );
}

const Heading = ({ title, sub }) => (
  <div className="mb-6">
    <h1 className="text-2xl font-bold text-gray-900 mb-1.5">{title}</h1>
    {sub && <p className="text-sm text-gray-500 leading-relaxed">{sub}</p>}
  </div>
);

const ReviewSection = ({ title, children, onEdit }) => {
  const { L } = useLang();
  return (
  <div className="bg-white border border-gray-200 rounded-xl p-4">
    <div className="flex justify-between items-center mb-3">
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      <button type="button" onClick={onEdit} className="text-xs text-blue-600 hover:underline font-medium">{L('Edit', 'Edit karo')}</button>
    </div>
    <div className="grid grid-cols-2 gap-3">{children}</div>
  </div>
  );
};

const ReviewItem = ({ label, value }) => (
  <div>
    <p className="text-xs text-gray-500 mb-0.5">{label}</p>
    <p className="text-sm font-medium text-gray-900">{value || '—'}</p>
  </div>
);
