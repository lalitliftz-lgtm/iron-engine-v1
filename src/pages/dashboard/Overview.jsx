import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { Link } from 'react-router-dom';
import { applyAdjustments, attemptPlan } from '../../lib/autoreg';
import { LIFT_NAMES } from '../../lib/engine';
import StalePlanBanner from '../../components/dashboard/StalePlanBanner';
import { readDraft, draftSetsDone } from '../../lib/workoutDraft';
import { planSchedule, reentry, appNow, parseYmd, startOfDay, trained, proWeekLocked } from '../../lib/schedule';
import SessionActions from '../../components/dashboard/SessionActions';
import { seasonRoadmap } from '../../lib/roadmap';
import LessonCard from '../../components/dashboard/LessonCard';
import { useLang } from '../../lib/useLang';

export default function Overview() {
  const { user } = useAuth();
  const { L } = useLang();
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [dashboardData, setDashboardData] = useState({
    profile: null,
    subscription: null,
    program: null,
    activity: [],
    logs: []
  });

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!user) return;

      const [profileRes, subRes, programRes] = await Promise.all([
        supabase.from('athlete_profiles').select('full_name, competition_date, experience_level, training_days_per_week, squat_1rm, bench_1rm, deadlift_1rm, assessment_data, updated_at').eq('user_id', user.id).maybeSingle(),
        supabase.from('subscriptions').select('status, end_date').eq('user_id', user.id).eq('status', 'active').gte('end_date', new Date().toISOString()).order('end_date', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('generated_programs').select('id, created_at, program_snapshot').eq('user_id', user.id).eq('is_active', true).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ]);
      // Sessions already logged for THIS block decide what "today" is — not the calendar.
      const logsRes = programRes.data
        ? await supabase.from('workout_logs').select('date_completed, week_number, day_number, logged_exercises').eq('user_id', user.id).eq('program_id', programRes.data.id).order('date_completed', { ascending: false }).limit(60)
        : { data: [] };

      let activities = [];
      (logsRes.data || []).slice(0, 5).forEach((log) => activities.push({ type: 'workout', date: log.date_completed, text: `Week ${log.week_number} · Day ${log.day_number} logged` }));
      if (programRes.data) activities.push({ type: 'program', date: programRes.data.created_at, text: 'Block generated' });
      activities.sort((a, b) => new Date(b.date) - new Date(a.date));
      activities = activities.slice(0, 5);

      setDashboardData({ profile: profileRes.data, subscription: subRes.data, program: programRes.data, activity: activities, logs: logsRes.data || [] });
      setLoading(false);
    };

    fetchDashboardData();
  }, [user, reloadKey]);

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div></div>;

  const { profile, subscription, program, logs } = dashboardData;
  const isPro = subscription && new Date(subscription.end_date) > new Date();
  const firstName = profile?.full_name?.split(' ')[0] || 'Athlete';
  const hasMeet = profile?.competition_date;
  const daysToMeet = hasMeet ? Math.round((parseYmd(hasMeet) - startOfDay(appNow())) / 864e5) : null;

  const snap = program ? applyAdjustments(program.program_snapshot, program.program_snapshot.adjustments) : null;
  const checkins = program?.program_snapshot?.adjustments?.checkins || {};
  const currentBlock = snap?.blockType || null;
  const totalWeeks = snap?.weeks?.length || 4;
  // Next session = first session of the block that has no log yet (skipped days shift the plan, they don't vanish).
  // A "can't train" skip closes a session only in a meet block; without a meet it is still owed (same rule as lib/schedule).
  const meetBlock = snap?.meta?.meetDays !== null && snap?.meta?.meetDays !== undefined;
  const done = new Set(logs.filter((l) => meetBlock || trained(l)).map((l) => `${l.week_number}-${l.day_number}`));
  // An unfinished session in this browser (same block, day not logged yet) → Resume instead of Start.
  const savedDraft = readDraft(user.id);
  const draft = savedDraft && program && savedDraft.programId === program.id && !done.has(`${savedDraft.week}-${savedDraft.day}`) ? savedDraft : null;
  // Missed days, breaks and meet calendars are handled in lib/schedule.js.
  const sched = snap ? planSchedule(snap, logs, program.created_at) : null;
  const next = sched?.next || null;
  const blockDone = !!snap && !next;
  const back = sched ? reentry(sched.gapDays) : null;
  // What the season roadmap says comes next (named on the "block finished" card).
  const nextBlockName = snap ? seasonRoadmap(snap, program.created_at, profile?.competition_date, snap.meta?.form?.exp, profile?.assessment_data?.meet_date_status === 'approx')?.blocks?.[1]?.name || null : null;
  const fmtDay = (d) => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  // Where the next session really falls: its own date, or — while catching up — the day it slid to.
  const nextWhen = next ? (sched?.projected?.get(next.key) ? fmtDay(sched.projected.get(next.key)) : `${next.day.weekday || ''} ${next.day.date || ''}`.trim()) : '';
  // A finished training week with no check-in yet → ask for it (Pro). The latest such week wins.
  let checkinWeek = null;
  for (const w of snap?.weeks || []) {
    if (w.meetWeek || w.taper) continue;
    const trainDays = (w.days || []).filter((d) => !d.rest && !d.meetDay && !d.optional); // optional days never hold up the check-in
    const allLogged = trainDays.length && trainDays.every((d) => done.has(`${w.week}-${d.day}`));
    if (allLogged && !checkins[String(w.week)]) checkinWeek = w.week;
  }
  const attempts = snap && daysToMeet !== null && daysToMeet <= 14 && daysToMeet >= 0 ? attemptPlan(snap.meta?.maxes || {}, logs, snap.meta?.form?.exp, snap.meta?.form?.compLifts) : null;
  const currentWeek = next ? next.week.week : totalWeeks;
  const nextMains = next ? next.day.exercises.filter((e) => e.type === 'Main').slice(0, 3) : [];
  const sessionsDone = sched?.sessionsDone || 0;
  const sessionsTotal = sched?.sessionsTotal || 0;
  // Last logged main-lift top sets (what a coach glances at)
  const lastLog = logs[0];
  const lastTop = (lastLog?.logged_exercises || []).filter((e) => e.type === 'Main' && !e.skipped).map((e) => {
    const sets = (e.loggedSets || []).filter((s) => s.completed && s.weight);
    if (!sets.length) return null;
    const top = sets.reduce((a, b) => (Number(b.weight) > Number(a.weight) ? b : a));
    return `${e.name} ${top.weight}×${top.reps}${top.rpe ? ` @${top.rpe}` : ''}`;
  }).filter(Boolean);

  // What does the calendar say about TODAY? (rest day, meet day, or a training day)
  const todayLabel = appNow().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const todayEntry = (snap?.weeks || []).flatMap((w) => (w.days || []).map((d) => ({ w, d }))).find(({ d }) => d.date === todayLabel);
  const restToday = todayEntry?.d.rest ? todayEntry.d : null;
  const progressPct = sessionsTotal ? Math.min(100, Math.round((sessionsDone / sessionsTotal) * 100)) : 0;

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-8 py-6 md:py-10 space-y-5">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{appNow().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1 className="text-2xl md:text-3xl font-semibold text-gray-900 tracking-tight">{L(`Hi ${firstName}`, `Hi ${firstName}`)}</h1>
        </div>
        {!isPro && <Link to="/dashboard/subscription" className="text-xs font-semibold text-blue-600">{L('Free plan · Go Pro', 'Free plan · Pro lo')}</Link>}
      </header>

      <StalePlanBanner profile={profile} program={program} />

      {/* 1 — the one thing to do now */}
      <section className="bg-white border border-gray-200 rounded-2xl p-5 md:p-6">
        {program && next && proWeekLocked(isPro, next.week) ? (
          <>
            {/* Free plan = Week 1. Week 2 onward is Pro. */}
            <p className="text-xs font-semibold uppercase tracking-wider text-green-700">{L(`Free week over · ${sessionsDone} session${sessionsDone === 1 ? '' : 's'} logged`, `Free week khatam · ${sessionsDone} session log hue`)}</p>
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 mt-1">{L(`Week ${next.week.week} is ready — unlock it with Pro`, `Week ${next.week.week} ready hai — Pro se unlock karo`)}</h2>
            <p className="text-sm text-gray-600 mt-1">{L("Your free week is over. Pro unlocks the rest of this block (progression, deload, weekly check-ins that set next week's kg) and every block after it.", 'Free mein Week 1 tha, wo khatam. Pro se is block ka baaki hissa (progression, deload, weekly check-ins jo agle week ka kg set karte hain) aur uske baad ke saare blocks unlock hote hain.')}</p>
            <Link to="/dashboard/subscription" className="mt-5 block w-full bg-gray-900 hover:bg-gray-800 text-white text-base font-semibold py-3.5 rounded-xl text-center">{L(`🔒 Unlock Week ${next.week.week} with Pro`, `🔒 Week ${next.week.week} Pro se unlock karo`)}</Link>
          </>
        ) : program && draft ? (
          <>
            <p className="text-xs font-semibold uppercase tracking-wider text-green-700">{L('Session in progress', 'Session chal raha hai')}</p>
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 mt-1">{draft.focus || `Week ${draft.week} · Day ${draft.day}`}</h2>
            <p className="text-sm text-gray-500 mt-1">{L(`${draftSetsDone(draft)} set${draftSetsDone(draft) === 1 ? '' : 's'} ticked so far.`, `Ab tak ${draftSetsDone(draft)} set tick hue.`)}</p>
            <Link to={`/dashboard/workout?week=${draft.week}&day=${draft.day}`} className="mt-5 block w-full bg-gray-900 hover:bg-gray-800 text-white text-base font-semibold py-3.5 rounded-xl text-center">{L('Resume session', 'Session continue karo')}</Link>
          </>
        ) : program && sched?.when === 'today' ? (
          <>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              {sched.rolling ? L('Today · catching up', 'Aaj · catch-up') : next.day.optional ? L('Today · optional session', 'Aaj · optional session') : L("Today's session", 'Aaj ka session')} · {next.week.label || `Week ${currentWeek}`}{next.day.weekday ? ` · ${sched.rolling ? L('planned ', 'plan tha ') : ''}${next.day.weekday} ${next.day.date || ''}` : ''}
            </p>
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 mt-1">{next.day.focus}</h2>
            {next.day.optional && <p className="text-sm text-gray-500 mt-1">{L('Optional — technique and conditioning. Do it if you feel fresh; skipping it costs nothing.', 'Optional — technique aur conditioning. Fresh feel ho to karo; skip karne se koi nuksaan nahi.')}</p>}
            {sched.rolling && (
              <p className="mt-3 bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-800">
                {L(`Missed a session? Pick up where you left off — this is the one you missed. Every later session moves along${sched.newEnd ? `, so the block now ends ${fmtDay(sched.newEnd)}` : ''}. Nothing is lost.`, `Session miss ho gaya? Jahan chhoda tha wahi se shuru karo — ye wahi missed session hai. Baaki saare sessions aage khisak gaye${sched.newEnd ? `, ab block ${fmtDay(sched.newEnd)} ko khatam hoga` : ''}. Kuch nahi gaya.`)}
              </p>
            )}
            {(back || sched.droppedForMeet > 0 || sched.repeatLifts.length > 0) && (
              <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-700 space-y-1">
                {back && <p>{back.text}{back.rebuild && <> <Link to="/dashboard/generate" className="underline font-semibold">{L('Build a fresh block', 'Naya block banao')}</Link></>}</p>}
                {sched.droppedForMeet > 0 && <p>{L(`${sched.droppedForMeet} missed session${sched.droppedForMeet > 1 ? 's' : ''} left behind — your meet date doesn't move, so the plan continues with today's session. Light sessions are simply skipped; a missed hard one can be made up on a free day in the same week.`, `${sched.droppedForMeet} missed session peeche chhoot gaye — meet date nahi hilti, isliye plan aaj ke session se aage chalega. Light sessions bas skip ho jaate hain; missed heavy session usi week ke kisi free day pe kar sakte ho.`)}</p>}
                {sched.repeatLifts.length > 0 && <p>{L(`You already trained ${sched.repeatLifts.map((l) => LIFT_NAMES[l]).join(' and ')} today. This session has it again — the same lift needs ~48 h between hard sessions.`, `Aaj tum ${sched.repeatLifts.map((l) => LIFT_NAMES[l]).join(' aur ')} already kar chuke ho. Is session mein wo fir hai — same lift ko do heavy sessions ke beech ~48 h chahiye.`)}</p>}
              </div>
            )}
            <div className="mt-4 divide-y divide-gray-100">
              {nextMains.map((m, i) => (
                <div key={i} className="flex items-baseline justify-between gap-3 py-2">
                  <span className="text-sm font-semibold text-gray-900">{m.name}</span>
                  <span className="text-sm font-mono text-gray-700 whitespace-nowrap">{m.sets} × {m.reps}{m.weight ? ` · ${m.weight} kg` : ''}</span>
                </div>
              ))}
              {nextMains.length === 0 && <p className="text-sm text-gray-500 py-2">{L('Accessories + technique day', 'Accessories + technique day')}</p>}
            </div>
            <Link to={`/dashboard/workout?week=${next.week.week}&day=${next.day.day}`} className="mt-5 block w-full bg-gray-900 hover:bg-gray-800 text-white text-base font-semibold py-3.5 rounded-xl text-center">{L('Start session', 'Session shuru karo')}</Link>
            {sched.easier && (
              <p className="mt-3 text-sm text-gray-600">
                {L('Rough day? ', 'Aaj mood nahi? ')}<Link to={`/dashboard/workout?week=${sched.easier.week.week}&day=${sched.easier.day.day}`} className="font-semibold text-gray-900 underline">{L(`Do the easier ${sched.easier.day.focus} today instead`, `Aaj easy wala ${sched.easier.day.focus} kar lo`)}</Link>{L(' — this one moves to your next training day.', ' — ye wala agle training day pe chala jayega.')}
              </p>
            )}
            <SessionActions programId={program.id} week={next.week} day={next.day} meetLocked={sched.meetLocked} onDone={() => setReloadKey((k) => k + 1)} />
          </>
        ) : program && sched?.blockOver ? (
          <>
            {/* The block's calendar is over: the next block is due, whatever got logged. */}
            <p className="text-xs font-semibold uppercase tracking-wider text-green-700">{L('Block finished', 'Block khatam')} · {sched.blockEnd.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>
            <h2 className="text-xl font-bold text-gray-900 mt-1">{L(`Time for your next block${nextBlockName ? `: ${nextBlockName}` : ''}.`, `Ab agle block ka time${nextBlockName ? `: ${nextBlockName}` : ''}.`)}</h2>
            <p className="text-sm text-gray-500 mt-1">
              {L(`${sessionsDone} of ${sessionsTotal} sessions logged. The engine reviews them (RPE, misses, check-ins) and builds the next block${profile?.competition_date ? ' for the time left to your meet.' : ' from your results.'}`, `${sessionsTotal} mein se ${sessionsDone} sessions log hue. Engine inko review karta hai (RPE, misses, check-ins) aur agla block banata hai${profile?.competition_date ? ' — meet tak jitna time bacha hai uske hisaab se.' : ' — tumhare results se.'}`)}
            </p>
            <Link to="/dashboard/generate" className="mt-5 block w-full bg-gray-900 hover:bg-gray-800 text-white text-base font-semibold py-3.5 rounded-xl text-center">{L('Build next block', 'Agla block banao')}</Link>
          </>
        ) : program && next && sched.when !== 'overdue' ? (
          <>
            {/* No workout today: nothing to start. Just what today is and what comes next. */}
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{L('Today', 'Aaj')}</p>
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 mt-1">
              {sched.skippedToday ? (sched.meetLocked ? L('Skipped today', 'Aaj skip kiya') : L('Skipped today — it moves to your next training day', 'Aaj skip kiya — ye agle training day pe chala jayega')) : sched.todayDone ? L("Today's session is done ✓", 'Aaj ka session ho gaya ✓') : sched.startsOn ? L(`Your block starts ${sched.startsOn.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}`, `Tumhara block ${sched.startsOn.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })} se shuru hoga`) : L('Rest day', 'Rest day')}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {sched.skippedToday ? L('Rest up. Nothing is lost — pick up where you left off next time.', 'Aaram karo. Kuch nahi gaya — agli baar jahan chhoda wahi se shuru karna.') : sched.todayDone ? L('Recover: eat, sleep, walk.', 'Recover karo: khao, so jao, walk karo.') : restToday?.notes || L('No workout today. Rest is when you actually get stronger.', 'Aaj koi workout nahi. Strength asal mein rest ke time hi banti hai.')}
            </p>
            {!sched.todayDone && sched.catchUp && (
              <div className="mt-3 bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-800">
                <p>{L(`You're ${sched.behind} session${sched.behind > 1 ? 's' : ''} behind — the plan has moved along, nothing is lost. Feeling fresh? You can catch up today (optional), otherwise rest.`, `Tum ${sched.behind} session peeche ho — plan aage khisak gaya hai, kuch nahi gaya. Fresh feel ho raha hai? Aaj catch up kar sakte ho (optional), warna rest karo.`)}</p>
                <Link to={`/dashboard/workout?week=${sched.catchUp.week.week}&day=${sched.catchUp.day.day}`} className="mt-2 inline-block bg-gray-900 text-white text-sm font-semibold px-4 py-2 rounded-lg">{L('Catch up', 'Catch up karo')}: {sched.catchUp.day.focus}</Link>
              </div>
            )}
            {!sched.todayDone && sched.makeUp && (
              <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
                <p>{L(`You missed ${sched.makeUp.day.weekday} ${sched.makeUp.day.date} — ${sched.makeUp.day.focus}. Your meet date can't move, so you can make it up today, main lifts 5% lighter (optional).`, `Tumne ${sched.makeUp.day.weekday} ${sched.makeUp.day.date} miss kiya — ${sched.makeUp.day.focus}. Meet date nahi hil sakti, to aaj make up kar lo, main lifts 5% halke (optional).`)}</p>
                <Link to={`/dashboard/workout?week=${sched.makeUp.week.week}&day=${sched.makeUp.day.day}`} className="mt-2 inline-block bg-gray-900 text-white text-sm font-semibold px-4 py-2 rounded-lg">{L('Make it up today', 'Aaj make up karo')}</Link>
              </div>
            )}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{L('Next workout', 'Agla workout')} · {nextWhen}</p>
              <p className="text-sm font-semibold text-gray-900 mt-1">{next.day.focus}</p>
              {sched.optionalBefore && <p className="text-xs text-gray-500 mt-1">{L('Optional before that', 'Usse pehle optional')}: {sched.optionalBefore.day.weekday} {sched.optionalBefore.day.date} · {sched.optionalBefore.day.focus}</p>}
            </div>
          </>
        ) : program && next ? (
          <>
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">{L("This block's dates have passed", 'Is block ki dates nikal gayi')}</p>
            <h2 className="text-xl font-bold text-gray-900 mt-1">{L('Time for a fresh block.', 'Naye block ka time.')}</h2>
            <p className="text-sm text-gray-500 mt-1">{L('The remaining sessions were planned for dates that are gone. Build a new block from where you are now — your logs carry over.', 'Baaki sessions jin dates ke liye plan the wo nikal gayi. Ab jahan ho wahan se naya block banao — tumhare logs saath aayenge.')}</p>
            <Link to="/dashboard/generate" className="mt-5 block w-full bg-gray-900 hover:bg-gray-800 text-white text-base font-semibold py-3.5 rounded-xl text-center">{L('Build a fresh block', 'Naya block banao')}</Link>
          </>
        ) : blockDone && sched?.noneLeftBeforeMeet ? (
          <>
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">{L('No sessions left before the meet', 'Meet se pehle koi session nahi bacha')}</p>
            <h2 className="text-xl font-bold text-gray-900 mt-1">{L('The remaining dates have passed.', 'Baaki dates nikal gayi.')}</h2>
            <p className="text-sm text-gray-500 mt-1">{L('Rest, stay loose, and follow the meet-day plan. If the meet moved, update the date and build a new block.', 'Rest karo, body loose rakho aur meet-day plan follow karo. Meet aage-peeche hua to date update karke naya block banao.')}</p>
            <Link to="/dashboard/assessment" className="mt-5 block w-full bg-gray-900 hover:bg-gray-800 text-white text-base font-semibold py-3.5 rounded-xl text-center">{L('Update meet date', 'Meet date update karo')}</Link>
          </>
        ) : blockDone ? (
          <>
            <p className="text-xs font-semibold uppercase tracking-wider text-green-700">{L('Block complete', 'Block complete')}</p>
            <h2 className="text-xl font-bold text-gray-900 mt-1">{sessionsDone >= sessionsTotal ? L('Every session is logged.', 'Saare sessions log ho gaye.') : L(`No sessions left in this block — ${sessionsDone} of ${sessionsTotal} logged.`, `Is block mein koi session nahi bacha — ${sessionsTotal} mein se ${sessionsDone} log hue.`)}</h2>
            <p className="text-sm text-gray-500 mt-1">{L('The engine reviews this block (RPE, misses, check-ins) and builds the next one from it.', 'Engine is block ko review karta hai (RPE, misses, check-ins) aur usi se agla block banata hai.')}</p>
            <Link to="/dashboard/generate" className="mt-5 block w-full bg-gray-900 hover:bg-gray-800 text-white text-base font-semibold py-3.5 rounded-xl text-center">{L('Build next block', 'Agla block banao')}</Link>
          </>
        ) : (
          <>
            <h2 className="text-xl font-bold text-gray-900">{L('No block yet', 'Abhi koi block nahi')}</h2>
            <p className="text-sm text-gray-500 mt-1">{L('Answer the assessment (about 5 min) and the engine builds your first block around your numbers, weak points and meet date.', 'Assessment bharo (bas 5 min) aur engine tumhare numbers, weak points aur meet date ke hisaab se pehla block banayega.')}</p>
            <Link to="/dashboard/generate" className="mt-5 block w-full bg-gray-900 hover:bg-gray-800 text-white text-base font-semibold py-3.5 rounded-xl text-center">{L('Build my block', 'Mera block banao')}</Link>
          </>
        )}
      </section>

      {/* New lifters: one coach tip a day (beginner block, or "explain RPE to me" in the assessment). */}
      {(snap?.meta?.form?.exp === 'beg' || String(profile?.assessment_data?.rpe_experience) === 'false') && <LessonCard />}

      {/* 2 — only when it's due */}
      {checkinWeek && (
        <section className="bg-amber-50 border border-amber-300 rounded-2xl p-5 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">{L(`Week ${checkinWeek} done`, `Week ${checkinWeek} ho gaya`)}</p>
            <p className="text-sm text-gray-800 mt-0.5">{isPro ? L("60-second check-in → the engine sets next week's kg.", '60-second check-in → engine agle week ka kg set karega.') : L("Pro: a 60-second weekly check-in sets next week's kg from how this week went.", 'Pro: 60-second weekly check-in se, ye week kaisa gaya uske hisaab se agle week ka kg set hota hai.')}</p>
          </div>
          <Link to={isPro ? `/dashboard/checkin?week=${checkinWeek}` : '/dashboard/subscription'} className="text-sm font-semibold border border-amber-300 text-amber-800 px-4 py-2 rounded-lg whitespace-nowrap">{isPro ? L('Check in', 'Check-in karo') : L('🔒 Go Pro', '🔒 Pro lo')}</Link>
        </section>
      )}

      {/* 3 — meet */}
      {hasMeet && daysToMeet !== null && daysToMeet >= 0 && (
        <section className="bg-white border border-gray-200 rounded-2xl p-5">
          <div className="flex items-baseline gap-3">
            <span className="text-4xl font-bold text-gray-900 tabular-nums" style={{ fontFamily: "'Archivo Black', sans-serif" }}>{daysToMeet}</span>
            <span className="text-sm text-gray-500">{profile?.assessment_data?.meet_date_status === 'approx' ? L('days to the earliest likely meet date', 'din, sabse jaldi possible meet date tak') : daysToMeet === 0 ? L('Meet day — go get it', 'Meet day — jao, phod do') : L('days to your meet', 'din meet tak')}</span>
          </div>
          {profile?.assessment_data?.meet_date_status === 'approx' && (
            <Link to="/dashboard/assessment" className="inline-block mt-3 text-sm font-semibold text-blue-600">{L('Date announced? Update it → exact taper', 'Date aa gayi? Update karo → exact taper')}</Link>
          )}
          {attempts && (
            <div className="mt-4 pt-4 border-t border-gray-100 space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{L('Suggested attempts (kg)', 'Suggested attempts (kg)')}</p>
              {['squat', 'bench', 'deadlift'].filter((l) => attempts[l]).map((l) => (
                <div key={l} className="flex justify-between text-sm"><span className="text-gray-500">{LIFT_NAMES[l]}</span><span className="font-mono text-gray-900">{attempts[l].opener} · {attempts[l].second} · {attempts[l].third}</span></div>
              ))}
              <p className="text-xs text-gray-500 pt-1">{attempts.rule}</p>
            </div>
          )}
        </section>
      )}

      {/* 4 — where you are in the block */}
      {currentBlock && (
        <section className="bg-white border border-gray-200 rounded-2xl p-5">
          <div className="flex justify-between items-baseline gap-3 mb-2">
            <p className="text-sm font-semibold text-gray-900">{currentBlock}</p>
            <span className="text-xs text-gray-500 whitespace-nowrap tabular-nums">{sessionsDone}/{sessionsTotal} {L('sessions', 'sessions')}</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2" role="progressbar" aria-valuenow={progressPct} aria-valuemin="0" aria-valuemax="100">
            <div className="h-2 rounded-full transition-all duration-500" style={{ width: `${progressPct}%`, background: 'var(--ll-good)' }}></div>
          </div>
          <div className="flex justify-between mt-3 text-sm">
            <span className="text-gray-500">{L(`Week ${currentWeek} of ${totalWeeks}`, `Week ${currentWeek} / ${totalWeeks}`)}</span>
            <Link to="/dashboard/programs" className="font-semibold text-gray-900">{L('Full program →', 'Poora program →')}</Link>
          </div>
        </section>
      )}

      {/* 5 — last session */}
      {lastTop.length > 0 && (
        <section className="bg-white border border-gray-200 rounded-2xl p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">{L('Last session · top sets', 'Pichla session · top sets')}</p>
          <div className="space-y-1">{lastTop.map((t, i) => <p key={i} className="text-sm font-mono text-gray-800">{t}</p>)}</div>
          <Link to="/dashboard/history" className="inline-block mt-3 text-sm font-semibold text-gray-900">{L('All sessions →', 'Saare sessions →')}</Link>
        </section>
      )}
    </div>
  );
}
