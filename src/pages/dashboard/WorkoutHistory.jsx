import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

export default function WorkoutHistory() {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      const { data } = await supabase
        .from('workout_logs')
        .select(`id, date_completed, duration_seconds, week_number, day_number, logged_exercises, generated_programs ( program_snapshot )`)
        .eq('user_id', user.id)
        .order('date_completed', { ascending: false });

      setLogs(data || []);
      setLoading(false);
    };
    fetchHistory();
  }, [user]);

  if (loading) return <div className="flex justify-center min-h-[60vh] items-center"><div className="animate-spin h-8 w-8 border-2 border-gray-900 rounded-full border-t-transparent"></div></div>;

  const formatDuration = (secs) => { const m = Math.floor(secs / 60); return `${m} min`; };

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-8 py-8 md:py-12">
      <h1 className="text-3xl font-semibold text-gray-900 tracking-tight mb-8">Workout History</h1>
      {logs.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-12 text-center">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">No Workouts Logged Yet</h2>
          <p className="text-gray-500 text-sm">Start a workout from the program viewer to see your history here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {logs.map((log) => {
            const blockType = log.generated_programs?.program_snapshot?.blockType || 'Program';
            const completedExercises = (log.logged_exercises || []).filter(ex => !ex.skipped);
            const totalSets = completedExercises.reduce((acc, ex) => acc + (ex.loggedSets?.filter(s => s.completed).length || 0), 0);
            return (
              <div key={log.id} className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{new Date(log.date_completed).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</p>
                    <h3 className="text-lg font-bold text-gray-900 mt-1">{blockType} · W{log.week_number} D{log.day_number}</h3>
                  </div>
                  <div className="text-right">
                    <span className="px-2 py-1 text-xs font-semibold bg-gray-100 text-gray-700 rounded-md">{formatDuration(log.duration_seconds || 0)}</span>
                    <p className="text-xs text-gray-400 mt-1">{totalSets} sets completed</p>
                  </div>
                </div>
                <div className="space-y-2 border-t border-gray-100 pt-3">
                  {completedExercises.map((ex, i) => (
                    <div key={i} className="flex justify-between items-center text-sm">
                      <span className="text-gray-700 font-medium">{ex.name}</span>
                      <div className="flex gap-2">
                        {ex.loggedSets?.filter(s => s.completed).map((s, sIdx) => (
                          <span key={sIdx} className="text-xs bg-green-50 text-green-700 px-1.5 py-0.5 rounded font-mono">{s.weight}x{s.reps}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
