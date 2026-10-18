import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { platesPerSide, round25 } from '../../lib/engine';
import { applyAdjustments } from '../../lib/autoreg';
import { readDraft, saveDraft, clearDraft } from '../../lib/workoutDraft';
import { warmupSets, CUES, RPE_SCALE, CUES_HI, RPE_SCALE_HI } from '../../lib/education';
import { useLang } from '../../lib/useLang';
import LangToggle from '../../components/dashboard/LangToggle';
import { reentry, trained, startOfDay, planSchedule, lockReason, appNow } from '../../lib/schedule';
import { motion, AnimatePresence } from 'framer-motion';

const MAIN_REST = 180; // System 2.0: main lifts 3–5 min
const ACC_REST = 90;
const RPE_OPTIONS = ['6', '7', '7.5', '8', '8.5', '9', '9.5', '10'];
// A gap with no taps longer than this is "left the gym / forgot the app", not training time.
const IDLE_CAP = 20 * 60 * 1000;

/**
 * In-session autoregulation (Helms: RPE steers the load). After a main set with RPE:
 * ≥2 over target → −7.5%, ≥1 over → −5%, ≥1.5 under → +2.5 kg (+5 kg squat/deadlift when ≥2 under).
 * Technique/low-RPE work (target ≤ 6) is meant to feel easy, so it never suggests more.
 */
/** "8" → {lo: 8, hi: 8}; "6–8" / "RPE 6-8" → {lo: 6, hi: 8}. (Stripping non-digits turned "6–8" into 68.) */
function rpeRange(str) {
  const m = String(str ?? '').match(/\d+(\.\d+)?/g);
  if (!m) return null;
  const n = m.map(Number).filter((x) => x >= 1 && x <= 10);
  return n.length ? { lo: Math.min(...n), hi: Math.max(...n) } : null;
}

function suggestFor(ex, set) {
  const range = rpeRange(ex.rpe);
  const target = range?.hi ?? null;
  const rpe = parseFloat(set.rpe);
  const kg = parseFloat(set.weight);
  if (!kg || set.pain || /Technique/i.test(ex.name)) return null;
  if (!ex.loggedSets.some((x) => !x.completed)) return null; // nothing left to change
  // Missed reps = the set was a grind (RPE 10) whatever was tapped.
  const plannedReps = /^\d+$/.test(String(ex.reps)) ? Number(ex.reps) : null;
  const gotReps = parseFloat(set.reps);
  if (plannedReps && gotReps && gotReps < plannedReps && kg) {
    const next = round25(kg * (plannedReps - gotReps >= 2 ? 0.925 : 0.95));
    return next < kg ? { kg: next, tone: 'down', text: `Got ${gotReps} of ${plannedReps} reps — next sets ${next} kg so the reps are clean.` } : null;
  }
  if (!target || !rpe || target <= 6) return null;
  // Over the TOP of the range = too heavy; under the BOTTOM of the range = too light.
  const diff = rpe > range.hi ? rpe - range.hi : rpe < range.lo ? rpe - range.lo : 0;
  if (diff >= 1) {
    const next = round25(kg * (diff >= 2 ? 0.925 : 0.95));
    return next < kg ? { kg: next, tone: 'down', text: `RPE ${rpe} vs ${range.lo === range.hi ? range.hi : `${range.lo}–${range.hi}`} planned — too heavy today. Next sets ${next} kg.` } : null;
  }
  if (diff <= -1.5) {
    const next = kg + (diff <= -2 && ex.lift !== 'bench' ? 5 : 2.5);
    return { kg: next, tone: 'up', text: `RPE ${rpe} vs ${range.lo === range.hi ? range.hi : `${range.lo}–${range.hi}`} planned — moving well. Next sets ${next} kg.` };
  }
  return null;
}

