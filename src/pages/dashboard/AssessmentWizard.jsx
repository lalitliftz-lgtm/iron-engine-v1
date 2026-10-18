import { useState, useEffect, useCallback, useRef } from 'react';
import { epley, round25 } from '../../lib/engine';
import { useForm } from 'react-hook-form';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { Input, TextArea, Choice, Hint } from '../../components/ui/FormControls';
import { useNavigate, Link } from 'react-router-dom';
import { parseYmd } from '../../lib/schedule';

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
  { id: 'basics', title: 'Basic Info', fields: ['full_name', 'age', 'sex', 'height_cm', 'bodyweight_kg', 'experience_level'] },
  { id: 'strength', title: 'Strength Metrics', fields: ['squat_1rm', 'bench_1rm', 'deadlift_1rm', 'training_days_per_week', 'session_minutes', 'training_style', 'progress_rate', 'squat_set_w', 'squat_set_r', 'bench_set_w', 'bench_set_r', 'deadlift_set_w', 'deadlift_set_r'] },
  { id: 'goals', title: 'Goals & Competition', fields: ['primary_goal', 'competition_status', 'competition_date', 'meet_date_status', 'meet_events', 'cutting'] },
  { id: 'recovery', title: 'Recovery & Life', fields: ['sleep_level', 'stress_level', 'max_tested', 'other_sport'] },
  { id: 'diagnostics', title: 'Diagnostics', fields: ['squat_weak_point', 'bench_weak_point', 'deadlift_weak_point', 'squat_bar', 'deadlift_stance', 'rpe_experience'] },
  { id: 'constraints', title: 'Constraints & Equipment', fields: ['current_injuries', 'equipment_level', 'available_equipment', 'restricted_exercises', 'coach_notes'] },
  { id: 'review', title: 'Review', fields: [] }
];

/** The level a "Not sure" answer is saved as: whatever "how fast do your lifts go up" implies, else Beginner (safe start). */
function unsureLevel(progressRate, level = 'Not sure') {
  if (level !== 'Not sure') return level;
  return { week: 'Intermediate', month: 'Advanced' }[progressRate] || 'Beginner';
}

