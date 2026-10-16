import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { Link } from 'react-router-dom';
import { applyAdjustments, attemptPlan } from '../../lib/autoreg';
import { LIFT_NAMES } from '../../lib/engine';

export default function Overview() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
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
        supabase.from('athlete_profiles').select('full_name, competition_date, experience_level, assessment_data').eq('user_id', user.id).maybeSingle(),
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
  }, [user]);

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div></div>;

  const { profile, subscription, program, activity, logs } = dashboardData;
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
  let next = null;
  for (const w of snap?.weeks || []) {
    for (const d of w.days || []) {
      if (d.meetDay) continue;
      if (!done.has(`${w.week}-${d.day}`)) { next = { week: w, day: d }; break; }
    }
    if (next) break;
  }
  const blockDone = !!snap && !next;
  // A finished training week with no check-in yet → ask for it (Pro). The latest such week wins.
  let checkinWeek = null;
  for (const w of snap?.weeks || []) {
    if (w.meetWeek || w.taper) continue;
    const allLogged = (w.days || []).length && w.days.every((d) => done.has(`${w.week}-${d.day}`));
    if (allLogged && !checkins[String(w.week)]) checkinWeek = w.week;
  }
  const attempts = snap && daysToMeet !== null && daysToMeet <= 14 && daysToMeet >= 0 ? attemptPlan(snap.meta?.maxes || {}, logs, snap.meta?.form?.exp, snap.meta?.form?.compLifts) : null;
  const currentWeek = next ? next.week.week : totalWeeks;
  const nextMains = next ? next.day.exercises.filter((e) => e.type === 'Main').slice(0, 3) : [];
  const sessionsDone = logs.length;
  const sessionsTotal = (snap?.weeks || []).reduce((n, w) => n + (w.days || []).filter((d) => !d.meetDay).length, 0);
  // Last logged main-lift top sets (what a coach glances at)
  const lastLog = logs[0];
  const lastTop = (lastLog?.logged_exercises || []).filter((e) => e.type === 'Main' && !e.skipped).map((e) => {
    const sets = (e.loggedSets || []).filter((s) => s.completed && s.weight);
    if (!sets.length) return null;
    const top = sets.reduce((a, b) => (Number(b.weight) > Number(a.weight) ? b : a));
    return `${e.name} ${top.weight}×${top.reps}${top.rpe ? ` @${top.rpe}` : ''}`;
  }).filter(Boolean);

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-12">
      <div className="mb-12">
        <h1 className="text-2xl md:text-3xl font-semibold text-gray-900 tracking-tight">Welcome back, {firstName} 👋</h1>
        <p className="text-gray-500 mt-1 text-sm md:text-base">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Next Session</h2>
              {isPro ? <span className="px-2 py-0.5 text-xs font-medium bg-green-50 text-green-700 rounded-full">Pro Active</span> : <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">Free Tier</span>}
            </div>
            {program && next ? (
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{next.day.focus} <span className="text-gray-400 font-normal">· {next.week.label || `Week ${currentWeek}`}{next.day.weekday ? ` · ${next.day.weekday}${next.day.date ? ' ' + next.day.date : ''}` : ''}</span></h3>
                  <div className="text-sm text-gray-500 mt-1 space-y-0.5">
                    {nextMains.map((m, i) => <p key={i}>{m.name} · {m.sets} × {m.reps}{m.weight ? ` @ ${m.weight} kg` : ''}{m.rpe && m.rpe !== '—' ? ` · RPE ${m.rpe}` : ''}</p>)}
                    {nextMains.length === 0 && <p>Accessories + technique day</p>}
                  </div>
                </div>
                <Link to={`/dashboard/workout?week=${next.week.week}&day=${next.day.day}`} className="bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium py-2.5 px-5 rounded-lg transition-colors text-center whitespace-nowrap">Start session →</Link>
              </div>
            ) : blockDone ? (
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Block complete 🎉</h3>
                  <p className="text-sm text-gray-500">Every session is logged. Build the next block — the engine re-reads your assessment and the meet date.</p>
                </div>
                <Link to="/dashboard/generate" className="bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium py-2.5 px-5 rounded-lg transition-colors text-center">Build next block →</Link>
              </div>
            ) : (
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">No Active Workout</h3>
                  <p className="text-sm text-gray-500">Generate a program to start training.</p>
                </div>
                <Link to="/dashboard/generate" className="bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium py-2.5 px-5 rounded-lg transition-colors text-center">Build my block →</Link>
              </div>
            )}
          </div>

          {checkinWeek && (
            <div className="bg-gray-900 text-white rounded-xl p-6 shadow-sm flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Week {checkinWeek} done</h2>
                <p className="text-sm">60-second check-in: sleep, soreness, mood, pain. The engine reads it with your logged RPE and sets next week's kg.</p>
              </div>
              <Link to={`/dashboard/checkin?week=${checkinWeek}`} className="bg-white text-gray-900 text-sm font-semibold px-5 py-2.5 rounded-lg whitespace-nowrap">Weekly check-in →</Link>
            </div>
          )}

          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Current Training Block</h2>
            {currentBlock ? (
              <div>
                <div className="flex justify-between items-baseline mb-2">
                  <h3 className="text-lg font-semibold text-gray-900">{currentBlock}</h3>
                  <span className="text-sm text-gray-500">Week {currentWeek} of {totalWeeks} · {sessionsDone}/{sessionsTotal} sessions</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div className="bg-gray-900 h-2 rounded-full transition-all duration-500" style={{ width: `${sessionsTotal ? Math.min(100, (sessionsDone / sessionsTotal) * 100) : 0}%` }}></div>
                </div>
                <Link to="/dashboard/programs" className="inline-block mt-4 text-sm text-gray-700 hover:text-gray-900 font-medium">View full program →</Link>
              </div>
            ) : (
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Not Assigned</h3>
                <div className="w-full bg-gray-100 rounded-full h-2 mt-4"></div>
              </div>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Last Session · Top Sets</h2>
            {lastTop.length > 0 ? <div className="flex flex-wrap gap-x-6 gap-y-2">{lastTop.map((t, i) => <span key={i} className="text-sm font-mono text-gray-800">{t}</span>)}</div> : <p className="text-sm text-gray-400">Log a session and your top sets show up here.</p>}
          </div>
        </div>

        <div className="space-y-6">
          {hasMeet && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-sm text-white">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Meet Prep</h2>
              <p className="text-4xl font-bold tracking-tight">{daysToMeet}</p>
              <p className="text-sm text-gray-400 mt-1">{profile?.assessment_data?.meet_date_status === 'approx' ? 'Days to the earliest likely date' : 'Days to competition'}</p>
              {profile?.assessment_data?.meet_date_status === 'approx' && (
                <Link to="/dashboard/assessment" className="inline-block mt-3 text-xs font-semibold bg-white text-gray-900 px-3 py-1.5 rounded-lg">Date announced? Update it → exact taper</Link>
              )}
              {attempts && (
                <div className="mt-4 space-y-2 border-t border-gray-800 pt-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Suggested attempts (kg)</p>
                  {['squat', 'bench', 'deadlift'].filter((l) => attempts[l]).map((l) => <p key={l} className="text-sm"><span className="text-gray-400">{LIFT_NAMES[l]}</span> {attempts[l].opener} · {attempts[l].second} · {attempts[l].third}</p>)}
                  <p className="text-[11px] text-gray-500">{attempts.rule}</p>
                </div>
              )}
            </div>
          )}

          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-6">Recent Activity</h2>
            {activity.length > 0 ? (
              <div className="flow-root">
                <ul className="-mb-8">
                  {activity.map((act, idx) => (
                    <li key={idx}>
                      <div className="relative pb-8">
                        {idx !== activity.length - 1 ? <span className="absolute top-1 left-1 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true"></span> : null}
                        <div className="relative flex space-x-3">
                          <div>
                            <span className={`h-2 w-2 rounded-full flex items-center justify-center ring-4 ring-white mt-1.5 ${act.type === 'workout' ? 'bg-green-500' : act.type === 'program' ? 'bg-indigo-500' : 'bg-yellow-500'}`}></span>
                          </div>
                          <div className="flex min-w-0 flex-1 justify-between space-x-4">
                            <div><p className="text-sm text-gray-800">{act.text}</p></div>
                            <div className="whitespace-nowrap text-right text-xs text-gray-400">{new Date(act.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-gray-400">No recent activity.</p>
                <p className="text-xs text-gray-300 mt-1">Generate a program or log a workout to get started.</p>
              </div>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Quick Links</h2>
            <div className="space-y-3">
              <Link to="/dashboard/athlete-profile" className="block text-sm text-gray-700 hover:text-gray-900 transition-colors flex items-center justify-between">Athlete Profile <span className="text-gray-400">→</span></Link>
              <Link to="/dashboard/history" className="block text-sm text-gray-700 hover:text-gray-900 transition-colors flex items-center justify-between">Workout History <span className="text-gray-400">→</span></Link>
              <Link to="/dashboard/subscription" className="block text-sm text-gray-700 hover:text-gray-900 transition-colors flex items-center justify-between">Manage Subscription <span className="text-gray-400">→</span></Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