const newId = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

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
  const { lang, t: tx } = useLang();
  const [now, setNow] = useState(() => Date.now());
  // Timing is kept as timestamps, never as a counting-down number: phones pause
  // background tabs (screen lock, Spotify), and a timestamp is right the moment you come back.
  const [restEndsAt, setRestEndsAt] = useState(null);
  const [restOver, setRestOver] = useState(false);
  const [activeMs, setActiveMs] = useState(0);        // training time banked up to lastActiveAt
  const [lastActiveAt, setLastActiveAt] = useState(() => Date.now());
  const [clientId, setClientId] = useState(newId);     // lets a retried save never create a duplicate log
  const [offline, setOffline] = useState(false);
  const [screenLock, setScreenLock] = useState('');
  const [locked, setLocked] = useState(null);    // { text } when this session can't be started today
  const [startNote, setStartNote] = useState(''); // re-entry after a break / already logged
  const [dayMode, setDayMode] = useState('');      // '' | 'low' | 'short'
  const [rpeHelp, setRpeHelp] = useState(false);
  const savingRef = useRef(false);
  const isBeginner = program?.program_snapshot?.meta?.form?.exp === 'beg'; // one save at a time (the "online" event and the retry timer can fire together)
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [isWorkoutComplete, setIsWorkoutComplete] = useState(false);
  const [summary, setSummary] = useState(null);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [resumed, setResumed] = useState(false);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const timer = setInterval(tick, 1000);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', tick); };
  }, []);

  // Session time = active training time. Gaps longer than IDLE_CAP only count IDLE_CAP.
  const elapsedTime = Math.round((activeMs + Math.min(Math.max(0, now - lastActiveAt), IDLE_CAP)) / 1000);
  const bump = () => {
    const t = Date.now();
    setActiveMs((a) => a + Math.min(Math.max(0, t - lastActiveAt), IDLE_CAP));
    setLastActiveAt(t);
  };

  const restLeft = restEndsAt ? Math.max(0, Math.ceil((restEndsAt - now) / 1000)) : null;
  useEffect(() => {
    if (restEndsAt && now >= restEndsAt) {
      setRestEndsAt(null);
      setRestOver(true);
      try { navigator.vibrate?.([300, 150, 300]); } catch { /* not supported (iPhone) */ }
    }
  }, [now, restEndsAt]);

  // Keep the screen on while training (Android Chrome, iPhone Safari 16.4+). Re-asked when you come back to the tab.
  useEffect(() => {
    if (!('wakeLock' in navigator)) { setScreenLock('unsupported'); return; }
    let lock = null, alive = true;
    const ask = async () => {
      if (document.visibilityState !== 'visible' || !alive) return;
      try { lock = await navigator.wakeLock.request('screen'); setScreenLock('on'); lock.addEventListener('release', () => alive && setScreenLock('')); } catch { setScreenLock(''); }
    };
    ask();
    document.addEventListener('visibilitychange', ask);
    return () => { alive = false; document.removeEventListener('visibilitychange', ask); lock?.release?.().catch(() => {}); };
  }, []);

  useEffect(() => {
    const fetchProgram = async () => {
      const { data } = await supabase.from('generated_programs').select('id, created_at, program_snapshot').eq('user_id', user.id).eq('is_active', true).order('created_at', { ascending: false }).limit(1).maybeSingle();
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
            if (draft.activeMs !== undefined) { setActiveMs(draft.activeMs); setLastActiveAt(draft.lastActiveAt || draft.startedAt); }
            else { setActiveMs(0); setLastActiveAt(draft.startedAt); }
            if (draft.restEndsAt && draft.restEndsAt > Date.now()) setRestEndsAt(draft.restEndsAt);
            if (draft.clientId) setClientId(draft.clientId);
            setResumed(true);
          } else {
            // Same rule as the Program page: only what Today offers can be started.
            const { data: blockLogs } = await supabase.from('workout_logs').select('week_number, day_number, date_completed, logged_exercises').eq('user_id', user.id).eq('program_id', data.id).eq('is_deleted', false).limit(300);
            const sched = planSchedule(snap, blockLogs || [], data.created_at);
            const lock = lockReason(sched, wData, dData, data.created_at);
            if (lock) { setLocked(lock); setLoading(false); return; }
            let fresh = dData.exercises.map((ex) => ({ ...ex, loggedSets: newSets(ex), skipped: false }));
            const { data: recent } = await supabase.from('workout_logs').select('program_id, week_number, day_number, date_completed, logged_exercises').eq('user_id', user.id).order('date_completed', { ascending: false }).limit(20);
            const startNotes = [];
            if ((recent || []).some((l) => l.program_id === data.id && l.week_number === week && l.day_number === day && trained(l))) {
              startNotes.push('This session is already in your History. Logging it again adds a second entry — remove one in History if that was a mistake.');
            }
            const lastTrained = (recent || []).find(trained);
            const gap = lastTrained ? Math.round((startOfDay(appNow()) - startOfDay(lastTrained.date_completed)) / 864e5) : null;
            const back = reentry(gap);
            // A meet-block make-up (hard session moved to a free day) runs 5% lighter — Helms: drop the load
            // so back-to-back hard days still land at the planned effort.
            const key = `${week}-${day}`;
            const makeUp = sched.makeUp?.key === key;
            const factor = Math.min(back ? back.factor : 1, makeUp ? 0.95 : 1);
            if (factor < 1) fresh = fresh.map((ex) => (ex.type !== 'Main' ? ex : { ...ex, loggedSets: ex.loggedSets.map((x) => (x.weight ? { ...x, weight: String(round25(Number(x.weight) * factor)) } : x)) }));
            if (back) startNotes.push(back.text);
            if (makeUp) startNotes.push('Make-up session: main lifts 5% lighter so it stays at the planned effort. Your meet date doesn\'t move.');
            if (sched.easier?.key === key) startNotes.push('Easier session first today — the harder one is waiting for your next training day.');
            if (sched.rolling && sched.next?.key === key) startNotes.push(`Catching up: this is the ${dData.weekday || ''} ${dData.date || ''} session. The plan moves along — nothing is lost.`.replace(/\s+/g, ' '));
            setExercises(fresh);
            setStartNote(startNotes.join(' '));
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
    saveDraft(user.id, { programId: program.id, week, day, focus: dayData?.focus || '', exercises, notes, startedAt, activeMs, lastActiveAt, restEndsAt, clientId });
  }, [user.id, program, week, day, dayData, exercises, notes, startedAt, activeMs, lastActiveAt, restEndsAt, clientId, isWorkoutComplete]);

  const formatTime = (seconds) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;

  const updateSet = (exIdx, setIdx, patch) => {
    bump();
    setExercises((prev) => prev.map((ex, i) => {
      if (i !== exIdx) return ex;
      const nx = { ...ex, loggedSets: ex.loggedSets.map((s, j) => (j === setIdx ? { ...s, ...patch } : s)) };
      // Editing reps/kg/RPE of the set just finished re-reads it (e.g. "got 3, not 5").
      const done = nx.loggedSets.findIndex((x) => !x.completed);
      const last = done === -1 ? nx.loggedSets.length - 1 : done - 1;
      if (nx.type === 'Main' && setIdx === last && nx.loggedSets[setIdx].completed && !('completed' in patch)) nx.suggest = suggestFor(nx, nx.loggedSets[setIdx]);
      return nx;
    }));
  };
  // Sets go in order: only the next set can be ticked, only the last ticked one undone.
  const nextIdx = (ex) => ex.loggedSets.findIndex((x) => !x.completed);
  const lastDoneIdx = (ex) => { const i = nextIdx(ex); return i === -1 ? ex.loggedSets.length - 1 : i - 1; };
  const toggleSetComplete = (exIdx, setIdx) => {
    const ex = exercises[exIdx];
    const set = ex.loggedSets[setIdx];
    if (!set.completed && setIdx !== nextIdx(ex)) return;
    if (set.completed && setIdx !== lastDoneIdx(ex)) return;
    const nowComplete = !set.completed;
    updateSet(exIdx, setIdx, { completed: nowComplete });
    setRestOver(false);
    if (!nowComplete) { setSuggest(exIdx, null); return; } // undo never touches the rest clock
    const after = exercises.map((e, i) => (i !== exIdx ? e : { ...e, loggedSets: e.loggedSets.map((x, j) => (j === setIdx ? { ...x, completed: true } : x)) }));
    const anyLeft = after.some((e) => !e.skipped && e.loggedSets.some((x) => !x.completed));
    // Rest starts from THIS set. The last set of the session needs no rest — it's Finish time.
    setRestEndsAt(anyLeft ? Date.now() + (ex.type === 'Main' ? MAIN_REST : ACC_REST) * 1000 : null);
    if (ex.type === 'Main') setSuggest(exIdx, suggestFor(after[exIdx], { ...set, completed: true }));
  };
  const setSuggest = (exIdx, suggest) => setExercises((prev) => prev.map((e, i) => (i === exIdx ? { ...e, suggest } : e)));
  const setRpe = (exIdx, setIdx, rpe) => updateSet(exIdx, setIdx, { rpe });
  const applySuggest = (exIdx) => setExercises((prev) => prev.map((e, i) => (i !== exIdx ? e : {
    ...e, suggest: null, loggedSets: e.loggedSets.map((x) => (x.completed ? x : { ...x, weight: String(e.suggest.kg) })),
  })));
  const skipExercise = (exIdx) => setExercises((prev) => prev.map((ex, i) => (i === exIdx ? { ...ex, skipped: true } : ex)));
  const unskipExercise = (exIdx) => setExercises((prev) => prev.map((ex, i) => (i === exIdx ? { ...ex, skipped: false, skipNote: undefined } : ex)));
  // Rack taken, no machine, pain on one movement: log what was actually done. It stops counting as the competition lift.
  const [swapFor, setSwapFor] = useState(null); // index of the exercise whose swap box is open
  const [swapName, setSwapName] = useState('');
  const swapExercise = (exIdx) => {
    const ex = exercises[exIdx];
    const name = swapName.trim().slice(0, 50);
    const orig = ex.originalName || ex.name;
    setSwapFor(null); setSwapName('');
    if (!name) return;
    if (name.toLowerCase() === orig.toLowerCase()) { undoSwap(exIdx); return; } // "swapped" to the same lift = no swap
    setExercises((prev) => prev.map((e, i) => (i !== exIdx ? e : {
      ...e, originalName: orig, originalLift: e.originalName ? e.originalLift : e.lift, name: `${name} (instead of ${orig})`, lift: null, suggest: null,
    })));
  };
  const undoSwap = (exIdx) => setExercises((prev) => prev.map((e, i) => (i !== exIdx || !e.originalName ? e : {
    ...e, name: e.originalName, lift: e.originalLift ?? e.lift, originalName: undefined, originalLift: undefined,
  })));
  // End a lift early (pain): keep the sets done, drop the rest.
  const stopExercise = (exIdx) => setExercises((prev) => prev.map((e, i) => (i !== exIdx ? e : { ...e, stopped: true, suggest: null, loggedSets: e.loggedSets.filter((x) => x.completed) })));

  // Day options (Helms: on a bad day reduce, don't skip). Only touches sets not started yet; tap again to undo.
  const applyDayMode = (mode) => {
    const next = dayMode === mode ? '' : mode;
    setExercises((prev) => prev.map((ex) => {
      const base = ex.dayBase || { loggedSets: ex.loggedSets, skipped: ex.skipped };
      const restored = { ...ex, loggedSets: base.loggedSets.map((x, j) => (ex.loggedSets[j]?.completed ? ex.loggedSets[j] : x)), skipped: base.skipped, dayBase: undefined };
      if (!next) return restored;
      const started = restored.loggedSets.some((x) => x.completed);
      if (next === 'short') return ex.type === 'Main' || started ? { ...restored, dayBase: base } : { ...restored, skipped: true, skipNote: 'short on time', dayBase: base };
      if (ex.type !== 'Main' || started) return { ...restored, dayBase: base };
      const sets = restored.loggedSets.length > 2 ? restored.loggedSets.slice(0, -1) : restored.loggedSets;
      return { ...restored, dayBase: base, loggedSets: sets.map((x) => (x.weight ? { ...x, weight: String(round25(Number(x.weight) * 0.925)) } : x)) };
    }));
    setDayMode(next);
  };

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
        const target = rpeRange(ex.rpe)?.hi ?? null;
        if (target && rpes.length && Math.max(...rpes) >= target + 1) flags.push(`${ex.name}: RPE ran ${Math.max(...rpes)} vs ${target} planned → take 2.5–5% off next time or repeat the weight.`);
        if (target && rpes.length && Math.max(...rpes) <= (rpeRange(ex.rpe)?.lo ?? target) - 1.5) flags.push(`${ex.name}: felt easy (RPE ${Math.max(...rpes)}) → +2.5 kg next session is earned.`);
        if (done.some((s) => s.pain)) flags.push(`${ex.name}: pain logged — the set ends at pain, not at the rep count. Two sessions with pain = tell the engine (injury flag) before the next block.`);
      }
    });
    const completion = plannedSets ? Math.round((completedSets / plannedSets) * 100) : 0;
    return { duration: elapsedTime, sets: completedSets, completion, topSets, flags };
  };

  const handleFinishWorkout = async (auto = false) => {
    const anyTicked = exercises.some((ex) => ex.loggedSets.some((s) => s.completed));
    if (!auto && !anyTicked && !window.confirm('No sets ticked yet. Tap ✓ on each set you did so it counts.\n\nSave this session as empty anyway?')) return;
    if (!auto && anyTicked) {
      const live = exercises.filter((ex) => !ex.skipped);
      const total = live.reduce((n, ex) => n + ex.loggedSets.length, 0);
      const doneN = live.reduce((n, ex) => n + ex.loggedSets.filter((x) => x.completed).length, 0);
      if (total && doneN / total < 0.5 && !window.confirm(`Only ${doneN} of ${total} sets ticked. Finish now? Sets not ticked count as not done.`)) return;
    }
    if (!navigator.onLine) { setOffline(true); setSaveError(''); return; }
    if (savingRef.current) return;
    savingRef.current = true;
    setIsSaving(true);
    setSaveError('');
    const s = buildSummary();
    try {
      const { data: { session } } = await supabase.auth.getSession();
      // Logged out (or the login could not be refreshed): say so instead of retrying forever as "offline".
      if (!session) { setOffline(false); setSaveError('You are signed out. Your sets are safe on this phone — sign in again, then tap Finish.'); return; }
      const res = await fetch('/api/save-workout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ programId: program.id, weekNumber: week, dayNumber: day, loggedExercises: exercises, durationSeconds: Math.min(elapsedTime, 4 * 3600), sessionNotes: notes, clientId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Could not save the session');
      clearDraft(user.id);
      setOffline(false);
      setSummary(s);
      setIsWorkoutComplete(true);
    } catch (err) {
      // fetch() throws TypeError when there is no connection — queue it instead of failing.
      if (err instanceof TypeError || !navigator.onLine) { setOffline(true); setSaveError(''); }
      else setSaveError(err.message);
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  // Finished without signal (basement gym): save automatically as soon as the internet is back.
  // The ref always holds the latest handler, so sets ticked while waiting are included in the save.
  const finishRef = useRef(null);
  finishRef.current = handleFinishWorkout;
  useEffect(() => {
    if (!offline) return;
    const retry = () => finishRef.current?.(true);
    window.addEventListener('online', retry);
    const t = setInterval(() => { if (navigator.onLine) retry(); }, 30000);
    return () => { window.removeEventListener('online', retry); clearInterval(t); };
  }, [offline]); // eslint-disable-line react-hooks/exhaustive-deps

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
  if (locked) return (
    <div className="min-h-screen flex flex-col justify-center items-center text-center px-6 gap-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Week {week} · {dayData?.weekday || `Day ${day}`}{dayData?.date ? ` · ${dayData.date}` : ''}</p>
      <h1 className="text-xl font-bold text-gray-900">{dayData?.focus || 'Session'} is locked</h1>
      <p className="text-sm text-gray-500 max-w-sm">{locked.text}</p>
      <Link to="/dashboard" className="mt-2 bg-gray-900 text-white px-6 py-3 rounded-lg text-sm font-semibold">Go to today's session</Link>
    </div>
  );
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
            {nextSession ? <Link to="/dashboard" className="w-full bg-gray-900 hover:bg-gray-800 text-white py-3.5 rounded-lg text-sm font-semibold transition-colors">Done — next up: {nextSession.label}</Link>
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
          <button onClick={() => handleFinishWorkout(false)} disabled={isSaving || offline} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50">{isSaving ? 'Saving...' : offline ? 'Waiting…' : 'Finish'}</button>
        </div>
        <AnimatePresence>
          {restLeft !== null && restLeft > 0 && (
            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden border-t border-gray-200" style={{ background: 'var(--ll-steel2)' }}>
              <div className="max-w-2xl mx-auto px-4 py-3 flex justify-between items-center gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Rest</p>
                  <p className="text-3xl font-bold tabular-nums text-gray-900" style={{ fontFamily: "'Archivo Black', sans-serif" }}>{formatTime(restLeft)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setRestEndsAt(restEndsAt + 60000)} className="text-sm font-semibold border border-gray-300 text-gray-800 px-3 py-2 rounded-lg">+1 min</button>
                  <button onClick={() => setRestEndsAt(null)} className="text-sm font-semibold border border-gray-300 text-gray-800 px-3 py-2 rounded-lg">Skip</button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {restOver && (
          <button type="button" onClick={() => setRestOver(false)} className="w-full text-white text-center py-3 text-base font-bold tracking-wide" style={{ background: 'var(--ll-good)' }}>
            REST OVER — next set <span className="text-xs font-normal opacity-80">(tap to hide)</span>
          </button>
        )}
        {(offline || screenLock === 'on') && (
          <p className={`max-w-2xl mx-auto px-4 pb-2 text-xs ${offline ? 'text-amber-700' : 'text-gray-400'}`}>
            {offline ? 'No internet — the session is safe on this phone and saves by itself when the signal is back.' : 'Screen stays on while you train.'}
          </p>
        )}
        {resumed && <p className="max-w-2xl mx-auto px-4 pb-2 text-xs text-green-600">Resumed — your ticked sets were kept.</p>}
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{dayData.focus}</h1>
          {dayData.notes && <p className="text-sm text-gray-500 mt-1">{dayData.notes}</p>}
        </div>
        {startNote && <div className="bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-xl p-4">{startNote}</div>}
        {!exercises.some((e) => e.loggedSets.some((x) => x.completed)) || dayMode ? (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-gray-400 font-semibold uppercase tracking-wider">Today</span>
            <button type="button" onClick={() => applyDayMode('low')} className={`px-3 py-1.5 rounded-lg border font-semibold ${dayMode === 'low' ? 'bg-amber-50 border-amber-300 text-amber-700' : 'border-gray-200 text-gray-600'}`}>Low energy</button>
            <button type="button" onClick={() => applyDayMode('short')} className={`px-3 py-1.5 rounded-lg border font-semibold ${dayMode === 'short' ? 'bg-amber-50 border-amber-300 text-amber-700' : 'border-gray-200 text-gray-600'}`}>Short on time</button>
            {dayMode && <span className="text-gray-500 w-full">{dayMode === 'low' ? 'Main lifts 7.5% lighter, one set less. A reduced session beats a skipped one.' : 'Main lifts only — accessories skipped. Tap again to undo.'}</span>}
          </div>
        ) : null}
        {saveError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-4">{saveError} — your sets are still here, try Finish again.</div>}
        {(() => {
          const allDone = exercises.length > 0 && exercises.every((e) => e.skipped || e.loggedSets.every((x) => x.completed));
          return allDone ? <div className="bg-green-50 border border-green-200 text-green-700 text-sm font-semibold rounded-xl p-4">All sets done — tap Finish to save the session.</div> : null;
        })()}
        {exercises.map((ex, exIdx) => {
          const isMain = ex.type === 'Main';
          const nIdx = ex.skipped ? -1 : nextIdx(ex);
          const lIdx = lastDoneIdx(ex);
          const curKg = Number((ex.loggedSets.find((x) => !x.completed) || ex.loggedSets[ex.loggedSets.length - 1] || {}).weight) || Number(ex.weight);
          const plates = isMain && curKg ? platesPerSide(curKg) : null;
          return (
            <div key={exIdx} className={`bg-white rounded-2xl border ${ex.skipped ? 'border-gray-100 opacity-50' : isMain ? 'border-gray-300 shadow-md' : 'border-gray-200 shadow-sm'} overflow-hidden`}>
              <div className="p-5 border-b border-gray-100 flex justify-between items-start gap-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{ex.type}</span>
                  <h3 className="text-lg font-semibold text-gray-900">{ex.name}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{ex.sets} × {ex.reps}{ex.weight ? ` @ ${ex.weight} kg` : ''}{ex.rpe && ex.rpe !== '—' ? ` · RPE ${ex.rpe}` : ''}</p>
                  {plates && <p className="text-[11px] text-gray-400 mt-0.5">Per side: {plates.length ? plates.map((p) => p.w).join(' + ') : 'bar only'}</p>}
                  {isMain && ex.lift && !ex.skipped && warmupSets(curKg, ex.lift).length > 0 && !ex.loggedSets.some((x) => x.completed) && (
                    <details className="mt-2" open={isBeginner}>
                      <summary className="text-xs font-semibold text-gray-500 cursor-pointer">{tx.warmup}</summary>
                      <p className="text-xs text-gray-700 mt-1 tabular-nums">{warmupSets(curKg, ex.lift).map((w) => (w.bar ? `${tx.bar} × ${w.reps}` : `${w.kg} × ${w.reps}`)).join('  →  ')}  →  {tx.workSets}</p>
                      <p className="text-[11px] text-gray-400">{tx.warmupHint}</p>
                    </details>
                  )}
                  {isBeginner && isMain && CUES[ex.lift] && !ex.skipped && !/Technique/i.test(ex.name) && (
                    <details className="mt-1.5">
                      <summary className="text-xs font-semibold text-gray-500 cursor-pointer">{tx.cues}</summary>
                      <ul className="mt-1 space-y-1">{(lang === 'hi' ? CUES_HI : CUES)[ex.lift].map((c, i) => <li key={i} className="text-xs text-gray-700">• {c}</li>)}</ul>
                      <LangToggle className="mt-1.5" />
                    </details>
                  )}
                  {ex.note && isMain && <p className="text-xs text-gray-500 mt-1">→ {ex.note}</p>}
                  {swapFor === exIdx && (
                    <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); swapExercise(exIdx); }}>
                      <input autoFocus value={swapName} onChange={(e) => setSwapName(e.target.value)} placeholder="Doing instead… e.g. Leg press" aria-label="Replacement exercise" className="flex-1 min-w-0 h-9 px-3 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                      <button type="submit" disabled={!swapName.trim()} className="h-9 px-3 rounded-lg text-sm font-semibold bg-gray-900 text-white disabled:opacity-40">Swap</button>
                      <button type="button" onClick={() => setSwapFor(null)} className="h-9 px-2 text-sm text-gray-500">Cancel</button>
                    </form>
                  )}
                  {ex.skipped && <p className="text-xs text-gray-500 mt-1">Skipped{ex.skipNote ? ` — ${ex.skipNote}` : ''}</p>}
                  {ex.stopped && <p className="text-xs text-amber-700 mt-1">Stopped early — remaining sets dropped.</p>}
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  {ex.skipped
                    ? <button onClick={() => unskipExercise(exIdx)} className="text-xs text-gray-700 font-semibold border border-gray-300 px-2 py-1 rounded-md whitespace-nowrap">Undo skip</button>
                    : <button onClick={() => { if (!ex.loggedSets.some((x) => x.completed) || window.confirm(`Skip the rest of ${ex.name}?`)) skipExercise(exIdx); }} className="text-xs text-gray-400 hover:text-gray-900 font-medium border border-gray-200 px-2 py-1 rounded-md whitespace-nowrap">Skip</button>}
                  {!ex.skipped && !ex.stopped && (ex.originalName
                    ? <button onClick={() => undoSwap(exIdx)} className="text-xs text-gray-700 font-semibold border border-gray-300 px-2 py-1 rounded-md whitespace-nowrap">Undo swap</button>
                    : <button onClick={() => { setSwapFor(swapFor === exIdx ? null : exIdx); setSwapName(''); }} className="text-xs text-gray-400 hover:text-gray-900 font-medium px-2 py-0.5 whitespace-nowrap">Swap</button>)}
                </div>
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
                      <div key={setIdx} className={`px-4 py-3 ${set.completed ? 'bg-green-50' : setIdx === nIdx ? '' : 'opacity-60'}`} style={setIdx === nIdx ? { boxShadow: 'inset 3px 0 0 var(--ll-red)' } : undefined}>
                        <div className="flex items-center gap-2">
                          <span className="w-6 text-sm font-semibold text-gray-500 tabular-nums">{setIdx + 1}</span>
                          <div className="flex items-center gap-1 flex-1 min-w-0">
                            <button type="button" aria-label="Less weight" onClick={() => step('weight', -2.5)} className={btn}>−</button>
                            <input type="text" inputMode="decimal" aria-label="Weight in kg" value={set.weight} onChange={(e) => updateSet(exIdx, setIdx, { weight: e.target.value })} placeholder="kg" className="w-full min-w-0 h-10 text-center bg-gray-50 border border-gray-200 rounded-lg text-base font-semibold tabular-nums focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:opacity-60" />
                            <button type="button" aria-label="More weight" onClick={() => step('weight', 2.5)} className={btn}>+</button>
                          </div>
                          {/* Phones: reps is a plain box (tap to type) so the weight box keeps room for "102.5"; ± buttons from sm up. */}
                          <div className="flex items-center gap-1 w-12 sm:w-[7.5rem] shrink-0">
                            <button type="button" aria-label="One rep less" onClick={() => step('reps', -1)} className={`${btn} hidden sm:block`}>−</button>
                            <input type="text" inputMode="numeric" aria-label="Reps" value={set.reps} onChange={(e) => updateSet(exIdx, setIdx, { reps: e.target.value })} placeholder="reps" className="w-full min-w-0 h-10 text-center bg-gray-50 border border-gray-200 rounded-lg text-base font-semibold tabular-nums focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:opacity-60" />
                            <button type="button" aria-label="One rep more" onClick={() => step('reps', 1)} className={`${btn} hidden sm:block`}>+</button>
                          </div>
                          <button onClick={() => toggleSetComplete(exIdx, setIdx)} aria-label={set.completed ? 'Undo set' : 'Set done'}
                            disabled={set.completed ? setIdx !== lIdx : setIdx !== nIdx}
                            title={!set.completed && setIdx !== nIdx ? `Finish set ${nIdx + 1} first` : undefined}
                            className={`w-11 h-11 shrink-0 rounded-xl border-2 flex items-center justify-center transition-colors disabled:cursor-not-allowed ${set.completed ? 'bg-green-500 border-green-500 text-white' : setIdx === nIdx ? 'border-red-500 text-red-500' : 'border-gray-200 text-gray-300'}`}>
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                          </button>
                        </div>
                        {isMain && set.completed && setIdx === lIdx && ex.loggedSets.some((x) => !x.completed) && !set.rpe && !set.pain && (
                          <p className="text-xs text-amber-700 mt-2 pl-8">How hard was it? Tap the RPE — the next sets adjust from it.</p>
                        )}
                        {isMain && set.completed && set.pain && setIdx === lIdx && ex.loggedSets.filter((x) => x.pain).length === 1 && ex.loggedSets.some((x) => !x.completed) && (
                          <p className="text-xs text-red-600 mt-2 pl-8">Pain noted — no load change. Next set lighter or skip it; if it hurts again, stop this lift for today.</p>
                        )}
                        {isMain && (
                          <div className="flex flex-wrap items-center gap-1.5 mt-2 pl-8">
                            <span className={`text-[11px] font-semibold uppercase tracking-wider mr-1 ${set.completed && !set.rpe ? 'text-amber-700' : 'text-gray-400'}`}>{set.completed && !set.rpe ? 'RPE?' : 'RPE'}</span>
                            {RPE_OPTIONS.map((r) => (
                              <button key={r} type="button" onClick={() => setRpe(exIdx, setIdx, set.rpe === r ? '' : r)}
                                className={`min-w-[2.4rem] h-8 px-1.5 rounded-lg text-sm font-semibold border tabular-nums ${set.rpe === r ? 'bg-gray-100 border-gray-300 text-gray-900' : 'border-gray-200 text-gray-500'}`}>{r}</button>
                            ))}
                            <button type="button" title="Pain on this set" onClick={() => updateSet(exIdx, setIdx, { pain: !set.pain })} className={`ml-1 h-8 px-2 rounded-lg text-xs font-bold border ${set.pain ? 'bg-red-600 border-red-600 text-white' : 'border-gray-200 text-gray-500'}`}>Pain</button>
                          </div>
                        )}
                        {/* Right under the set it came from — not at the bottom of the card where it scrolls out of view. */}
                        {isMain && ex.suggest && setIdx === lIdx && (
                          <div className={`mt-3 ml-8 rounded-xl border p-3 ${ex.suggest.tone === 'down' ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
                            <p className={`text-sm ${ex.suggest.tone === 'down' ? 'text-amber-700' : 'text-green-700'}`}>{ex.suggest.text}</p>
                            <div className="flex gap-2 mt-2">
                              <button type="button" onClick={() => applySuggest(exIdx)} className="text-sm font-semibold bg-gray-900 text-white px-3 py-1.5 rounded-lg">Use {ex.suggest.kg} kg</button>
                              <button type="button" onClick={() => setSuggest(exIdx, null)} className="text-sm font-semibold border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg">Keep plan</button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {!ex.stopped && ex.loggedSets.filter((x) => x.pain).length >= 2 && ex.loggedSets.some((x) => !x.completed) && (
                    <div className="mx-4 my-3 rounded-xl border p-3 bg-red-50 border-red-200">
                      <p className="text-sm text-red-700">Two painful sets — stop this lift for today. Pain is a signal, not effort. Do pain-free work instead; if it comes back next session, add it to injuries in your profile.</p>
                      <button type="button" onClick={() => stopExercise(exIdx)} className="mt-2 text-sm font-semibold bg-gray-900 text-white px-3 py-1.5 rounded-lg">Stop {ex.name}</button>
                    </div>
                  )}
                  {isMain && (
                    <p className="px-4 py-2 text-[11px] text-gray-400">
                      {tx.rpeLine}{' '}
                      <button type="button" onClick={() => setRpeHelp(true)} className="underline font-semibold text-gray-500">{tx.rpeWhat}</button>
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {rpeHelp && (
          <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/60 p-4" onClick={() => setRpeHelp(false)}>
            <div className="bg-white border border-gray-200 rounded-2xl p-5 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-lg font-bold text-gray-900">{tx.rpeTitle}</h3>
                <LangToggle className="shrink-0 mt-1" />
              </div>
              <p className="text-sm text-gray-500 mt-1">{tx.rpeIntro}</p>
              <div className="mt-4 divide-y divide-gray-200">
                {(lang === 'hi' ? RPE_SCALE_HI : RPE_SCALE).map(([r, d]) => (
                  <div key={r} className="flex gap-4 py-2.5"><span className="w-8 text-lg font-bold text-gray-900 tabular-nums">{r}</span><span className="text-sm text-gray-700">{d}</span></div>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-3">{tx.rpeFoot}</p>
              <button type="button" onClick={() => setRpeHelp(false)} className="mt-4 w-full bg-gray-900 text-white py-3 rounded-lg text-sm font-semibold">{tx.gotIt}</button>
            </div>
          </div>
        )}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Session notes</h3>
          <textarea value={notes} onChange={(e) => { bump(); setNotes(e.target.value); }} placeholder="How did it feel? Saved in your History. (Pain on a set → tap Pain on that set — that is what adjusts your plan.)" rows={3} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
        </div>
      </div>
    </div>
  );
}