export default function AssessmentWizard() {
  const { user } = useAuth();
  const navigate = useNavigate();
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
    const subscription = watch((value) => {
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => saveData(value), 1500);
    });
    return () => { subscription.unsubscribe(); clearTimeout(saveTimer.current); };
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
  const liftRule = (l) => ({ validate: () => unsureLevel(getValues('progress_rate'), getValues('experience_level')) === 'Beginner' || liftKnown(l) || 'Enter a 1RM or a recent set' });

  if (loadState) return <div className="flex justify-center min-h-[60vh] items-center"><div className="animate-spin h-8 w-8 border-2 border-gray-900 rounded-full border-t-transparent"></div></div>;

  if (isSubmitted) {
    const formData = getValues();
    return (
      <div className="max-w-xl mx-auto px-4 py-20 min-h-[80vh] flex flex-col items-center justify-center text-center">
        <motion.div initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 260, damping: 20 }} className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-8">
          <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
        </motion.div>
        <h1 className="text-3xl font-bold text-gray-900 mb-3">Profile saved</h1>
        <p className="text-gray-500 mb-8 max-w-md">Welcome to the team, {formData.full_name?.split(' ')[0]}. Your baseline is set — one more step and your block is ready.</p>
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 w-full mb-8 text-left">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Profile Summary</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-gray-500">Experience:</span> <span className="font-medium text-gray-900">{formData.experience_level}</span></div>
            <div><span className="text-gray-500">Days/Week:</span> <span className="font-medium text-gray-900">{formData.training_days_per_week}</span></div>
            {LIFTS.map(([l, label]) => <div key={l}><span className="text-gray-500">{label}:</span> <span className="font-medium text-gray-900">{num(formData[`${l}_1rm`]) || (e1rm(formData[`${l}_set_w`], formData[`${l}_set_r`]) ? `~${e1rm(formData[`${l}_set_w`], formData[`${l}_set_r`])}` : '—')} kg</span></div>)}
            <div><span className="text-gray-500">Goal:</span> <span className="font-medium text-gray-900">{formData.primary_goal}</span></div>
          </div>
        </div>
        <Link to="/dashboard/generate" className="bg-gray-900 hover:bg-gray-800 text-white px-8 py-3.5 rounded-lg text-sm font-medium transition-colors w-full md:w-auto">Build my block →</Link>
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
          <Link to="/dashboard" className="text-xs text-gray-400 hover:text-gray-900">✕ Exit</Link>
          <span className="text-xs text-gray-500">
            {isSaving ? <span className="text-gray-400">Saving…</span> : saveError ? <span className="text-red-600">Not saved: {saveError}</span> : <span className="text-green-600">✓ Saved</span>}
          </span>
        </div>
        <div className="h-1 w-full bg-gray-100 rounded-full overflow-hidden">
          <motion.div className="h-full rounded-full" style={{ background: 'var(--ll-red)' }} initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.4, ease: 'easeInOut' }} />
        </div>
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mt-2">Step {currentStep + 1} of {steps.length} · {steps[currentStep].title}</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col">
        <AnimatePresence mode="wait">
          <motion.div key={currentStep} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25, ease: 'easeInOut' }} className="flex-1">
            {currentStep === 0 && (
              <div>
                <Heading title="Let's start with the basics." sub="Your coach-level plan starts with who you are. Takes about 3 minutes; everything saves as you go." />
                <Input label="Full name" {...register('full_name', { required: 'Name is required' })} error={errors.full_name} placeholder="Lalit Sharma" />
                <div className="grid grid-cols-3 gap-3">
                  <Input label="Age" type="number" inputMode="numeric" {...register('age', { required: 'Required', valueAsNumber: true })} error={errors.age} placeholder="25" />
                  <Input label="Height (cm)" type="number" inputMode="numeric" {...register('height_cm', { required: 'Required', valueAsNumber: true })} error={errors.height_cm} placeholder="175" />
                  <Input label="Weight (kg)" type="number" inputMode="decimal" step="0.1" {...register('bodyweight_kg', { required: 'Required', valueAsNumber: true })} error={errors.bodyweight_kg} placeholder="82.5" />
                </div>
                <Choice label="Sex" cols={3} {...register('sex', { required: 'Please pick one' })} error={errors.sex}
                  options={[['Male', 'Male'], ['Female', 'Female'], ['Other', 'Other']]} />
                <Choice label="Training experience" {...register('experience_level', { required: 'Please pick one' })} error={errors.experience_level}
                  hint="Rough guide only — the next step asks how fast you progress, which matters more."
                  options={[['Beginner', 'Beginner', '0–2 years of real barbell training'], ['Intermediate', 'Intermediate', '2–4 years'], ['Advanced', 'Advanced', '4+ years, progress is slow now'], ['Not sure', 'Not sure', 'Start safe — the app checks your level from your training data']]} />
              </div>
            )}
            {currentStep === 1 && (
              <div>
                <Heading title="What are your current numbers?" sub={`Your heaviest single (1RM) if you've tested one. Don't know it? Give a recent heavy set — e.g. 100 kg × 5 — and the engine estimates it, staying a little conservative until you prove it.${isBeginner ? ' Beginners can leave these blank — you get working weights, not percentages.' : ''}`} />
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
                          <Input label="1RM (kg)" type="number" inputMode="decimal" step="0.5" {...register(`${l}_1rm`, liftRule(l))} error={errors[`${l}_1rm`]} placeholder="tested" />
                          <Input label="or set: kg" type="number" inputMode="decimal" step="0.5" {...register(`${l}_set_w`)} placeholder="100" />
                          <Input label="× reps" type="number" inputMode="numeric" {...register(`${l}_set_r`)} placeholder="5" />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <Choice label="Training days per week" cols={4} {...register('training_days_per_week', { required: 'Please pick one' })} error={errors.training_days_per_week}
                  hint="Pick what you can do every week for months, not your best week. Consistency beats the “perfect” plan."
                  options={[['3', '3'], ['4', '4'], ['5', '5'], ['6', '6']]} />
                <Choice label="How long can one session be?" cols={2} {...register('session_minutes')}
                  hint="Decides how many accessories fit in a day. Main lifts always come first."
                  options={[['', 'No real limit'], ['45', '~45 min'], ['60', '~1 hour'], ['90', '~1.5 hours'], ['120', '2 hours']]} />
                <Choice label="How much accessory work do you like?" {...register('training_style')}
                  hint="Main lifts and their sets are the same in all three — this only changes the extra work around them."
                  options={[['focused', 'Focused', 'Main lifts + the essentials · shortest sessions'], ['balanced', 'Balanced (recommended)', '3–4 accessories a day, arms & shoulders included'], ['full', 'Full', 'More accessories and pump work · longer sessions']]} />
                <Choice label="How often do your lifts go up?" {...register('progress_rate')}
                  hint="Training age is how fast you progress, not years in the gym. Quick check: can you add 2.5–5 kg to the bar every week without missing reps? Yes → almost every session. Only some weeks → week to week. Still not sure? Pick “Not sure” — your training data will tell."
                  options={[['session', 'Almost every session', 'I can still add weight each workout'], ['week', 'Week to week, or every few weeks', 'Progress comes block by block'], ['month', 'Only every month or two', 'Even when sleep, food and effort are right'], ['', 'Not sure']]} />
              </div>
            )}
            {currentStep === 2 && (
              <div>
                <Heading title="What are we chasing?" sub="The goal decides the phase: build, strength, or peak for a meet." />
                <Choice label="Primary goal" cols={2} {...register('primary_goal', { required: 'Please pick one' })} error={errors.primary_goal}
                  options={[['Strength', 'Raw strength'], ['Hypertrophy', 'Muscle / size'], ['General Powerlifting', 'General powerlifting'], ['Meet Prep', 'Meet prep']]} />
                <Choice label="Any meet coming up?" cols={2} {...register('competition_status', { required: 'Please pick one' })} error={errors.competition_status}
                  options={[['false', 'No meet planned'], ['true', 'Yes, I have a meet']]} />
                {hasMeet && (
                  <div className="border-l-2 pl-4 mb-2" style={{ borderColor: 'var(--ll-line)' }}>
                    <Choice label="Do you know the exact date?" {...register('meet_date_status')}
                      options={[['exact', 'Yes — the date is confirmed'], ['approx', 'Not yet — only roughly', 'Enter the EARLIEST likely date below']]} />
                    <Input label={watch('meet_date_status') === 'approx' ? 'Earliest likely meet date' : 'Meet date'} type="date" {...register('competition_date', { validate: (v) => getValues('competition_status') !== 'true' || !!v || 'Add the date — the earliest likely one is fine' })} error={errors.competition_date} />
                    {watch('meet_date_status') === 'approx' && <Hint>You get peaked for the earliest date and kept “ready” until it's announced. Update it here the moment you know — the taper is then rebuilt from the real date.</Hint>}
                    <Choice label="Which lifts are you competing in?" cols={2} {...register('meet_events')}
                      hint="Only the lifts you compete in get peaked and tapered; the others are kept healthy."
                      options={[['full', 'Full power', 'Squat, bench, deadlift'], ['bench', 'Bench only'], ['deadlift', 'Deadlift only'], ['pushpull', 'Push-pull', 'Bench + deadlift']]} />
                  </div>
                )}
                <Choice label="Are you cutting weight?" {...register('cutting')}
                  hint="A real cut lowers how much volume you can recover from, so the plan trims it."
                  options={[['no', 'No'], ['mild', 'A little', 'Slow, easy diet'], ['weightclass', 'Yes — a real cut', 'To make a weight class']]} />
              </div>
            )}
            {currentStep === 3 && (
              <div>
                <Heading title="Recovery & life outside the gym." sub="Training is only half the program — recovery decides how much of it you can use. Be honest; volume is set from this." />
                <Choice label="Average sleep" cols={3} {...register('sleep_level')}
                  options={[['high', '7+ hours'], ['mid', '6–7 hours'], ['low', 'Under 6']]} />
                <Choice label="Life stress right now" cols={3} {...register('stress_level')}
                  hint="Work, study, family — all of it counts against recovery."
                  options={[['low', 'Low'], ['mid', 'Moderate'], ['high', 'High']]} />
                <Choice label="When were your maxes last tested (or hit in training)?" cols={2} {...register('max_tested')}
                  hint="Old or guessed maxes → the plan stays at or below 87.5% until a clean heavy single confirms them."
                  options={[['recent', 'Last month'], ['mid', '1–3 months ago'], ['old', '3+ months ago'], ['never', 'Never — best guess']]} />
                <Input label="Other sport or cardio (optional)" {...register('other_sport')} placeholder="e.g., football twice a week, running 3 km daily" />
              </div>
            )}
            {currentStep === 4 && (
              <div>
                {noviceLike ? (
                  <>
                    <Heading title="Your lifts, your style." sub="A few quick questions about how you squat and pull." />
                    <div className="mb-5 text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <b className="text-gray-900">No weak point needed yet.</b> As a beginner every lift is still learning its movement — where it fails is usually technique, not a weak muscle. All three lifts get even work, and each lift shows form cues in the workout. Weak-point work starts once your progress slows.
                    </div>
                  </>
                ) : (
                  <>
                    <Heading title="Where do you break down?" sub="Weak points pick your variations and accessories. Not sure? Leave “No specific weakness” — that's a fine answer." />
                    <Choice label="Squat" {...register('squat_weak_point')}
                      options={[['None', 'No specific weakness'], ['Hole', 'Fails in the hole', 'Bottom of the squat'], ['Mid-range', 'Stalls mid-range', 'Just above parallel'], ['Lockout', "Can't finish the lockout"], ['Core/Collapse', 'Chest drops / hips shoot up']]} />
                    <Choice label="Bench" {...register('bench_weak_point')}
                      options={[['None', 'No specific weakness'], ['Chest/Off-chest', 'Off the chest', 'Bottom of the bench'], ['Mid-range', 'Stalls mid-range'], ['Lockout', 'Fails at lockout'], ['Unstable', 'Bar path changes every rep', 'Touch point moves around']]} />
                    <Choice label="Deadlift" {...register('deadlift_weak_point')}
                      options={[['None', 'No specific weakness'], ['Off-floor', "Can't break the floor"], ['Mid-range', 'Stalls around the knee'], ['Lockout', "Can't finish the lockout"]]} />
                    <Choice label="What kind of problem is it?" {...register('weak_type')}
                      hint="Technique issue → lighter variations, not more accessories. Fatigue → less volume, not a new exercise."
                      options={[['strength', 'Strength', 'Form is fine, the bar just slows down when heavy'], ['technique', 'Technique', 'Form breaks even with light weight'], ['fatigue', 'Fatigue', 'Even warm-ups feel heavy lately']]} />
                  </>
                )}
                <div className="grid grid-cols-2 gap-x-3">
                  <Choice label="Squat style" {...register('squat_bar')}
                    options={[['high', 'High-bar'], ['low', 'Low-bar'], ['', 'Not sure']]} />
                  <Choice label="Deadlift style" {...register('deadlift_stance')}
                    options={[['conventional', 'Conventional'], ['sumo', 'Sumo'], ['', 'Not sure']]} />
                </div>
                <Choice label="Do you know RPE?" cols={2} {...register('rpe_experience')}
                  hint="RPE = how hard a set felt (10 = nothing left). The plan uses it either way and explains it as you go."
                  options={[['true', 'Yes, I use it'], ['false', 'No, explain it']]} />
              </div>
            )}
            {currentStep === 5 && (
              <div>
                <Heading title="Any pain or limits?" sub="Pain changes exercise choice, never your effort. Write it plainly — e.g. “right shoulder hurts at the bottom of bench”." />
                <TextArea label="Current injuries or pain (optional)" {...register('current_injuries')} placeholder="e.g., Lower back tightness, right shoulder impingement…" />
                <TextArea label="Exercises you can't or won't do (optional)" {...register('restricted_exercises')} placeholder="e.g., No barbell bench press due to shoulder…" />
                <Choice label="Gym setup" {...register('equipment_level')}
                  hint="Accessories are picked from what your gym actually has."
                  options={[['commercial', 'Commercial gym', 'Machines, cables, dumbbells — everything'], ['basic', 'Basic gym', 'Barbell, rack, bench, dumbbells, pull-up bar'], ['minimal', 'Minimal', 'Barbell, rack, bench and plates only']]} />
                <TextArea label="Anything else about equipment? (optional)" {...register('available_equipment')} placeholder="e.g., no leg press, have bands and a belt…" />
                <TextArea label="Note for your coach (optional)" {...register('coach_notes')} placeholder="Anything else I should know?" />
              </div>
            )}
            {currentStep === 6 && (
              <div>
                <Heading title="Check and confirm." sub="Tap Edit on anything that's wrong. You can change all of this later from Account." />
                <div className="space-y-3">
                  <ReviewSection title="You" onEdit={() => setCurrentStep(0)}>
                    <ReviewItem label="Name" value={formData.full_name} />
                    <ReviewItem label="Age / Sex" value={`${formData.age || '—'} / ${formData.sex || '—'}`} />
                    <ReviewItem label="Weight / Height" value={`${formData.bodyweight_kg || '—'} kg / ${formData.height_cm || '—'} cm`} />
                    <ReviewItem label="Experience" value={formData.experience_level} />
                  </ReviewSection>
                  <ReviewSection title="Strength & schedule" onEdit={() => setCurrentStep(1)}>
                    <ReviewItem label="Squat / Bench / Deadlift" value={LIFTS.map(([l]) => num(formData[`${l}_1rm`]) || (e1rm(formData[`${l}_set_w`], formData[`${l}_set_r`]) ? `~${e1rm(formData[`${l}_set_w`], formData[`${l}_set_r`])}` : '—')).join(' / ') + ' kg'} />
                    <ReviewItem label="Days per week" value={formData.training_days_per_week} />
                    <ReviewItem label="Session length" value={formData.session_minutes ? `${formData.session_minutes} min` : 'No limit'} />
                    <ReviewItem label="Accessory work" value={{ focused: 'Focused', balanced: 'Balanced', full: 'Full' }[formData.training_style] || 'Balanced'} />
                    <ReviewItem label="Progress speed" value={{ session: 'Every session', week: 'Weekly / per block', month: 'Monthly or slower' }[formData.progress_rate] || 'Not sure'} />
                  </ReviewSection>
                  <ReviewSection title="Goal" onEdit={() => setCurrentStep(2)}>
                    <ReviewItem label="Primary goal" value={formData.primary_goal} />
                    <ReviewItem label="Meet" value={hasMeet ? (formData.competition_date ? `${parseYmd(formData.competition_date).toLocaleDateString()}${formData.meet_date_status === 'approx' ? ' (approx.)' : ''}` : 'Date missing') : 'None'} />
                    {hasMeet && <ReviewItem label="Events" value={{ full: 'Full power', bench: 'Bench only', deadlift: 'Deadlift only', pushpull: 'Push-pull' }[formData.meet_events || 'full']} />}
                    <ReviewItem label="Cutting" value={{ no: 'No', mild: 'Mild', weightclass: 'Weight-class cut' }[formData.cutting || 'no']} />
                  </ReviewSection>
                  <ReviewSection title="Recovery" onEdit={() => setCurrentStep(3)}>
                    <ReviewItem label="Sleep" value={{ high: '7+ h', mid: '6–7 h', low: '< 6 h' }[formData.sleep_level] || '—'} />
                    <ReviewItem label="Stress" value={{ low: 'Low', mid: 'Moderate', high: 'High' }[formData.stress_level] || '—'} />
                    <ReviewItem label="Maxes tested" value={{ recent: '< 1 month', mid: '1–3 months', old: '3+ months', never: 'Never (guess)' }[formData.max_tested] || '—'} />
                    <ReviewItem label="Other sport" value={formData.other_sport || 'None'} />
                  </ReviewSection>
                  <ReviewSection title="Weak points" onEdit={() => setCurrentStep(4)}>
                    <ReviewItem label="Squat" value={formData.squat_weak_point} />
                    <ReviewItem label="Bench" value={formData.bench_weak_point} />
                    <ReviewItem label="Deadlift" value={formData.deadlift_weak_point} />
                    <ReviewItem label="Type" value={{ strength: 'Strength', technique: 'Technique', fatigue: 'Fatigue' }[formData.weak_type] || '—'} />
                  </ReviewSection>
                  <ReviewSection title="Limits & gym" onEdit={() => setCurrentStep(5)}>
                    <ReviewItem label="Injuries" value={formData.current_injuries || 'None'} />
                    <ReviewItem label="Gym setup" value={{ commercial: 'Commercial', basic: 'Basic', minimal: 'Minimal' }[formData.equipment_level || 'commercial']} />
                  </ReviewSection>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Sticky on phones so Continue is always under the thumb */}
        <div className="sticky bottom-0 -mx-4 px-4 mt-8 py-3 bg-gray-50 border-t border-gray-200 flex gap-3" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))' }}>
          {currentStep > 0 && <button type="button" onClick={prevStep} className="px-5 py-3 rounded-lg text-sm font-medium text-gray-700 border border-gray-200 hover:bg-gray-100">Back</button>}
          {currentStep < steps.length - 1
            ? <button type="button" onClick={nextStep} className="flex-1 bg-gray-900 text-white py-3 rounded-lg text-sm font-semibold">Continue</button>
            : <button type="submit" className="flex-1 bg-gray-900 text-white py-3 rounded-lg text-sm font-semibold">Save profile</button>}
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

const ReviewSection = ({ title, children, onEdit }) => (
  <div className="bg-white border border-gray-200 rounded-xl p-4">
    <div className="flex justify-between items-center mb-3">
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      <button type="button" onClick={onEdit} className="text-xs text-blue-600 hover:underline font-medium">Edit</button>
    </div>
    <div className="grid grid-cols-2 gap-3">{children}</div>
  </div>
);

const ReviewItem = ({ label, value }) => (
  <div>
    <p className="text-xs text-gray-500 mb-0.5">{label}</p>
    <p className="text-sm font-medium text-gray-900">{value || '—'}</p>
  </div>
);
