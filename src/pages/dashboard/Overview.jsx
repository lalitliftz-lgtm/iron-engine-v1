import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { Link } from 'react-router-dom';

export default function Overview() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState({
    profile: null,
    subscription: null,
    program: null,
    activity: [],
    recentPRs: []
  });

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!user) return;

      const [profileRes, subRes, programRes, logsRes, purchasesRes] = await Promise.all([
        supabase.from('athlete_profiles').select('full_name, competition_date, experience_level').eq('user_id', user.id).maybeSingle(),
        supabase.from('subscriptions').select('status, end_date').eq('user_id', user.id).eq('status', 'active').maybeSingle(),
        supabase.from('generated_programs').select('id, created_at, program_snapshot').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('workout_logs').select('date_completed, logged_exercises').eq('user_id', user.id).order('date_completed', { ascending: false }).limit(5),
        supabase.from('purchases').select('purchased_at, product_id, products(name)').eq('user_id', user.id).order('purchased_at', { ascending: false }).limit(3)
      ]);

      let activities = [];
      if (logsRes.data) { logsRes.data.forEach(log => { activities.push({ type: 'workout', date: log.date_completed, text: 'Workout logged' }); }); }
      if (programRes.data) { activities.push({ type: 'program', date: programRes.data.created_at, text: 'New program generated' }); }
      if (purchasesRes.data) { purchasesRes.data.forEach(pur => { activities.push({ type: 'purchase', date: pur.purchased_at, text: `Purchased ${pur.products?.name || 'product'}` }); }); }
      activities.sort((a, b) => new Date(b.date) - new Date(a.date));
      activities = activities.slice(0, 5);

      const prs = [];

      setDashboardData({ profile: profileRes.data, subscription: subRes.data, program: programRes.data, activity: activities, recentPRs: prs });
      setLoading(false);
    };

    fetchDashboardData();
  }, [user]);

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div></div>;

  const { profile, subscription, program, activity, recentPRs } = dashboardData;
  const isPro = subscription && new Date(subscription.end_date) > new Date();
  const firstName = profile?.full_name?.split(' ')[0] || 'Athlete';
  const hasMeet = profile?.competition_date;
  const daysToMeet = hasMeet ? Math.ceil((new Date(hasMeet) - new Date()) / (1000 * 60 * 60 * 24)) : null;

  const snap = program?.program_snapshot;
  const currentBlock = snap?.blockType || null;
  const totalWeeks = snap?.weeks?.length || 4;
  // Week of the block = weeks elapsed since it was generated, capped at the last week.
  const weeksElapsed = program ? Math.floor((Date.now() - new Date(program.created_at)) / (7 * 86400000)) : 0;
  const currentWeek = Math.min(totalWeeks, weeksElapsed + 1);
  const firstDay = snap?.weeks?.find((w) => w.week === currentWeek)?.days?.[0];
  const firstMain = firstDay?.exercises?.find((e) => e.type === 'Main');

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
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Today's Workout</h2>
              {isPro ? <span className="px-2 py-0.5 text-xs font-medium bg-green-50 text-green-700 rounded-full">Pro Active</span> : <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">Free Tier</span>}
            </div>
            {program ? (
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{firstDay?.focus || 'Day 1'} · Week {currentWeek}</h3>
                  <p className="text-sm text-gray-500">{firstMain ? `${firstMain.name} · ${firstMain.sets} × ${firstMain.reps}${firstMain.weight ? ` @ ${firstMain.weight} kg` : ''} · RPE ${firstMain.rpe}` : 'Open your program to see today\'s session'}</p>
                </div>
                <Link to="/dashboard/programs" className="bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium py-2 px-5 rounded-lg transition-colors text-center">Start Workout →</Link>
              </div>
            ) : (
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">No Active Workout</h3>
                  <p className="text-sm text-gray-500">Generate a program to start training.</p>
                </div>
                <Link to="/dashboard/programs" className="bg-gray-100 hover:bg-gray-200 text-gray-900 text-sm font-medium py-2 px-5 rounded-lg transition-colors text-center">Generate Program</Link>
              </div>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Current Training Block</h2>
            {currentBlock ? (
              <div>
                <div className="flex justify-between items-baseline mb-2">
                  <h3 className="text-lg font-semibold text-gray-900">{currentBlock}</h3>
                  <span className="text-sm text-gray-500">Week {currentWeek} of {totalWeeks}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div className="bg-gray-900 h-2 rounded-full transition-all duration-500" style={{ width: `${(currentWeek / totalWeeks) * 100}%` }}></div>
                </div>
              </div>
            ) : (
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Not Assigned</h3>
                <div className="w-full bg-gray-100 rounded-full h-2 mt-4"></div>
              </div>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Recent PRs</h2>
            {recentPRs.length > 0 ? <div className="flex flex-wrap gap-6"></div> : <p className="text-sm text-gray-400">No personal records logged yet.</p>}
          </div>
        </div>

        <div className="space-y-6">
          {hasMeet && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-sm text-white">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Meet Prep</h2>
              <p className="text-4xl font-bold tracking-tight">{daysToMeet}</p>
              <p className="text-sm text-gray-400 mt-1">Days to competition</p>
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
              <Link to="/dashboard/products" className="block text-sm text-gray-700 hover:text-gray-900 transition-colors flex items-center justify-between">My Products <span className="text-gray-400">→</span></Link>
              <Link to="/dashboard/subscription" className="block text-sm text-gray-700 hover:text-gray-900 transition-colors flex items-center justify-between">Manage Subscription <span className="text-gray-400">→</span></Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
