import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { LIFT_NAMES } from '../../lib/engine';
import { printBlock, downloadBlockXlsx } from '../../lib/exportBlock';
import { applyAdjustments, attemptPlan } from '../../lib/autoreg';
import StalePlanBanner from '../../components/dashboard/StalePlanBanner';
import { planSchedule, lockReason, appNow, trained, proWeekLocked } from '../../lib/schedule';
import { useSubscription } from '../../context/SubscriptionContext';
import { CONFIG } from '../../config/siteConfig';
import SeasonRoadmap from '../../components/dashboard/SeasonRoadmap';
import { useLang } from '../../lib/useLang';

// [English heading, English text, Hinglish heading, Hinglish text]
const EXECUTION_RULES = [
  ["Warm-up", "Bar × 8 → 40% × 5 → 55% × 3 → 70% × 2 → 80% × 1 → work sets.", "Warm-up", "Bar × 8 → 40% × 5 → 55% × 3 → 70% × 2 → 80% × 1 → work sets."],
  ["RPE", "RPE 7 = 3 reps in the tank. RPE 8 = 2. RPE 9 = 1. On a bad day, drop the % and follow RPE — RPE is the final judge.", "RPE", "RPE 7 = 3 reps tank mein bache. RPE 8 = 2. RPE 9 = 1. Kharab din ho to % chhodo aur RPE follow karo — final faisla RPE ka."],
  ["Auto-regulation", "If RPE runs higher than prescribed → reduce the weight by 5%.", "Auto-regulation", "RPE likhe hue se zyada aa raha hai → weight 5% kam karo."],
  ["Rest", "Main lifts: 3–5 min. Accessories: 1.5–2 min.", "Rest", "Main lifts: 3–5 min. Accessories: 1.5–2 min."],
];
const TEST_DAY_RULE = ["Test Day (Week 5)", "After the deload: 70% → 80% → 87.5% → 92.5% → 97–100% → PR attempt only if bar speed looks good. Max 3 heavy singles.", "Test Day (Week 5)", "Deload ke baad: 70% → 80% → 87.5% → 92.5% → 97–100% → PR attempt tabhi jab bar speed achhi lage. Max 3 heavy singles."];

