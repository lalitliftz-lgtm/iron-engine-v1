import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { platesPerSide } from '../../lib/engine';
import { applyAdjustments } from '../../lib/autoreg';
import { readDraft, saveDraft, clearDraft } from '../../lib/workoutDraft';
import { motion, AnimatePresence } from 'framer-motion';

const MAIN_REST = 180; // System 2.0: main lifts 3–5 min
const ACC_REST = 90;
const RPE_OPTIONS = ['6', '7', '7.5', '8', '8.5', '9', '9.5', '10'];

const newSets = (ex) => Array.from({ length: Number(ex.sets) || 1 }, () => ({
  weight: ex.weight ? String(ex.weight) : '',
  reps: /^\d+$/.test(String(ex.reps)) ? String(ex.reps) : '',
  rpe: '',
  pain: false,
  completed: false,
}));

export default function WorkoutSession() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const week = parseInt(searchParams.get('week')) || 1;
  const day = parseInt(searchParams.get('day')) || 1;

  const [program, setProgram] = useState(null);
  const [dayData, setDayData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exercises, setExercises] = useState([]);
  const [notes, setNotes] = useState('');
  const [elapsedTime, setElapsedTime] = useState(0);
  const [restTimer, setRestTimer] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [isWorkoutComplete, setIsWorkoutComplete] = useState(false);
  const [summary, setSummary] = useState(null);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [resumed, setResumed] = useState(false);

  useEffect(() => {
    // Clock runs from the real start time, so it stays right after leaving and coming back.
    const tick = () => setElapsedTime(Math.max(0, Math.round((Date.now() - startedAt) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [startedAt]);

  useEffect(() => {
    if (restTimer === null || restTimer <= 0) return;
    const interval = setInterval(() => setRestTimer((prev) => (prev <= 1 ? null : prev - 1)), 1000);
    return () => clearInterval(interval);
  }, [restTimer]);

  useEffect(() => {
    const fetchProgram = async () => {
      const { data } = await supabase.from('generated_programs').select('id, program_snapshot').eq('user_id', user.id).eq('is_active', true).order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (data) {
        setProgram(data);
        const snap = applyAdjustments(data.program_snapshot, data.program_snapshot.adjustments);
        const wData = snap.weeks.find((w) => w.week === week);
        const dData = wData?.days.find((d) => d.day === day);
        if (dData) {
          setDayData(dData);
          const draft = readDraft(user.id);
          if (draft && draft.programId === data.id && draft.week === week && draft.day === day && draft.exercises?.length) {
            setExercises(draft.exercises);
            setNotes(draft.notes || '');
            setStartedAt(draft.startedAt);
            setResumed(true);
          } else {
            setExercises(dData.exercises.map((ex) => ({ ...ex, loggedSets: newSets(ex), skipped: false })));
          }
        }
      }
      setLoading(false);
    };
    fetchProgram();
  }, [user, week, day]);

  // Keep the in-progress session in this browser on every change.
  useEffect(() => {
    if (!program || !exercises.length || isWorkoutComplete) return;
    saveDraft(user.id, { programId: program.id, week, day, focus: dayData?.focus || '', exercises, notes, startedAt });
  }, [user.id, program, week, day, dayData, exercises, notes, startedAt, isWorkoutComplete]);

  const formatTime = (seconds) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;

  const updateSet = (exIdx, setIdx, patch) => {
    setExercises((prev) => prev.map((ex, i) => i !== exIdx ? ex : { ...ex, loggedSets: ex.loggedSets.map((s, j) => (j === setIdx ? { ...s, ...patch } : s)) }));
  };
  const toggleSetComplete = (exIdx, setIdx) => {
    const ex = exercises[exIdx];
    const nowComplete = !ex.loggedSets[setIdx].completed;
    updateSet(exIdx, setIdx, { completed: nowComplete });
    if (nowComplete) setRestTimer(ex.type === 'Main' ? MAIN_REST : ACC_REST);
  };
  const skipExercise = (exIdx) => setExercises((prev) => prev.map((ex, i) => (i === exIdx ? { ...ex, skipped: true } : ex)));

  const handleCancel = () => {
    const touched = exercises.some((ex) => ex.loggedSets.some((s) => s.completed));
    if (!touched || window.confirm('Discard this session? Ticked sets will be lost.')) { clearDraft(user.id); navigate(-1); }
  };

  const buildSummary = () => {
    let completedSets = 0, plannedSets = 0;
    const topSets = [];
    const flags = [];
    exercises.forEach((ex) => {
      if (ex.skipped) return;
      plannedSets += ex.loggedSets.length;
      const done = ex.loggedSets.filter((s) => s.completed);
      completedSets += done.length;
      if (ex.type === 'Main' && done.length) {
        const top = done.reduce((a, b) => ((parseFloat(b.weight) || 0) > (parseFloat(a.weight) || 0) ? b : a));
        topSets.push({ name: ex.name, weight: top.weight, reps: top.reps, rpe: top.rpe });
        const rpes = done.map((s) => parseFloat(s.rpe)).filter(Boolean);
        const target = parseFloat(String(ex.rpe).replace(/[^\d.]/g, '')) || null;
        if (target && rpes.length && Math.max(...rpes) >= target + 1) flags.push(`${ex.name}: RPE ran ${Math.max(...rpes)} vs ${target} planned → take 2.5–5% off next time or repeat the weight.`);
        if (target && rpes.length && Math.max(...rpes) <= target - 1.5) flags.push(`${ex.name}: felt easy (RPE ${Math.max(...rpes)}) → +2.5 kg next session is earned.`);
        if (done.some((s) => s.pain)) flags.push(`${ex.name}: pain logged — the set ends at pain, not at the rep count. Two sessions with pain = tell the engine (injury flag) before the next block.`);
      }
    });
    const completion = plannedSets ? Math.round((completedSets / plannedSets) * 100) : 0;
    return { duration: elapsedTime, sets: completedSets, completion, topSets, flags };
  };

  const handleFinishWorkout = async () => {
    const anyTicked = exercises.some((ex) => ex.loggedSets.some((s) => s.completed));
    if (!anyTicked && !window.confirm('No sets ticked yet. Tap ✓ on each set you did so it counts.\n\nSave this session as empty anyway?')) return;
    setIsSaving(true);
    setSaveError('');
    const s = buildSummary();
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/save-workout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ programId: program.id, weekNumber: week, dayNumber: day, loggedExercises: exercises, durationSeconds: Math.min(elapsedTime, 4 * 3600), sessionNotes: notes }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Could not save the session');
      clearDraft(user.id);
      setSummary(s);
      setIsWorkoutComplete(true);
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const nextSession = useMemo(() => {
    const weeks = program?.program_snapshot?.weeks || [];
    const w = weeks.find((x) => x.week === week);
    const train = (d) => !d.rest && !d.meetDay;
    const nextDay = w?.days.find((d) => d.day > day && train(d));
    if (nextDay) return { week, day: nextDay.day, label: `${nextDay.weekday || `Day ${nextDay.day}`} · ${nextDay.focus}` };
    const nw = weeks.find((x) => x.week === week + 1);
    const first = nw?.days?.find(train);
    if (first) return { week: week + 1, day: first.day, label: `${nw.label || `Week ${week + 1}`} · ${first.focus}` };
    return null;
  }, [program, week, day]);

  if (loading) return <div className="min-h-screen flex justify-center items-center"><div className="animate-spin h-8 w-8 border-2 border-gray-900 rounded-full border-t-transparent"></div></div>;
  if (!dayData && !isWorkoutComplete) return <div className="min-h-screen flex flex-col justify-center items-center text-gray-500 gap-4">Session not found.<Link to="/dashboard/programs" className="text-gray-900 underline">Back to program</Link></div>;

  if (isWorkoutComplete && summary) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-lg w-full bg-white border border-gray-200 rounded-2xl shadow-sm p-8 md:p-10 text-center">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.1 }} className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-8">
            <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
          </motion.div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2 tracking-tight">Session saved</h1>
          <p className="text-gray-500 mb-8">Week {week} · {dayData?.focus}</p>
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-4"><p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Time</p><p className="text-xl font-bold text-gray-900">{formatTime(summary.duration)}</p></div>
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-4"><p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Sets</p><p className="text-xl font-bold text-gray-900">{summary.sets}</p></div>
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-4"><p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Done</p><p className="text-xl font-bold text-gray-900">{summary.completion}%</p></div>
          </div>
          {summary.topSets.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 text-left">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Top sets</p>
              {summary.topSets.map((t, i) => (
                <p key={i} className="text-sm text-gray-800 flex justify-between"><span>{t.name}</span><span className="font-mono">{t.weight || '—'} kg × {t.reps || '—'}{t.rpe ? ` @ RPE ${t.rpe}` : ''}</span></p>
              ))}
            </div>
          )}
          <div className="bg-gray-900 rounded-xl p-4 text-white text-left mb-8">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Coach read</p>
            {summary.flags.length ? summary.flags.map((f, i) => <p key={i} className="text-sm text-gray-100 mb-1.5">• {f}</p>) : <p className="text-sm text-gray-100">On plan. Nothing to change — recover, eat, sleep, and show up for the next one.</p>}
          </div>
          <div className="flex flex-col gap-3">
            {nextSession ? <Link to={`/dashboard/workout?week=${nextSession.week}&day=${nextSession.day}`} className="w-full bg-gray-900 hover:bg-gray-800 text-white py-3.5 rounded-lg text-sm font-semibold transition-colors">Next: {nextSession.label} →</Link>
              : <Link to="/dashboard/generate" className="w-full bg-gray-900 hover:bg-gray-800 text-white py-3.5 rounded-lg text-sm font-semibold transition-colors">Block complete — build the next block →</Link>}
            <Link to="/dashboard" className="w-full text-gray-600 hover:text-gray-900 py-2.5 rounded-lg text-sm font-medium transition-colors">Back to dashboard</Link>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      <div className="sticky top-0 bg-white border-b border-gray-200 z-20">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={handleCancel} className="text-gray-500 hover:text-gray-900 text-sm font-medium">Cancel</button>
          <div className="text-center">
            <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Week {week} · {dayData.weekday || `Day ${day}`}</p>
            <p className="text-lg font-bold text-gray-900 tabular-nums">{formatTime(elapsedTime)}</p>
          </div>
          <button onClick={handleFinishWorkout} disabled={isSaving} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50">{isSaving ? 'Saving...' : 'Finish'}</button>
        </div>
        <AnimatePresence>
          {restTimer !== null && restTimer > 0 && (
            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden border-t border-gray-200" style={{ background: 'var(--ll-steel2)' }}>
              <div className="max-w-2xl mx-auto px-4 py-3 flex justify-between items-center gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Rest</p>
                  <p className="text-3xl font-bold tabular-nums text-gray-900" style={{ fontFamily: "'Archivo Black', sans-serif" }}>{formatTime(restTimer)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setRestTimer(restTimer + 60)} className="text-sm font-semibold border border-gray-300 text-gray-800 px-3 py-2 rounded-lg">+1 min</button>
                  <button onClick={() => setRestTimer(null)} className="text-sm font-semibold border border-gray-300 text-gray-800 px-3 py-2 rounded-lg">Skip</button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {resumed && <p className="max-w-2xl mx-auto px-4 pb-2 text-xs text-green-600">Resumed — your ticked sets were kept.</p>}
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{dayData.focus}</h1>
          {dayData.notes && <p className="text-sm text-gray-500 mt-1">{dayData.notes}</p>}
        </div>
        {saveError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-4">{saveError} — your sets are still here, try Finish again.</div>}
        {exercises.map((ex, exIdx) => {
          const isMain = ex.type === 'Main';
          const plates = isMain && ex.weight ? platesPerSide(Number(ex.weight)) : null;
          return (
            <div key={exIdx} className={`bg-white rounded-2xl border ${ex.skipped ? 'border-gray-100 opacity-50' : isMain ? 'border-gray-300 shadow-md' : 'border-gray-200 shadow-sm'} overflow-hidden`}>
              <div className="p-5 border-b border-gray-100 flex justify-between items-start gap-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{ex.type}</span>
                  <h3 className="text-lg font-semibold text-gray-900">{ex.name}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{ex.sets} × {ex.reps}{ex.weight ? ` @ ${ex.weight} kg` : ''}{ex.rpe && ex.rpe !== '—' ? ` · RPE ${ex.rpe}` : ''}</p>
                  {plates && <p className="text-[11px] text-gray-400 mt-0.5">Per side: {plates.length ? plates.map((p) => p.w).join(' + ') : 'bar only'}</p>}
                  {ex.note && isMain && <p className="text-xs text-gray-500 mt-1">→ {ex.note}</p>}
                </div>
                {!ex.skipped && <button onClick={() => skipExercise(exIdx)} className="text-xs text-gray-400 hover:text-gray-900 font-medium border border-gray-200 px-2 py-1 rounded-md whitespace-nowrap">Skip</button>}
              </div>
              {!ex.skipped && (
                <div className="divide-y divide-gray-100">
                  {ex.loggedSets.map((set, setIdx) => {
                    const step = (field, by, min = 0) => {
                      const cur = parseFloat(set[field]) || 0;
                      updateSet(exIdx, setIdx, { [field]: String(Math.max(min, Math.round((cur + by) * 100) / 100)) });
                    };
                    const btn = 'w-9 h-10 rounded-lg border border-gray-200 text-lg font-bold text-gray-700 disabled:opacity-40 active:scale-95';
                    return (
                      <div key={setIdx} className={`px-4 py-3 ${set.completed ? 'bg-green-50' : ''}`}>
                        <div className="flex items-center gap-2">
                          <span className="w-6 text-sm font-semibold text-gray-500 tabular-nums">{setIdx + 1}</span>
                          <div className="flex items-center gap-1 flex-1 min-w-0">
                            <button type="button" aria-label="Less weight" disabled={set.completed} onClick={() => step('weight', -2.5)} className={btn}>−</button>
                            <input type="text" inputMode="decimal" aria-label="Weight in kg" value={set.weight} onChange={(e) => updateSet(exIdx, setIdx, { weight: e.target.value })} placeholder="kg" disabled={set.completed} className="w-full min-w-0 h-10 text-center bg-gray-50 border border-gray-200 rounded-lg text-base font-semibold tabular-nums focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:opacity-60" />
                            <button type="button" aria-label="More weight" disabled={set.completed} onClick={() => step('weight', 2.5)} className={btn}>+</button>
                          </div>
                          <div className="flex items-center gap-1 w-[7.5rem] shrink-0">
                            <button type="button" aria-label="One rep less" disabled={set.completed} onClick={() => step('reps', -1)} className={btn}>−</button>
                            <input type="text" inputMode="numeric" aria-label="Reps" value={set.reps} onChange={(e) => updateSet(exIdx, setIdx, { reps: e.target.value })} placeholder="reps" disabled={set.completed} className="w-full min-w-0 h-10 text-center bg-gray-50 border border-gray-200 rounded-lg text-base font-semibold tabular-nums focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:opacity-60" />
                            <button type="button" aria-label="One rep more" disabled={set.completed} onClick={() => step('reps', 1)} className={btn}>+</button>
                          </div>
                          <button onClick={() => toggleSetComplete(exIdx, setIdx)} aria-label={set.completed ? 'Undo set' : 'Set done'} className={`w-11 h-11 shrink-0 rounded-xl border-2 flex items-center justify-center transition-colors ${set.completed ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 text-gray-400 hover:border-gray-400'}`}>
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                          </button>
                        </div>
                        {isMain && (
                          <div className="flex items-center gap-1.5 mt-2 pl-8 overflow-x-auto">
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mr-1">RPE</span>
                            {RPE_OPTIONS.map((r) => (
                              <button key={r} type="button" onClick={() => updateSet(exIdx, setIdx, { rpe: set.rpe === r ? '' : r })}
                                className={`min-w-[2.4rem] h-8 px-1.5 rounded-lg text-sm font-semibold border tabular-nums ${set.rpe === r ? 'bg-gray-100 border-gray-300 text-gray-900' : 'border-gray-200 text-gray-500'}`}>{r}</button>
                            ))}
                            <button type="button" title="Pain on this set" onClick={() => updateSet(exIdx, setIdx, { pain: !set.pain })} className={`ml-1 h-8 px-2 rounded-lg text-xs font-bold border ${set.pain ? 'bg-red-600 border-red-600 text-white' : 'border-gray-200 text-gray-500'}`}>Pain</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {isMain && <p className="px-4 py-2 text-[11px] text-gray-400">RPE 7 = 3 reps left · 8 = 2 left · 9 = 1 left. Tap Pain if a set hurt.</p>}
                </div>
              )}
            </div>
          );
        })}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Session notes</h3>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="How did it feel? Anything the coach should know?" rows={3} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
        </div>
      </div>
    </div>
  );
}
