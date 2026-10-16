import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { Link } from 'react-router-dom';
import { applyAdjustments, attemptPlan } from '../../lib/autoreg';
import { LIFT_NAMES } from '../../lib/engine';
import StalePlanBanner from '../../components/dashboard/StalePlanBanner';
import { readDraft, draftSetsDone } from '../../lib/workoutDraft';
import { planSchedule, reentry } from '../../lib/schedule';
import SessionActions from '../../components/dashboard/SessionActions';

export default function Overview() {
  const { user } = useAuth();
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
  const daysToMeet = hasMeet ? Math.ceil((new Date(hasMeet) - new Date()) / (1000 * 60 * 60 * 24)) : null;

  const snap = program ? applyAdjustments(program.program_snapshot, program.program_snapshot.adjustments) : null;
  const checkins = program?.program_snapshot?.adjustments?.checkins || {};
  const currentBlock = snap?.blockType || null;
  const totalWeeks = snap?.weeks?.length || 4;
  // Next session = first session of the block that has no log yet (skipped days shift the plan, they don't vanish).
  const done = new Set(logs.map((l) => `${l.week_number}-${l.day_number}`));
  // An unfinished session in this browser (same block, day not logged yet) → Resume instead of Start.
  const savedDraft = readDraft(user.id);
  const draft = savedDraft && program && savedDraft.programId === program.id && !done.has(`${savedDraft.week}-${savedDraft.day}`) ? savedDraft : null;
  // Missed days, breaks and meet calendars are handled in lib/schedule.js.
  const sched = snap ? planSchedule(snap, logs, program.created_at) : null;
  const next = sched?.next || null;
  const blockDone = !!snap && !next;
  const back = sched ? reentry(sched.gapDays) : null;
  // Only the last week's misses are worth a mention; older ones simply count as missed in the block review.
  const weekAgo = new Date(new Date().setHours(0, 0, 0, 0) - 7 * 864e5);
  const recentMissed = sched && sched.when !== 'overdue' ? sched.missed.filter((m) => m.at && m.at >= weekAgo).slice(-3) : [];
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
  const todayLabel = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const todayEntry = (snap?.weeks || []).flatMap((w) => (w.days || []).map((d) => ({ w, d }))).find(({ d }) => d.date === todayLabel);
  const restToday = todayEntry?.d.rest ? todayEntry.d : null;
  const progressPct = sessionsTotal ? Math.min(100, Math.round((sessionsDone / sessionsTotal) * 100)) : 0;

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-8 py-6 md:py-10 space-y-5">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1 className="text-2xl md:text-3xl font-semibold text-gray-900 tracking-tight">Hi {firstName}</h1>
        </div>
        {!isPro && <Link to="/dashboard/subscription" className="text-xs font-semibold text-blue-600">Free plan · Go Pro</Link>}
      </header>

      <StalePlanBanner profile={profile} program={program} />

      {/* 1 — the one thing to do now */}
      <section className="bg-white border border-gray-200 rounded-2xl p-5 md:p-6">
        {program && next ? (
          <>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              {sched.when === 'today' ? (next.day.optional ? "Today · optional session" : "Today's session")
                : sched.when === 'overdue' ? `Pending session · planned ${next.day.date}`
                : sched.todayDone ? "Today's session done ✓ · next"
                : restToday || sched.todayRest ? 'Rest day today · next session'
                : 'Next session'} · {next.week.label || `Week ${currentWeek}`}{sched.when !== 'overdue' && next.day.weekday ? ` · ${next.day.weekday}${next.day.date ? ' ' + next.day.date : ''}` : ''}
            </p>
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 mt-1">{next.day.focus}</h2>
            {restToday && <p className="text-sm text-gray-500 mt-1">{restToday.notes}</p>}
            {sched.when === 'today' && next.day.optional && !draft && (
              <p className="text-sm text-gray-500 mt-1">Optional — technique and conditioning. Do it if you feel fresh; skipping it costs nothing.</p>
            )}
            {sched.when === 'upcoming' && !restToday && !draft && (
              <p className="text-sm text-gray-500 mt-1">
                {sched.startsOn
                  ? `Your block starts ${sched.startsOn.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}. Rest until then — or start early if you're keen; the plan just moves up.`
                  : `${sched.todayDone ? 'Recover today — this one is up next.' : 'Nothing planned for today.'} Training early is fine if you feel fresh; the plan just moves up.`}
              </p>
            )}
            {sched.optionalBefore && !draft && (
              <p className="text-sm text-gray-500 mt-2">
                Optional before that: {sched.optionalBefore.day.weekday} {sched.optionalBefore.day.date} · {sched.optionalBefore.day.focus}.{' '}
                <Link to={`/dashboard/workout?week=${sched.optionalBefore.week.week}&day=${sched.optionalBefore.day.day}`} className="font-semibold text-gray-900 underline">Open</Link>
              </p>
            )}
            {!draft && (back || recentMissed.length > 0 || sched.droppedForMeet > 0 || sched.repeatLifts.length > 0) && (
              <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-700 space-y-1">
                {back && <p>{back.text}{back.rebuild && <> <Link to="/dashboard/generate" className="underline font-semibold">Build a fresh block</Link></>}</p>}
                {recentMissed.length > 0 && (
                  <p>
                    Missed: {recentMissed.map((m) => `${m.day.weekday || ''} ${m.day.date} ${m.day.focus}`.trim()).join(', ')}. Do it on a free day if you feel fresh (never two in one day), or just leave it.{' '}
                    <Link to={`/dashboard/workout?week=${recentMissed[recentMissed.length - 1].week.week}&day=${recentMissed[recentMissed.length - 1].day.day}`} className="underline font-semibold">Do it instead</Link>
                  </p>
                )}
                {sched.droppedForMeet > 0 && <p>{sched.droppedForMeet} missed session{sched.droppedForMeet > 1 ? 's' : ''} left behind — your meet date doesn't move, so the plan continues with today's session. Don't try to make them up.</p>}
                {sched.repeatLifts.length > 0 && <p>You already trained {sched.repeatLifts.map((l) => LIFT_NAMES[l]).join(' and ')} today. This session has it again — best tomorrow; the same lift needs ~48 h between hard sessions.</p>}
              </div>
            )}
            <div className="mt-4 divide-y divide-gray-100">
              {nextMains.map((m, i) => (
                <div key={i} className="flex items-baseline justify-between gap-3 py-2">
                  <span className="text-sm font-semibold text-gray-900">{m.name}</span>
                  <span className="text-sm font-mono text-gray-700 whitespace-nowrap">{m.sets} × {m.reps}{m.weight ? ` · ${m.weight} kg` : ''}</span>
                </div>
              ))}
              {nextMains.length === 0 && <p className="text-sm text-gray-500 py-2">Accessories + technique day</p>}
            </div>
            {draft ? (
              <>
                <p className="mt-5 text-xs text-green-600">In progress{draft.focus ? ` · W${draft.week} D${draft.day} ${draft.focus}` : ''} · {draftSetsDone(draft)} set{draftSetsDone(draft) === 1 ? '' : 's'} ticked</p>
                <Link to={`/dashboard/workout?week=${draft.week}&day=${draft.day}`} className="mt-2 block w-full bg-gray-900 hover:bg-gray-800 text-white text-base font-semibold py-3.5 rounded-xl text-center">Resume session</Link>
              </>
            ) : (
              <>
                <Link to={`/dashboard/workout?week=${next.week.week}&day=${next.day.day}`} className="mt-5 block w-full bg-gray-900 hover:bg-gray-800 text-white text-base font-semibold py-3.5 rounded-xl text-center">Start session</Link>
                <SessionActions programId={program.id} week={next.week} day={next.day} onDone={() => setReloadKey((k) => k + 1)} />
              </>
            )}
          </>
        ) : blockDone && sched?.noneLeftBeforeMeet ? (
          <>
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">No sessions left before the meet</p>
            <h2 className="text-xl font-bold text-gray-900 mt-1">The remaining dates have passed.</h2>
            <p className="text-sm text-gray-500 mt-1">Rest, stay loose, and follow the meet-day plan. If the meet moved, update the date and build a new block.</p>
            <Link to="/dashboard/assessment" className="mt-5 block w-full bg-gray-900 hover:bg-gray-800 text-white text-base font-semibold py-3.5 rounded-xl text-center">Update meet date</Link>
          </>
        ) : blockDone ? (
          <>
            <p className="text-xs font-semibold uppercase tracking-wider text-green-700">Block complete</p>
            <h2 className="text-xl font-bold text-gray-900 mt-1">Every session is logged.</h2>
            <p className="text-sm text-gray-500 mt-1">The engine reviews this block (RPE, misses, check-ins) and builds the next one from it.</p>
            <Link to="/dashboard/generate" className="mt-5 block w-full bg-gray-900 hover:bg-gray-800 text-white text-base font-semibold py-3.5 rounded-xl text-center">Build next block</Link>
          </>
        ) : (
          <>
            <h2 className="text-xl font-bold text-gray-900">No block yet</h2>
            <p className="text-sm text-gray-500 mt-1">Answer the assessment (2–3 min) and the engine builds your first block around your numbers, weak points and meet date.</p>
            <Link to="/dashboard/generate" className="mt-5 block w-full bg-gray-900 hover:bg-gray-800 text-white text-base font-semibold py-3.5 rounded-xl text-center">Build my block</Link>
          </>
        )}
      </section>

      {/* 2 — only when it's due */}
      {checkinWeek && (
        <section className="bg-amber-50 border border-amber-300 rounded-2xl p-5 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">Week {checkinWeek} done</p>
            <p className="text-sm text-gray-800 mt-0.5">60-second check-in → the engine sets next week's kg.</p>
          </div>
          <Link to={`/dashboard/checkin?week=${checkinWeek}`} className="text-sm font-semibold border border-amber-300 text-amber-800 px-4 py-2 rounded-lg whitespace-nowrap">Check in</Link>
        </section>
      )}

      {/* 3 — meet */}
      {hasMeet && daysToMeet !== null && daysToMeet >= 0 && (
        <section className="bg-white border border-gray-200 rounded-2xl p-5">
          <div className="flex items-baseline gap-3">
            <span className="text-4xl font-bold text-gray-900 tabular-nums" style={{ fontFamily: "'Archivo Black', sans-serif" }}>{daysToMeet}</span>
            <span className="text-sm text-gray-500">{profile?.assessment_data?.meet_date_status === 'approx' ? 'days to the earliest likely meet date' : daysToMeet === 0 ? 'Meet day — go get it' : 'days to your meet'}</span>
          </div>
          {profile?.assessment_data?.meet_date_status === 'approx' && (
            <Link to="/dashboard/assessment" className="inline-block mt-3 text-sm font-semibold text-blue-600">Date announced? Update it → exact taper</Link>
          )}
          {attempts && (
            <div className="mt-4 pt-4 border-t border-gray-100 space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Suggested attempts (kg)</p>
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
            <span className="text-xs text-gray-500 whitespace-nowrap tabular-nums">{sessionsDone}/{sessionsTotal} sessions</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2" role="progressbar" aria-valuenow={progressPct} aria-valuemin="0" aria-valuemax="100">
            <div className="h-2 rounded-full transition-all duration-500" style={{ width: `${progressPct}%`, background: 'var(--ll-good)' }}></div>
          </div>
          <div className="flex justify-between mt-3 text-sm">
            <span className="text-gray-500">Week {currentWeek} of {totalWeeks}</span>
            <Link to="/dashboard/programs" className="font-semibold text-gray-900">Full program →</Link>
          </div>
        </section>
      )}

      {/* 5 — last session */}
      {lastTop.length > 0 && (
        <section className="bg-white border border-gray-200 rounded-2xl p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Last session · top sets</p>
          <div className="space-y-1">{lastTop.map((t, i) => <p key={i} className="text-sm font-mono text-gray-800">{t}</p>)}</div>
          <Link to="/dashboard/history" className="inline-block mt-3 text-sm font-semibold text-gray-900">All sessions →</Link>
        </section>
      )}
    </div>
  );
}