export default function Programs() {
  const { user } = useAuth();
  const { status } = useSubscription();
  const { L } = useLang();
  // Free plan = Week 1 only. While the plan status loads nothing is hidden (the server enforces it anyway).
  const isPro = status === 'pro_active' || status === 'loading';
  const [loading, setLoading] = useState(true);
  const [program, setProgram] = useState(null);
  const [activeWeek, setActiveWeek] = useState(1);
  const [activeDay, setActiveDay] = useState(1);
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    const fetchProgram = async () => {
      const { data } = await supabase
        .from('generated_programs')
        .select(`id, created_at, is_active, program_snapshot, engine_versions ( version_string ), athlete_profiles ( primary_goal, competition_date, training_days_per_week, squat_1rm, bench_1rm, deadlift_1rm, assessment_data, updated_at )`)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        setProgram(data);
        // Open on today's date when the block has one; otherwise on the first training day.
        const todayLbl = appNow().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
        const weeksArr = data.program_snapshot?.weeks || [];
        const todayWeek = weeksArr.find((w) => (w.days || []).some((d) => d.date === todayLbl));
        if (todayWeek) {
          setActiveWeek(todayWeek.week);
          setActiveDay(todayWeek.days.find((d) => d.date === todayLbl).day);
        } else {
          const firstTrain = weeksArr[0]?.days?.find((d) => !d.rest);
          if (firstTrain) setActiveDay(firstTrain.day);
        }
        const { data: l } = await supabase.from('workout_logs').select('week_number, day_number, date_completed, logged_exercises').eq('program_id', data.id).eq('user_id', user.id).order('date_completed', { ascending: false }).limit(100);
        setLogs(l || []);
      }
      setLoading(false);
    };
    fetchProgram();
  }, [user]);

  // Both exports use the SAVED block as shown in the app (check-in adjustments, bridge week, rest days).
  const exportSnap = () => applyAdjustments(program.program_snapshot, program.program_snapshot.adjustments);
  const athleteName = () => program.program_snapshot?.meta?.form?.name || '';
  const [exporting, setExporting] = useState('');
  const handlePrint = () => { if (!isPro) { window.location.assign('/dashboard/subscription'); return; } printBlock(exportSnap(), athleteName()); };
  const handleExcel = async () => {
    if (!isPro) { window.location.assign('/dashboard/subscription'); return; }
    setExporting('xlsx');
    try { await downloadBlockXlsx(exportSnap(), athleteName()); } catch (e) { window.alert(L(`Could not build the Excel file: ${e.message}`, `Excel file nahi ban payi: ${e.message}`)); } finally { setExporting(''); }
  };

  if (loading) return <div className="flex justify-center items-center min-h-[60vh]"><div className="animate-spin h-8 w-8 border-2 border-gray-900 rounded-full border-t-transparent"></div></div>;

  if (!program) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white border border-gray-200 rounded-2xl shadow-sm p-12">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{L('No Active Program', 'Koi active program nahi')}</h1>
          <p className="text-gray-500 mb-8 max-w-md mx-auto">{L("You haven't generated a training block yet. Complete your assessment and let the Iron Engine build your first 4 weeks.", 'Abhi tak koi training block nahi banaya. Assessment complete karo aur Iron Engine tumhare pehle 4 weeks bana dega.')}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/dashboard/assessment" className="inline-flex items-center justify-center bg-white border border-gray-200 text-gray-700 px-8 py-3.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">{L('Assessment', 'Assessment')}</Link>
            <Link to="/dashboard/generate" className="inline-flex items-center justify-center bg-gray-900 hover:bg-gray-800 text-white px-8 py-3.5 rounded-lg text-sm font-medium transition-colors">{L('Generate Program →', 'Program banao →')}</Link>
          </div>
        </motion.div>
      </div>
    );
  }

  const snap = applyAdjustments(program.program_snapshot, program.program_snapshot.adjustments);
  const { blockType, weeks, meta } = snap;
  const checkins = program.program_snapshot.adjustments?.checkins || {};
  const isBeg = meta?.form?.exp === 'beg';
  // Same rule as lib/schedule: without a meet a "can't train" skip is still owed, so it isn't ✓.
  const meetBlock = snap?.meta?.meetDays !== null && snap?.meta?.meetDays !== undefined;
  const logged = new Set(logs.filter((l) => meetBlock || trained(l)).map((l) => `${l.week_number}-${l.day_number}`));
  const sched = program?.program_snapshot ? planSchedule(snap, logs, program.created_at) : null; // adjusted plan, as Today and the logger use
  const attempts = weeks.some((w) => w.meetWeek) ? attemptPlan(meta?.maxes || {}, logs, meta?.form?.exp, meta?.form?.compLifts) : null;
  const LIGHT_DOT = { green: 'bg-green-500', yellow: 'bg-amber-400', red: 'bg-red-500' };
  const currentWeekData = weeks.find(w => w.week === activeWeek) || weeks[0];
  const currentDayData = currentWeekData.days.find(d => d.day === activeDay) || currentWeekData.days[0];
  const weekLocked = proWeekLocked(isPro, currentWeekData);
  const mains = weekLocked ? [] : currentDayData.exercises.filter((e) => e.type === 'Main');
  const accs = weekLocked ? [] : currentDayData.exercises.filter((e) => e.type !== 'Main');

  return (
    <>
      <style>{`@media print { body * { visibility: hidden; } #print-area, #print-area * { visibility: visible; } #print-area { position: absolute; left: 0; top: 0; width: 100%; } .no-print { display: none !important; } }`}</style>
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-8 md:py-12">
        <div className="flex items-start justify-between gap-4 mb-5 no-print">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{L('Your program', 'Tumhara program')}</p>
            <h1 className="text-2xl md:text-3xl font-semibold text-gray-900 tracking-tight">{blockType}</h1>
            <p className="text-sm text-gray-500 mt-1">{L(`${weeks.length} weeks`, `${weeks.length} weeks`)}{meta?.freq ? ` · ${meta.freq}` : ''}{meta?.maxes?.squat ? ` · maxes ${meta.maxes.squat}/${meta.maxes.bench}/${meta.maxes.deadlift} kg` : ''}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <details className="relative">
              <summary className="list-none cursor-pointer px-3 py-2 border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50" aria-label="Export">{L('Export', 'Export')}</summary>
              <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg p-1 z-20 shadow-lg">
                <button onClick={handlePrint} className="w-full text-left px-3 py-2 text-sm text-gray-700 rounded hover:bg-gray-50"><b className="block text-gray-900">PDF{!isPro && ' · 🔒 Pro'}</b><span className="text-xs text-gray-500">{L(`Whole block · ${weeks.length} weeks · print or save`, `Poora block · ${weeks.length} weeks · print ya save karo`)}</span></button>
                <button onClick={handleExcel} disabled={!!exporting} className="w-full text-left px-3 py-2 text-sm text-gray-700 rounded hover:bg-gray-50 disabled:opacity-50"><b className="block text-gray-900">{exporting ? L('Building…', 'Ban raha hai…') : 'Excel'}{!isPro && ' · 🔒 Pro'}</b><span className="text-xs text-gray-500">{L('One sheet per week + log columns', 'Har week ki ek sheet + log columns')}</span></button>
              </div>
            </details>
            <Link to="/dashboard/generate" className="px-3 py-2 border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50">{L('New block', 'Naya block')}</Link>
          </div>
        </div>

        <StalePlanBanner profile={program.athlete_profiles} program={program} className="mb-5" />
        <SeasonRoadmap program={program} />

        {(meta?.notes?.length > 0 || meta?.decisions?.length > 0) && (
          <details className="bg-white border border-gray-200 rounded-xl mb-6 no-print group">
            <summary className="list-none cursor-pointer px-4 py-3 flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-gray-900">{L('Why this plan', 'Ye plan kyun')}</span>
              <span className="text-xs text-gray-500 group-open:hidden">{L(`${(meta?.decisions?.length || 0) + (meta?.notes?.length || 0)} coaching decisions · tap to read`, `${(meta?.decisions?.length || 0) + (meta?.notes?.length || 0)} coaching decisions · padhne ke liye tap karo`)}</span>
              <span className="text-xs text-gray-500 hidden group-open:inline">{L('Hide', 'Chhupao')}</span>
            </summary>
            <div className="px-4 pb-4 space-y-3 text-sm">
              {meta?.decisions?.map((d, i) => (
                <div key={`d${i}`}><p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{d.step}</p><p className="text-gray-800"><b className="text-gray-900">{d.decision}</b> — {d.reason}</p></div>
              ))}
              {meta?.notes?.length > 0 && <div className="pt-2 border-t border-gray-100 space-y-1.5">{meta.notes.map((n, i) => <p key={`n${i}`} className="text-gray-700">• {n}</p>)}</div>}
              {meta?.rec?.note && <p className="text-gray-700">• {meta.rec.note}</p>}
            </div>
          </details>
        )}

        <div id="print-area">
          <div className="hidden print:block mb-8">
            <h1 className="text-2xl font-bold">{blockType} - LalitLifts Iron Engine</h1>
            <p className="text-gray-600">{L(`Week ${activeWeek} | Generated ${new Date(program.created_at).toLocaleDateString()}`, `Week ${activeWeek} | Bana ${new Date(program.created_at).toLocaleDateString()}`)}</p>
          </div>

          <div className="flex space-x-2 mb-6 overflow-x-auto pb-2 no-print">
            {weeks.map((w) => (
              <button key={w.week} onClick={() => { setActiveWeek(w.week); setActiveDay((w.days.find((d) => !d.rest) || w.days[0]).day); }} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap border ${activeWeek === w.week ? 'bg-gray-100 text-gray-900 border-gray-300' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                {checkins[String(w.week)] && <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${LIGHT_DOT[checkins[String(w.week)].light]}`} title={`Check-in: ${checkins[String(w.week)].light}`}></span>}
                {proWeekLocked(isPro, w) && <span className="mr-1" aria-label="Pro">🔒</span>}{w.label || `Week ${w.week}`}{w.meetWeek ? null : w.taper ? <span className="ml-1.5 text-[10px] uppercase tracking-wider opacity-75">{L('Taper', 'Taper')}</span> : w.deload ? <span className="ml-1.5 text-[10px] uppercase tracking-wider opacity-75">{L('Deload', 'Deload')}</span> : null}
              </button>
            ))}
          </div>

          <div className="flex space-x-2 mb-8 overflow-x-auto pb-2 no-print">
            {currentWeekData.days.map((d) => (
              <button key={d.day} onClick={() => setActiveDay(d.day)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeDay === d.day ? 'bg-gray-100 text-gray-900 ring-1 ring-gray-200' : 'text-gray-500 hover:bg-gray-50'}`}>
                {d.rest && <span className="text-gray-300 mr-1">○</span>}{logged.has(`${activeWeek}-${d.day}`) && <span className="text-green-600 mr-1">✓</span>}{d.weekday ? d.weekday.slice(0, 3) : `Day ${d.day}`}{d.date ? <span className="text-gray-400 ml-1 text-xs">{d.date}</span> : null}{(() => {
                  // Catching up (no meet): sessions slide to later training days — show where this one went.
                  const moved = sched?.projected?.get(`${activeWeek}-${d.day}`);
                  const lbl = moved ? moved.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : d.date;
                  return <>
                    {moved && lbl !== d.date && <span className="ml-1 text-[11px] font-semibold text-amber-600">→ {lbl}</span>}
                    {lbl === appNow().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) && <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wider text-red-500">{L('Today', 'Aaj')}</span>}
                  </>;
                })()} <span className="text-gray-400 ml-1 text-xs">{d.focus}</span>
              </button>
            ))}
          </div>

          {currentWeekData.adjusted && (
            <div className={`border rounded-xl p-4 mb-6 text-sm no-print ${currentWeekData.light === 'red' ? 'bg-red-50 border-red-200 text-red-900' : currentWeekData.light === 'yellow' ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-green-50 border-green-200 text-green-900'}`}>
              <p className="text-xs font-bold uppercase tracking-wider mb-1">{L("Adjusted from last week's check-in", 'Pichle week ke check-in se adjust kiya')}</p>
              {currentWeekData.adjustNotes?.map((n, i) => <p key={i}>{n}</p>)}
            </div>
          )}
          {!currentWeekData.meetWeek && !currentWeekData.taper && currentWeekData.days.filter((d) => !d.rest && !d.meetDay && !d.optional).every((d) => logged.has(`${activeWeek}-${d.day}`)) && !checkins[String(activeWeek)] && (
            <div className="bg-gray-900 text-white rounded-xl p-4 mb-6 flex items-center justify-between gap-4 flex-wrap no-print">
              <p className="text-sm">{L("Every session this week is logged. Do the 60-second check-in and the engine sets next week's kg.", 'Is week ke saare sessions log ho gaye. 60-second check-in karo, engine agle week ka kg set karega.')}</p>
              <Link to={`/dashboard/checkin?week=${activeWeek}`} className="bg-white text-gray-900 text-sm font-semibold px-4 py-2 rounded-lg whitespace-nowrap">{L('Weekly check-in →', 'Weekly check-in →')}</Link>
            </div>
          )}
          {isBeg && activeWeek === 1 && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 text-sm text-gray-700 space-y-1.5 no-print">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">{L('How to read this (beginner)', 'Ise kaise padhein (beginner)')}</p>
              <p>{L(<><b className="text-gray-900">kg, not %.</b> Do the weight written. If every rep was clean and you had 2+ reps left (RPE ≤ 8), add the jump next week. Missed a rep? Same weight next week.</>, <><b className="text-gray-900">kg dekho, % nahi.</b> Jo weight likha hai wahi karo. Har rep clean tha aur 2+ reps bache the (RPE ≤ 8), to agle week jump add karo. Rep miss hua? Agle week same weight.</>)}</p>
              <p>{L(<><b className="text-gray-900">Every rep = a competition rep.</b> Same setup, same depth, pause on the chest, full lockout. A rep you couldn't repeat on a platform doesn't count.</>, <><b className="text-gray-900">Har rep = competition rep.</b> Same setup, same depth, chest pe pause, full lockout. Jo rep platform pe repeat na ho sake, wo count nahi hota.</>)}</p>
              <p>{L(<><b className="text-gray-900">Warm-up:</b> bar × 8 → 40% × 5 → 55% × 3 → 70% × 2 → 80% × 1 → work sets. Warm-ups never tire you.</>, <><b className="text-gray-900">Warm-up:</b> bar × 8 → 40% × 5 → 55% × 3 → 70% × 2 → 80% × 1 → work sets. Warm-up se kabhi thakna nahi chahiye.</>)}</p>
              <p>{L(<><b className="text-gray-900">Fix one thing per week.</b> Film one set per session. Technique first — strength comes through it, not before it.</>, <><b className="text-gray-900">Har week ek cheez fix karo.</b> Har session ka ek set film karo. Pehle technique — strength usi se aati hai, usse pehle nahi.</>)}</p>
            </div>
          )}
          {currentWeekData.meetWeek ? (
            <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 text-sm text-gray-700 space-y-1.5 no-print">
              <p>{L(<><b className="text-gray-900">Meet week.</b> Nothing new, nothing heavy. Train the plan, trust the plan.</>, <><b className="text-gray-900">Meet week.</b> Kuch naya nahi, kuch heavy nahi. Plan follow karo, plan pe bharosa rakho.</>)}</p>
              {currentWeekData.weekNotes?.map((n, i) => <p key={i}>• {n}</p>)}
            </div>
          ) : currentWeekData.taper ? (
            <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 text-sm text-gray-700 no-print">
              {L(<><b className="text-gray-900">Taper.</b> Volume down 50–70%, intensity stays (77.5–85%), competition lifts trained together, accessories half. Sleep, eat, hydrate — fatigue leaves, strength stays.</>, <><b className="text-gray-900">Taper.</b> Volume 50–70% kam, intensity same (77.5–85%), competition lifts saath mein, accessories aadhe. Neend, khana, paani — thakaan jaati hai, strength rehti hai.</>)}
            </div>
          ) : currentWeekData.deload ? (
            <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 text-sm text-gray-700 no-print">
              {L(<><b className="text-gray-900">Deload week.</b> The weight will feel light — that's the point.{meta?.testDay ? ' Test Day comes the week after.' : ' Next block starts after this.'}</>, <><b className="text-gray-900">Deload week.</b> Weight halka lagega — yahi to point hai.{meta?.testDay ? ' Uske agle week Test Day hai.' : ' Iske baad agla block shuru.'}</>)}
            </div>
          ) : null}

          <AnimatePresence mode="wait">
            <motion.div key={`${activeWeek}-${activeDay}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="space-y-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{currentDayData.focus}{currentDayData.optional ? <span className="ml-2 text-xs font-medium text-gray-400">{L('optional · low stress', 'optional · low stress')}</span> : null}</h2>
                  {currentDayData.weekday && <p className="text-xs text-gray-500 uppercase tracking-wider">{currentDayData.weekday}{currentDayData.date ? ` ${currentDayData.date}` : ''} · {currentWeekData.label || `Week ${activeWeek}`}{currentWeekData.phase ? ` · ${currentWeekData.phase}` : ''}</p>}
                </div>
                {!currentDayData.meetDay && !currentDayData.rest && (() => {
                  // Every day can be viewed; only what Today offers can be started.
                  const lock = lockReason(sched, currentWeekData, currentDayData, program.created_at, isPro);
                  if (lock?.kind === 'pro') return <Link to="/dashboard/subscription" className="no-print bg-gray-900 hover:bg-gray-800 text-white text-sm font-semibold py-2.5 px-5 rounded-lg transition-colors">{L('🔒 Unlock with Pro', '🔒 Pro se unlock karo')}</Link>;
                  return lock
                    ? <div className="no-print text-right"><span className="inline-block bg-gray-100 text-gray-500 text-sm font-semibold py-2.5 px-5 rounded-lg cursor-not-allowed" aria-disabled="true">{L('Locked', 'Locked')}</span><p className="text-xs text-gray-500 mt-1.5 max-w-[16rem]">{lock.text}</p></div>
                    : <Link to={`/dashboard/workout?week=${activeWeek}&day=${activeDay}`} className="no-print bg-gray-900 hover:bg-gray-800 text-white text-sm font-semibold py-2.5 px-5 rounded-lg transition-colors">{L('Start Workout →', 'Workout shuru karo →')}</Link>;
                })()}
              </div>
              {weekLocked && (
                <div className="bg-white border border-gray-200 rounded-xl p-6 text-center">
                  <p className="text-3xl mb-2" aria-hidden="true">🔒</p>
                  <p className="text-lg font-bold text-gray-900">{L(`Week ${activeWeek} is part of Iron Engine Pro`, `Week ${activeWeek} Iron Engine Pro ka hissa hai`)}</p>
                  <p className="text-sm text-gray-600 mt-1 max-w-md mx-auto">{L("The free plan is Week 1. Pro unlocks the rest of this block — progression, deload, weekly check-ins that set next week's kg — and every block after it.", 'Free mein sirf Week 1 hai. Pro se is block ka baaki hissa — progression, deload, weekly check-ins jo agle week ka kg set karte hain — aur uske baad ke saare blocks unlock hote hain.')}</p>
                  <Link to="/dashboard/subscription" className="inline-block mt-4 bg-gray-900 hover:bg-gray-800 text-white text-sm font-semibold py-2.5 px-6 rounded-lg">{L('See Pro plans · from', 'Pro plans dekho · sirf')} ₹{(CONFIG.proPlans?.[0]?.price || 1499).toLocaleString('en-IN')} →</Link>
                </div>
              )}
              {!weekLocked && currentDayData.rest && (
                <div className="bg-white border border-dashed border-gray-300 rounded-xl p-6">
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">{currentDayData.focus}</p>
                  <p className="text-sm text-gray-700">{currentDayData.notes}</p>
                </div>
              )}
              {!weekLocked && currentDayData.meetDay && (
                <div className="bg-gray-900 text-white rounded-xl p-6">
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">{L('Meet day', 'Meet day')}</p>
                  <p className="text-sm">{currentDayData.notes}</p>
                  <p className="text-sm text-gray-300 mt-3">{L('Opener = a weight you make on any day (~90%). Second = your real lift. Third = a small PR only if the first two were clean.', 'Opener = wo weight jo kisi bhi din utha lo (~90%). Second = tumhari asli lift. Third = chhota PR, tabhi jab pehle do clean gaye.')}</p>
                  {attempts && (
                    <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {['squat', 'bench', 'deadlift'].filter((l) => attempts[l]).map((l) => (
                        <div key={l} className="bg-white/10 rounded-lg p-3">
                          <p className="text-xs font-bold uppercase tracking-wider text-gray-300">{LIFT_NAMES[l]}</p>
                          <p className="text-sm mt-1">1st <b>{attempts[l].opener}</b> · 2nd <b>{attempts[l].second}</b> · 3rd <b>{attempts[l].third}</b> kg</p>
                          <p className="text-[11px] text-gray-400 mt-1">{attempts[l].notes[0]}</p>
                        </div>
                      ))}
                      <p className="sm:col-span-3 text-xs text-gray-400">{attempts.rule} {L("These are the engine's suggestion from your 1RM and your logged singles — decide the 3rd after the 2nd.", 'Ye engine ka suggestion hai, tumhare 1RM aur logged singles se — 3rd ka faisla 2nd ke baad karo.')}</p>
                    </div>
                  )}
                </div>
              )}

              {mains.map((ex, idx) => (
                <div key={`m${idx}`} className="bg-white rounded-xl border border-gray-300 shadow-md p-5 md:p-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <span className="text-xs font-semibold uppercase tracking-wider text-gray-900">{L('Main', 'Main')}</span>
                      <h3 className="text-lg font-bold text-gray-900">{ex.name}</h3>
                      {ex.note && <p className="text-xs text-gray-500 mt-1">→ {ex.note}</p>}
                    </div>
                    <div className="flex items-center gap-6 md:gap-8">
                      <Stat label={L('Sets × Reps', 'Sets × Reps')} value={`${ex.sets} × ${ex.reps}`} />
                      <Stat label={L('Load', 'Weight')} value={ex.weight ? `${ex.weight} kg` : '—'} sub={ex.pct && meta?.form?.exp !== 'beg' ? `${ex.pct}%` : null} />
                      <Stat label="RPE" value={ex.rpe || '—'} />
                    </div>
                  </div>
                </div>
              ))}

              {accs.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 md:p-6">
                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">{L('Accessories', 'Accessories')}</span>
                  <div className="mt-3 divide-y divide-gray-100">
                    {accs.map((ex, idx) => (
                      <div key={`a${idx}`} className="py-2.5 flex items-center justify-between gap-4">
                        <span className={`text-sm ${ex.name.startsWith('Weak-point') ? 'font-semibold text-amber-700' : 'text-gray-800'}`}>{ex.name}</span>
                        <span className="text-sm font-mono text-gray-600 whitespace-nowrap">{ex.sets} × {ex.reps}{ex.rpe && ex.rpe !== '—' ? ` · RPE ${ex.rpe}` : ''}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 mt-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">{L('Execution Rules', 'Execution ke rules')}</h3>
                <div className="text-sm text-gray-600 space-y-1.5">
                  {[...EXECUTION_RULES, ...(meta?.testDay ? [TEST_DAY_RULE] : [])].map(([h, b, hHi, bHi]) => (
                    <p key={h}><b className="text-gray-800">{L(h, hHi)}:</b> {L(b, bHi)}</p>
                  ))}
                </div>
              </div>

              <div className="hidden print:block mt-8 text-sm text-gray-600 border-t pt-4"><p>{L('Log your workouts in the LalitLifts dashboard', 'Apne workouts LalitLifts dashboard mein log karo')}</p></div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}

const Stat = ({ label, value, sub }) => (
  <div className="text-center">
    <p className="text-[10px] text-gray-400 uppercase tracking-wider">{label}</p>
    <p className="text-sm font-semibold text-gray-900 mt-1 whitespace-nowrap">{value}</p>
    {sub && <p className="text-[11px] text-gray-500">{sub}</p>}
  </div>
);
