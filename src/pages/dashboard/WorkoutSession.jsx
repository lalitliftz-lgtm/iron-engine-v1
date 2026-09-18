import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';

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
  
  const [isWorkoutComplete, setIsWorkoutComplete] = useState(false);
  const [summaryStats, setSummaryStats] = useState(null);

  useEffect(() => {
    const timer = setInterval(() => setElapsedTime(prev => prev + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (restTimer === null || restTimer <= 0) return;
    const interval = setInterval(() => {
      setRestTimer(prev => {
        if (prev <= 1) { clearInterval(interval); return null; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [restTimer]);

  useEffect(() => {
    const fetchProgram = async () => {
      const { data } = await supabase.from('generated_programs').select('id, program_snapshot').eq('user_id', user.id).eq('is_active', true).order('created_at', { ascending: false }).limit(1).maybeSingle();

      if (data) {
        setProgram(data);
        const wData = data.program_snapshot.weeks.find(w => w.week === week);
        const dData = wData?.days.find(d => d.day === day);
        
        if (dData) {
          setDayData(dData);
          const initExercises = dData.exercises.map(ex => ({
            ...ex,
            loggedSets: Array(ex.sets).fill({ weight: '', reps: '', completed: false }),
            skipped: false
          }));
          setExercises(initExercises);
        }
      }
      setLoading(false);
    };
    fetchProgram();
  }, [user, week, day]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleSetChange = (exIdx, setIdx, field, value) => {
    const updated = [...exercises];
    updated[exIdx].loggedSets[setIdx] = { ...updated[exIdx].loggedSets[setIdx], [field]: value };
    setExercises(updated);
  };

  const toggleSetComplete = (exIdx, setIdx) => {
    const updated = [...exercises];
    const isNowComplete = !updated[exIdx].loggedSets[setIdx].completed;
    updated[exIdx].loggedSets[setIdx].completed = isNowComplete;
    setExercises(updated);
    if (isNowComplete) setRestTimer(90);
  };

  const skipExercise = (exIdx) => {
    const updated = [...exercises];
    updated[exIdx].skipped = true;
    setExercises(updated);
  };

  const handleFinishWorkout = async () => {
    setIsSaving(true);

    let totalVolume = 0;
    let completedSets = 0;
    let plannedSets = 0;
    let estimatedPRs = [];

    exercises.forEach(ex => {
      if (!ex.skipped) {
        plannedSets += ex.sets;
        let maxWeightLifted = 0;
        
        ex.loggedSets.forEach(set => {
          if (set.completed) {
            completedSets++;
            const w = parseFloat(set.weight) || 0;
            const r = parseInt(set.reps) || 0;
            totalVolume += (w * r);
            if (w > maxWeightLifted) maxWeightLifted = w;
          }
        });

        const prescribedWeight = parseFloat(ex.weight) || 0;
        if (maxWeightLifted > prescribedWeight && prescribedWeight > 0) {
          estimatedPRs.push(`${ex.name} (${maxWeightLifted}kg)`);
        }
      }
    });

    const completionRate = plannedSets > 0 ? Math.round((completedSets / plannedSets) * 100) : 0;

    setSummaryStats({ duration: elapsedTime, volume: totalVolume, sets: completedSets, completion: completionRate, prs: estimatedPRs });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      await fetch('/api/save-workout', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ programId: program.id, weekNumber: week, dayNumber: day, loggedExercises: exercises, durationSeconds: elapsedTime, sessionNotes: notes })
      });
      setIsWorkoutComplete(true);
    } catch (err) {
      alert('Failed to save workout.');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return <div className="min-h-screen flex justify-center items-center"><div className="animate-spin h-8 w-8 border-2 border-gray-900 rounded-full border-t-transparent"></div></div>;
  if (!dayData && !isWorkoutComplete) return <div className="min-h-screen flex justify-center items-center text-gray-500">Workout not found.</div>;

  if (isWorkoutComplete && summaryStats) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-lg w-full bg-white border border-gray-200 rounded-2xl shadow-sm p-8 md:p-10 text-center">
          <motion.div initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.1 }} className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-8">
            <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
          </motion.div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2 tracking-tight">Workout Complete!</h1>
          <p className="text-gray-500 mb-8">You crushed Week {week}, Day {day}. Here is your session summary.</p>
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-4"><p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Duration</p><p className="text-xl font-bold text-gray-900">{formatTime(summaryStats.duration)}</p></div>
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-4"><p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Total Volume</p><p className="text-xl font-bold text-gray-900">{summaryStats.volume.toLocaleString()} kg</p></div>
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-4"><p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Sets Completed</p><p className="text-xl font-bold text-gray-900">{summaryStats.sets}</p></div>
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-4"><p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Completion</p><p className="text-xl font-bold text-gray-900">{summaryStats.completion}%</p></div>
          </div>
          <div className="space-y-4 mb-8 text-left">
            <div className="bg-white border border-gray-200 rounded-xl p-4 flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">Personal Records</span>
              <span className="text-sm font-semibold text-gray-900">{summaryStats.prs.length > 0 ? `🔥 ${summaryStats.prs.join(', ')}` : 'None today'}</span>
            </div>
            <div className="bg-gray-900 rounded-xl p-4 text-white">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Coach Message</span>
              </div>
              <p className="text-sm text-gray-100">Great session! Recovery starts now. Hydrate, eat well, and get ready for the next block.</p>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <Link to="/dashboard" className="w-full bg-gray-900 hover:bg-gray-800 text-white py-3.5 rounded-lg text-sm font-semibold transition-colors">Return to Dashboard</Link>
            <Link to="/dashboard/history" className="w-full text-gray-600 hover:text-gray-900 py-2.5 rounded-lg text-sm font-medium transition-colors">View Workout History</Link>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      <div className="sticky top-0 bg-white border-b border-gray-200 z-20">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-900 text-sm font-medium">Cancel</button>
          <div className="text-center">
            <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Week {week} · Day {day}</p>
            <p className="text-lg font-bold text-gray-900 tabular-nums">{formatTime(elapsedTime)}</p>
          </div>
          <button onClick={handleFinishWorkout} disabled={isSaving} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50">{isSaving ? 'Saving...' : 'Finish'}</button>
        </div>
        <AnimatePresence>
          {restTimer !== null && restTimer > 0 && (
            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="bg-gray-900 text-white overflow-hidden">
              <div className="max-w-2xl mx-auto px-4 py-2 flex justify-between items-center">
                <span className="text-sm font-medium">Rest Timer</span>
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold tabular-nums">{formatTime(restTimer)}</span>
                  <button onClick={() => setRestTimer(restTimer + 30)} className="text-xs bg-white/10 hover:bg-white/20 px-2 py-1 rounded">+30s</button>
                  <button onClick={() => setRestTimer(null)} className="text-xs bg-white/10 hover:bg-white/20 px-2 py-1 rounded">Skip</button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">{dayData.focus}</h1>
        {exercises.map((ex, exIdx) => (
          <div key={exIdx} className={`bg-white rounded-2xl border ${ex.skipped ? 'border-gray-100 opacity-50' : 'border-gray-200 shadow-sm'} overflow-hidden`}>
            <div className="p-5 border-b border-gray-100 flex justify-between items-center">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{ex.type}</span>
                <h3 className="text-lg font-semibold text-gray-900">{ex.name}</h3>
                <p className="text-xs text-gray-500 mt-0.5">Target: {ex.sets} x {ex.reps} {ex.weight && `@ ${ex.weight}kg`}</p>
              </div>
              {!ex.skipped && <button onClick={() => skipExercise(exIdx)} className="text-xs text-gray-400 hover:text-gray-900 font-medium border border-gray-200 px-2 py-1 rounded-md">Skip</button>}
            </div>
            {!ex.skipped && (
              <div className="divide-y divide-gray-50">
                <div className="grid grid-cols-12 gap-2 px-5 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  <div className="col-span-1">Set</div><div className="col-span-4">Weight (kg)</div><div className="col-span-4">Reps</div><div className="col-span-3 text-right">Done</div>
                </div>
                {ex.loggedSets.map((set, setIdx) => (
                  <div key={setIdx} className={`grid grid-cols-12 gap-2 px-5 py-3 items-center ${set.completed ? 'bg-green-50/50' : ''}`}>
                    <div className="col-span-1 text-sm font-medium text-gray-500">{setIdx + 1}</div>
                    <div className="col-span-4"><input type="text" inputMode="decimal" value={set.weight} onChange={(e) => handleSetChange(exIdx, setIdx, 'weight', e.target.value)} placeholder="0" disabled={set.completed} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:opacity-50" /></div>
                    <div className="col-span-4"><input type="text" inputMode="decimal" value={set.reps} onChange={(e) => handleSetChange(exIdx, setIdx, 'reps', e.target.value)} placeholder="0" disabled={set.completed} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:opacity-50" /></div>
                    <div className="col-span-3 flex justify-end">
                      <button onClick={() => toggleSetComplete(exIdx, setIdx)} className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-colors ${set.completed ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 text-transparent hover:border-gray-400'}`}>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Session Notes</h3>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="How did the workout feel? Any PRs?" rows={3} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
        </div>
      </div>
    </div>
  );
}
